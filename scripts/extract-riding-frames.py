#!/usr/bin/env python3
"""Extract, clean, and pack the 28-frame skeleton riding sprite sheet.

Reads frames [4..31] (0-indexed) from `public/riding.mp4`, removes the white
background, horizontal ground shadow bar, and all enclosed background pockets
while preserving rounded tire bottoms, spokes, bones, and skull, then exports:
  - frames/frame-1.png .. frames/frame-28.png (300x286 RGBA PNGs)
  - public/images/skeleton-riding-sheet.v1.webp (2156x1176, 7x4, 4px gutters)
  - public/images/skeleton-riding-poster.v1.webp (300x286 from frame 1)

Optional `--verify-dir <dir>` decodes the final WebP sprite sheet onto
#FDFDFD light and #0A0A0A dark backgrounds to verify zero halos or defects.
"""

from __future__ import annotations

import argparse
from collections import deque
import glob
import os
from pathlib import Path
import subprocess
import sys
import numpy as np


SRC_W, SRC_H = 1920, 1080
START_FRAME = 4
END_FRAME = 31
FRAME_COUNT = END_FRAME - START_FRAME + 1  # 28

CELL_W, CELL_H = 300, 286
GUTTER = 4
STRIDE_W = CELL_W + 2 * GUTTER  # 308
STRIDE_H = CELL_H + 2 * GUTTER  # 294
COLS, ROWS = 7, 4
SHEET_W = COLS * STRIDE_W  # 2156
SHEET_H = ROWS * STRIDE_H  # 1176

# Working ROI around the skeleton & bicycle in 1920x1080 space
ROI_X0, ROI_X1 = 560, 1330
ROI_Y0, ROI_Y1 = 185, 885


def run_ffmpeg_raw(args: list[str], input_bytes: bytes | None = None) -> bytes:
    """Execute ffmpeg and return stdout bytes, raising on failure."""
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", *args],
        input=input_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return proc.stdout


def load_source_frames(video_path: Path) -> np.ndarray:
    """Decode frames [START_FRAME..END_FRAME] from video_path as RGB uint8."""
    raw = run_ffmpeg_raw([
        "-i", str(video_path),
        "-vf", f"select='between(n,{START_FRAME},{END_FRAME})'",
        "-vsync", "0",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "pipe:1",
    ])
    expected = FRAME_COUNT * SRC_H * SRC_W * 3
    if len(raw) != expected:
        raise RuntimeError(
            f"Expected {expected} RGB bytes for {FRAME_COUNT} frames, got {len(raw)}"
        )
    return np.frombuffer(raw, dtype=np.uint8).reshape((FRAME_COUNT, SRC_H, SRC_W, 3))


def dilate_r(mask: np.ndarray, radius: int) -> np.ndarray:
    """Circular binary dilation using numpy slice shifts."""
    out = mask.copy()
    h, w = mask.shape
    r2 = radius * radius + 0.5
    for dy in range(-radius, radius + 1):
        sy0, sy1 = max(0, -dy), h - max(0, dy)
        dy0, dy1 = max(0, dy), h - max(0, -dy)
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > r2 or (dx == 0 and dy == 0):
                continue
            sx0, sx1 = max(0, -dx), w - max(0, dx)
            dx0, dx1 = max(0, dx), w - max(0, -dx)
            out[dy0:dy1, dx0:dx1] |= mask[sy0:sy1, sx0:sx1]
    return out


def erode_r(mask: np.ndarray, radius: int) -> np.ndarray:
    """Circular binary erosion."""
    return ~dilate_r(~mask, radius)


def dilate_8_1(mask: np.ndarray) -> np.ndarray:
    """3x3 8-connected single-pixel binary dilation."""
    p = np.pad(mask, 1, mode="constant", constant_values=False)
    return (
        mask
        | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    )


def approx_dist_to_barrier(light: np.ndarray, barrier: np.ndarray, max_r: int = 32) -> np.ndarray:
    """Compute discrete Euclidean-ish distance from light pixels to barrier."""
    dist = np.zeros(light.shape, dtype=np.int16)
    cur = barrier.copy()
    for r in range(1, max_r + 1):
        nxt = dilate_r(cur, 1)
        newly = nxt & (~cur) & light
        dist[newly] = r
        cur = nxt
        if not (light & (~cur)).any():
            break
    dist[light & (~cur)] = max_r + 1
    return dist


def seg_dist(px: np.ndarray, py: np.ndarray, x1: float, y1: float, x2: float, y2: float) -> np.ndarray:
    """Point-to-line-segment distance over 2D coordinate grids."""
    vx, vy = x2 - x1, y2 - y1
    t = np.clip(((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy), 0.0, 1.0)
    return np.hypot(px - (x1 + t * vx), py - (y1 + t * vy))


def fit_circle_lstsq(pts: np.ndarray) -> tuple[float, float, float]:
    """Fit circle (cx, cy, r) to 2D points via linear least squares."""
    x, y = pts[:, 0], pts[:, 1]
    mat = np.column_stack([x, y, np.ones_like(x)])
    a, b, c = np.linalg.lstsq(mat, -(x * x + y * y), rcond=None)[0]
    cx, cy = -a / 2.0, -b / 2.0
    r = float(np.sqrt(cx * cx + cy * cy - c))
    return float(cx), float(cy), r


def detect_hub_center(min_lum: np.ndarray, x_guess: int, y_guess: int) -> tuple[float, float]:
    """Detect persistent white wheel hub disc center around a coarse estimate."""
    box = 35
    sub = min_lum[y_guess - box:y_guess + box, x_guess - box:x_guess + box] > 210
    vis = np.zeros_like(sub, dtype=bool)
    q = deque([(box, box)])
    vis[box, box] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < 2 * box and 0 <= nx < 2 * box and sub[ny, nx] and not vis[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    ys, xs = np.where(vis)
    return float(xs.mean() + x_guess - box), float(ys.mean() + y_guess - box)


def fit_tire_geometry(
    med_lum: np.ndarray,
    cx_init: float,
    cy_init: float,
    angles_deg: list[int],
) -> tuple[float, float, float, float]:
    """Fit concentric outer and inner tire circle geometry on temporal median luminance."""
    outer_pts, inner_pts = [], []
    for ang in angles_deg:
        rad = np.radians(ang)
        ca, sa = np.cos(rad), np.sin(rad)
        rs = np.arange(80.0, 145.0, 0.5)
        xs = np.round(cx_init + rs * ca).astype(int)
        ys = np.round(cy_init + rs * sa).astype(int)
        vals = med_lum[ys, xs]
        if vals[-10:].mean() < 220:
            continue
        idx_out = np.where(vals < 150)[0]
        if len(idx_out) > 0:
            r_out = rs[idx_out[-1]]
            outer_pts.append((cx_init + r_out * ca, cy_init + r_out * sa))
        idx_in = np.where((vals < 150) & (rs >= 82.0) & (rs <= 110.0))[0]
        if len(idx_in) > 0:
            r_in = rs[idx_in[0]]
            inner_pts.append((cx_init + r_in * ca, cy_init + r_in * sa))

    outer_arr = np.array(outer_pts)
    cx, cy, r_out = fit_circle_lstsq(outer_arr)
    res_o = np.abs(np.hypot(outer_arr[:, 0] - cx, outer_arr[:, 1] - cy) - r_out)
    cx, cy, r_out = fit_circle_lstsq(outer_arr[res_o < 3.0])

    inner_arr = np.array(inner_pts)
    cxi, cyi, r_in = fit_circle_lstsq(inner_arr)
    res_i = np.abs(np.hypot(inner_arr[:, 0] - cxi, inner_arr[:, 1] - cyi) - r_in)
    cxi, cyi, r_in = fit_circle_lstsq(inner_arr[res_i < 3.0])

    return cx, cy, r_in, r_out


def detect_wheels(lum_roi: np.ndarray) -> dict[str, tuple[float, float, float, float]]:
    """Detect front and rear wheel hubs and tire inner/outer circles."""
    med_lum = np.median(lum_roi, axis=0)
    min_lum = lum_roi.min(axis=0)

    fhx, fhy = detect_hub_center(min_lum, 740 - ROI_X0, 725 - ROI_Y0)
    rhx, rhy = detect_hub_center(min_lum, 1156 - ROI_X0, 730 - ROI_Y0)
    fhx += ROI_X0
    fhy += ROI_Y0
    rhx += ROI_X0
    rhy += ROI_Y0

    f_angles = list(range(-55, 50, 2)) + list(range(130, 235, 2))
    r_angles = list(range(-85, 50, 2)) + list(range(130, 155, 2))

    # Fit in ROI coordinates then shift back to global 1080p coordinates
    fcx, fcy, f_rin, f_rout = fit_tire_geometry(med_lum, 738 - ROI_X0, 735 - ROI_Y0, f_angles)
    rcx, rcy, r_rin, r_rout = fit_tire_geometry(med_lum, 1156 - ROI_X0, 732 - ROI_Y0, r_angles)

    return {
        "front_hub": (fhx, fhy, 0.0, 21.0),
        "rear_hub": (rhx, rhy, 0.0, 18.5),
        "front_tire": (fcx + ROI_X0, fcy + ROI_Y0, f_rin, f_rout),
        "rear_tire": (rcx + ROI_X0, rcy + ROI_Y0, r_rin, r_rout),
    }


def build_static_masks(wheels: dict[str, tuple[float, float, float, float]]) -> dict[str, np.ndarray]:
    """Precompute ROI coordinate grids, wheel seals, and static bike frame regions."""
    yy, xx = np.mgrid[ROI_Y0:ROI_Y1, ROI_X0:ROI_X1]
    fcx, fcy, f_rin, f_rout = wheels["front_tire"]
    rcx, rcy, r_rin, r_rout = wheels["rear_tire"]
    fhx, fhy, _, _ = wheels["front_hub"]
    rhx, rhy, _, _ = wheels["rear_hub"]

    df = np.hypot(xx - fcx, yy - fcy)
    dr = np.hypot(xx - rcx, yy - rcy)
    af = np.degrees(np.arctan2(yy - fcy, xx - fcx))
    ar = np.degrees(np.arctan2(yy - rcy, xx - rcx))
    df_hub = np.hypot(xx - fhx, yy - fhy)
    dr_hub = np.hypot(xx - rhx, yy - rhy)

    # Exclude static fork/stays crossings from virtual tire rim seals
    fork_ang = (af >= -74.0) & (af <= -58.0)
    seatstay_ang = (ar >= -144.0) & (ar <= -126.0)
    chainstay_ang = (ar >= 164.0) & (ar <= 179.0)

    tire_seals = (
        ((df >= f_rin - 1.5) & (df <= f_rin + 1.5) & (~fork_ang))
        | ((df >= f_rout - 1.6) & (df <= f_rout + 1.4) & (~fork_ang))
        | ((dr >= r_rin - 1.8) & (dr <= r_rin + 1.2) & (~seatstay_ang) & (~chainstay_ang))
        | ((dr >= r_rout - 2.0) & (dr <= r_rout + 1.1) & (~seatstay_ang) & (~chainstay_ang))
    )
    knuckle_zone = ((df >= f_rout - 3.5) & (df <= f_rout + 12.5)) | (
        (dr >= r_rout - 4.0) & (dr <= r_rout + 12.0)
    )

    static_core = (
        (seg_dist(xx, yy, 825, 554, 1030, 608) <= 6)
        | (seg_dist(xx, yy, 818, 592, 968, 748) <= 6)
        | (seg_dist(xx, yy, 1032, 605, 988, 728) <= 6)
        | (seg_dist(xx, yy, 1051, 560, 1038, 595) <= 6)
        | (seg_dist(xx, yy, 818, 525, 798, 595) <= 7)
        | ((xx >= 1015) & (xx <= 1095) & (yy >= 534) & (yy <= 552))
        | (seg_dist(xx, yy, 1040, 598, 1156, 730) <= 6)
        | (seg_dist(xx, yy, 1002, 750, 1156, 732) <= 6)
        | (seg_dist(xx, yy, 795, 580, 743, 725) <= 6)
    )

    y_ss = 598.0 + (730.0 - 598.0) * (xx - 1040.0) / (1156.0 - 1040.0)
    y_cs = 750.0 + (732.0 - 750.0) * (xx - 1002.0) / (1156.0 - 1002.0)
    x_st = 1032.0 + (988.0 - 1032.0) * (yy - 605.0) / (728.0 - 605.0)
    rear_tri_zone = (xx > x_st + 8.0) & (yy > y_ss + 7.0) & (yy < y_cs - 7.0) & (dr >= r_rout - 1.0)

    y_tt_c = 554.0 + (608.0 - 554.0) * (xx - 825.0) / (1030.0 - 825.0)
    y_dt_c = 592.0 + (748.0 - 592.0) * (xx - 818.0) / (968.0 - 818.0)
    main_tri_zone = (yy > y_tt_c + 8.0) & (yy < y_dt_c - 8.0) & (xx < x_st - 8.0) & (xx > 820.0)
    above_tt_zone = (yy >= 515.0) & (yy < y_tt_c - 6.0) & (xx >= 905.0) & (xx <= 1035.0)
    below_dt_pocket_zone = (yy > y_dt_c + 12.0) & (df > f_rout + 3.4) & (xx < 915.0) & (yy < 720.0)

    return {
        "yy": yy,
        "xx": xx,
        "df": df,
        "dr": dr,
        "df_hub": df_hub,
        "dr_hub": dr_hub,
        "f_rin": f_rin,
        "f_rout": f_rout,
        "r_rin": r_rin,
        "r_rout": r_rout,
        "tire_seals": tire_seals,
        "knuckle_zone": knuckle_zone,
        "static_core": static_core,
        "rear_tri_zone": rear_tri_zone,
        "main_tri_zone": main_tri_zone,
        "above_tt_zone": above_tt_zone,
        "below_dt_pocket_zone": below_dt_pocket_zone,
    }


def extract_frame_rgba(
    rgb_roi: np.ndarray,
    lum_roi: np.ndarray,
    masks: dict[str, np.ndarray],
) -> np.ndarray:
    """Remove white background, ground shadow bar, and enclosed pockets for one frame."""
    yy = masks["yy"]
    df = masks["df"]
    dr = masks["dr"]
    df_hub = masks["df_hub"]
    dr_hub = masks["dr_hub"]
    f_rin = float(masks["f_rin"])
    f_rout = float(masks["f_rout"])
    r_rin = float(masks["r_rin"])
    r_rout = float(masks["r_rout"])
    tire_seals = masks["tire_seals"]
    knuckle_zone = masks["knuckle_zone"]
    static_core = masks["static_core"]
    rear_tri_zone = masks["rear_tri_zone"]
    main_tri_zone = masks["main_tri_zone"]
    above_tt_zone = masks["above_tt_zone"]
    below_dt_pocket_zone = masks["below_dt_pocket_zone"]

    # 1. Reconstruct bottom wheel contact arcs & bone-knuckle outlines before stripping ground shadow bar
    l_work = lum_roi.copy()
    wk_f = (l_work > 180.0) & (df <= f_rout + 2.5) & (yy <= 860)
    wk_r = (l_work > 180.0) & (dr <= r_rout + 2.5) & (yy <= 860)
    keep_wheel_bot = (
        (df <= f_rout + 1.1)
        | (dr <= r_rout + 1.0)
        | dilate_r(wk_f | wk_r, 3)
    )
    shadow_zone = (yy >= 852) & (~keep_wheel_bot)
    l_work[shadow_zone] = 255.0

    # 2. Unclosed exterior flood-fill on light pixels (lum >= 225)
    closed_knuckles = erode_r(dilate_r(l_work < 135.0, 3), 3)
    ext_barrier = (l_work < 225.0) | tire_seals | (closed_knuckles & knuckle_zone)
    h, w = l_work.shape
    ext_bg = np.zeros((h, w), dtype=bool)
    q = deque([(0, 0)])
    ext_bg[0, 0] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and (not ext_barrier[ny, nx]) and (not ext_bg[ny, nx]):
                ext_bg[ny, nx] = True
                q.append((ny, nx))

    bg_comp = ext_bg.copy()

    # 3. Clean narrow enclosed corridor between upper and lower arms (unclosed lum >= 170)
    arm_y0, arm_y1 = 410 - ROI_Y0, 480 - ROI_Y0
    arm_x0, arm_x1 = 800 - ROI_X0, 905 - ROI_X0
    arm_light = (l_work[arm_y0:arm_y1, arm_x0:arm_x1] >= 170.0) & (~ext_bg[arm_y0:arm_y1, arm_x0:arm_x1])
    arm_vis = np.zeros_like(arm_light)
    ah, aw = arm_light.shape
    ay_s, ax_s = np.where(arm_light)
    for y0, x0 in zip(ay_s, ax_s):
        if arm_vis[y0, x0]:
            continue
        aq = deque([(int(y0), int(x0))])
        arm_vis[y0, x0] = True
        pts = []
        touches_border = False
        while aq:
            y, x = aq.popleft()
            pts.append((y, x))
            if y == 0 or y == ah - 1 or x == 0 or x == aw - 1:
                touches_border = True
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < ah and 0 <= nx < aw and arm_light[ny, nx] and not arm_vis[ny, nx]:
                    arm_vis[ny, nx] = True
                    aq.append((ny, nx))
        if (not touches_border) and len(pts) < 250:
            py_l = np.array([p[0] + arm_y0 for p in pts])
            px_l = np.array([p[1] + arm_x0 for p in pts])
            y_slot_line = 458.0 - 0.45 * (px_l + ROI_X0 - 815.0)
            if np.abs((py_l + ROI_Y0) - y_slot_line).mean() <= 10.0:
                bg_comp[py_l, px_l] = True

    # 4. Morphological dark-ink closing for enclosed hole labeling (keep wheel interiors unclosed so narrow spoke necks never pinch)
    dark = l_work < 125.0
    closed = erode_r(dilate_r(dark, 2), 2)
    wheel_inner = (df < f_rin - 4.0) | (dr < r_rin - 4.0)
    closed[wheel_inner] = l_work[wheel_inner] < 105.0
    closed[knuckle_zone] |= closed_knuckles[knuckle_zone]
    barrier = closed | tire_seals | ext_bg
    light = ~barrier
    dmap = approx_dist_to_barrier(light, barrier, 30)

    labels = np.zeros((h, w), dtype=np.int32)
    cur = 0
    ys, xs = np.where(light)
    for y0, x0 in zip(ys, xs):
        if labels[y0, x0] != 0:
            continue
        cur += 1
        hq = deque([(int(y0), int(x0))])
        labels[y0, x0] = cur
        pts_y, pts_x = [], []
        while hq:
            y, x = hq.popleft()
            pts_y.append(y)
            pts_x.append(x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and labels[ny, nx] == 0:
                    labels[ny, nx] = cur
                    hq.append((ny, nx))
        area = len(pts_y)
        if area < 3:
            continue
        py_a = np.array(pts_y)
        px_a = np.array(pts_x)
        cx_c = float(px_a.mean() + ROI_X0)
        cy_c = float(py_a.mean() + ROI_Y0)
        x_min, x_max = int(px_a.min() + ROI_X0), int(px_a.max() + ROI_X0)
        y_min, y_max = int(py_a.min() + ROI_Y0), int(py_a.max() + ROI_Y0)
        max_d = int(dmap[py_a, px_a].max())

        in_fw = float((df[py_a, px_a] < f_rin + 0.5).mean())
        in_rw = float((dr[py_a, px_a] < r_rin + 0.2).mean())
        in_tr = float((
            ((df[py_a, px_a] >= f_rin + 0.5) & (df[py_a, px_a] <= f_rout + 1.5))
            | ((dr[py_a, px_a] >= r_rin + 0.2) & (dr[py_a, px_a] <= r_rout + 1.1))
        ).mean())

        # Protect circular tire rings
        if in_tr > 0.5:
            continue

        # Wheel interiors: keep hubs, frame crossings, spokes, and pinched outer front spoke knuckles
        if in_fw > 0.5 or in_rw > 0.5:
            r_tire = df[py_a, px_a] if in_fw > 0.5 else dr[py_a, px_a]
            r_hub = df_hub[py_a, px_a] if in_fw > 0.5 else dr_hub[py_a, px_a]
            min_rh, max_rt = float(r_hub.min()), float(r_tire.max())
            if min_rh < 10.0 or max_rt > ((f_rin + 5.5) if in_fw > 0.5 else (r_rin + 5.2)):
                continue
            if area >= 100 and max_d <= 10 and min_rh <= 40.0:
                continue
            if in_fw > 0.5 and area >= 180 and min_rh >= 72.0 and max_d <= 10:
                continue
            bg_comp[py_a, px_a] = True
            continue

        # Protect static bike frame tube interiors
        if static_core[py_a, px_a].mean() > 0.15:
            continue

        # Rear triangle pockets (strictly excluding front foot crossing seat tube)
        rt_frac = float(rear_tri_zone[py_a, px_a].mean())
        if rt_frac > 0.65 and cy_c <= 733.0 and (cx_c >= 1022.0 or (area <= 250 and x_min >= 1008)):
            bg_comp[py_a, px_a] = True
            continue

        if area < 25:
            continue

        # Arm-torso gap
        if area >= 4500 and 835.0 <= cx_c <= 1035.0 and 440.0 <= cy_c <= 565.0:
            bg_comp[py_a, px_a] = True
            continue

        # Enclosed corner below down tube behind front wheel (when back foot touches front tire)
        if below_dt_pocket_zone[py_a, px_a].mean() > 0.65 and area >= 150:
            bg_comp[py_a, px_a] = True
            continue

        # Above top tube pockets & seatpost corner (protecting left far knee knuckle and saddle nose)
        if above_tt_zone[py_a, px_a].mean() > 0.55:
            if x_max >= 1030 and y_min >= 555:
                bg_comp[py_a, px_a] = True
                continue
            if 952.0 <= cx_c <= 996.0 and max_d >= 11 and y_min >= 520 and area >= 520:
                bg_comp[py_a, px_a] = True
                continue
            continue

        # Main frame triangle pockets (while preserving shins, ankles, and feet)
        if main_tri_zone[py_a, px_a].mean() > 0.55:
            y_min_l, y_max_l = int(py_a.min()), int(py_a.max())
            ht = y_max_l - y_min_l + 1
            tw = float(np.mean([int((py_a == r).sum()) for r in range(y_min_l, y_min_l + max(1, ht // 4))]))
            bw = float(np.mean([int((py_a == r).sum()) for r in range(y_max_l - max(1, ht // 4) + 1, y_max_l + 1)]))

            if max_d >= 20:
                bg_comp[py_a, px_a] = True
                continue
            if bw < 8.5 and not (area >= 1200 and ht >= 80 and cx_c <= 982.0) and not (650.0 <= cy_c <= 705.0 and area >= 250 and x_min <= 960):
                bg_comp[py_a, px_a] = True
                continue
            if ht <= 35 and y_min <= 622 and x_max >= 990:
                bg_comp[py_a, px_a] = True
                continue
            if y_min <= 612 and y_max <= 668 and ht < 65 and 930.0 <= cx_c <= 975.0:
                bg_comp[py_a, px_a] = True
                continue
            if ht <= 30 and y_min >= 690:
                bg_comp[py_a, px_a] = True
                continue
            if 975.0 <= cx_c <= 1005.0 and x_max >= 992 and y_min <= 638 and y_max <= 688 and ht < 55 and tw <= 12.0:
                bg_comp[py_a, px_a] = True
                continue
            if 975.0 <= cx_c <= 988.0 and y_min >= 627 and y_max <= 720 and x_max <= 1000 and tw <= 14.0:
                bg_comp[py_a, px_a] = True
                continue

    # 5. Strip tiny isolated floating foreground debris surrounded by background
    fg_raw = ~(bg_comp | shadow_zone)
    fg_vis = np.zeros_like(fg_raw)
    fy_s, fx_s = np.where(fg_raw)
    for y0, x0 in zip(fy_s, fx_s):
        if fg_vis[y0, x0]:
            continue
        fq = deque([(int(y0), int(x0))])
        fg_vis[y0, x0] = True
        fpts_y, fpts_x = [], []
        while fq:
            y, x = fq.popleft()
            fpts_y.append(y)
            fpts_x.append(x)
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and fg_raw[ny, nx] and not fg_vis[ny, nx]:
                    fg_vis[ny, nx] = True
                    fq.append((ny, nx))
        if len(fpts_y) < 180:
            bg_comp[np.array(fpts_y), np.array(fpts_x)] = True

    # 6. Zero-halo geodesic anti-aliased skirt (never crosses pure black ink into bone fills)
    bg_mask = bg_comp | shadow_zone
    step1 = dilate_8_1(bg_mask) & (~bg_mask) & (l_work >= 35.0)
    step2 = dilate_8_1(bg_mask | step1) & (~bg_mask) & (~step1) & (l_work >= 55.0)
    outer_aa = step1 | step2
    near_fg = dilate_8_1(~bg_mask)
    bg_aa = bg_comp & (~shadow_zone) & near_fg & (l_work < 245.0)

    aa_band = outer_aa | bg_aa
    pure_bg = bg_mask & (~bg_aa)

    alpha = np.full(l_work.shape, 255, dtype=np.uint8)
    rgb = rgb_roi.copy().astype(np.float32)

    alpha[pure_bg] = 0
    rgb[pure_bg] = 0.0

    el = l_work[aa_band]
    t = np.clip((248.0 - el) / (248.0 - 35.0), 0.0, 1.0)
    alpha[aa_band] = np.round(t * 255.0).astype(np.uint8)
    rgb[aa_band] = 0.0
    rgb[alpha == 0] = 0.0

    return np.dstack([np.round(rgb).astype(np.uint8), alpha])


def compute_crop_rect(rgba_roi_frames: list[np.ndarray]) -> tuple[int, int, int, int]:
    """Compute tight aspect-matched union crop box (x0, x1, y0, y1) in 1080p coordinates."""
    min_x, max_x = SRC_W, 0
    min_y, max_y = SRC_H, 0
    for rgba in rgba_roi_frames:
        ys, xs = np.where(rgba[..., 3] > 0)
        min_x = min(min_x, int(xs.min()) + ROI_X0)
        max_x = max(max_x, int(xs.max()) + ROI_X0)
        min_y = min(min_y, int(ys.min()) + ROI_Y0)
        max_y = max(max_y, int(ys.max()) + ROI_Y0)

    span_x = max_x - min_x + 1
    span_y = max_y - min_y + 1
    pad_y = 10
    crop_h = span_y + 2 * pad_y
    crop_w = int(round(crop_h * CELL_W / CELL_H))
    if crop_w < span_x + 20:
        crop_w = span_x + 20
        crop_h = int(round(crop_w * CELL_H / CELL_W))

    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    x0 = int(round(cx - crop_w / 2.0))
    y0 = int(round(cy - crop_h / 2.0))
    return x0, x0 + crop_w, y0, y0 + crop_h


def scale_frames_to_target(
    rgba_roi_frames: list[np.ndarray],
    crop_rect: tuple[int, int, int, int],
) -> np.ndarray:
    """Crop all 28 frames to union bbox and scale cleanly to 300x286 via ffmpeg Lanczos."""
    x0, x1, y0, y1 = crop_rect
    cw, ch = x1 - x0, y1 - y0
    rx0, rx1 = x0 - ROI_X0, x1 - ROI_X0
    ry0, ry1 = y0 - ROI_Y0, y1 - ROI_Y0

    raw_in = b"".join(f[ry0:ry1, rx0:rx1].tobytes() for f in rgba_roi_frames)
    raw_out = run_ffmpeg_raw(
        [
            "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{cw}x{ch}", "-i", "pipe:0",
            "-vf", f"scale={CELL_W}:{CELL_H}:flags=lanczos",
            "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
        ],
        input_bytes=raw_in,
    )
    scaled = np.frombuffer(raw_out, dtype=np.uint8).reshape((FRAME_COUNT, CELL_H, CELL_W, 4)).copy()

    # Zero RGB wherever alpha == 0 after scaling and assert zero border clipping
    scaled[scaled[..., 3] == 0, :3] = 0
    border_alpha = max(
        int(scaled[:, 0, :, 3].max()),
        int(scaled[:, -1, :, 3].max()),
        int(scaled[:, :, 0, 3].max()),
        int(scaled[:, :, -1, 3].max()),
    )
    if border_alpha != 0:
        raise AssertionError(f"Frame border clipping detected: max border alpha={border_alpha}")
    return scaled


def export_png_sequence(scaled: np.ndarray, frames_dir: Path) -> None:
    """Clean stale frame-*.png files and export 1-indexed 300x286 RGBA PNGs."""
    frames_dir.mkdir(parents=True, exist_ok=True)
    for stale in glob.glob(str(frames_dir / "frame-*.png")):
        os.remove(stale)

    for idx in range(FRAME_COUNT):
        out_path = frames_dir / f"frame-{idx + 1}.png"
        run_ffmpeg_raw(
            [
                "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{CELL_W}x{CELL_H}",
                "-i", "pipe:0", "-compression_level", "9", str(out_path),
            ],
            input_bytes=scaled[idx].tobytes(),
        )


def build_sprite_sheet(scaled: np.ndarray) -> np.ndarray:
    """Pack 28 300x286 frames into a 7x4 sheet (2156x1176) with 4px gutters."""
    sheet = np.zeros((SHEET_H, SHEET_W, 4), dtype=np.uint8)
    for i in range(FRAME_COUNT):
        r, c = i // COLS, i % COLS
        y = r * STRIDE_H + GUTTER
        x = c * STRIDE_W + GUTTER
        sheet[y:y + CELL_H, x:x + CELL_W] = scaled[i]
    return sheet


def quantize_monochrome_sheet(sheet: np.ndarray, gray_bins: int, alpha_bins: int) -> tuple[np.ndarray, int]:
    """Snap source gray/alpha noise onto a <=256-color lossless WebP palette."""
    g = np.round(0.299 * sheet[..., 0] + 0.587 * sheet[..., 1] + 0.114 * sheet[..., 2]).astype(np.int32)
    a = sheet[..., 3].astype(np.int32)

    g[g >= 240] = 255
    g[g <= 18] = 0
    a[a <= 8] = 0
    a[a >= 247] = 255

    step_g = 255.0 / (gray_bins - 1)
    step_a = 255.0 / (alpha_bins - 1)
    gq = np.round(np.round(g / step_g) * step_g).clip(0, 255).astype(np.uint8)
    aq = np.round(np.round(a / step_a) * step_a).clip(0, 255).astype(np.uint8)

    out = np.zeros_like(sheet)
    out[..., 0] = gq
    out[..., 1] = gq
    out[..., 2] = gq
    out[..., 3] = aq
    out[aq == 0] = 0
    uniq = int(len(np.unique(out.reshape(-1, 4), axis=0)))
    return out, uniq


def encode_webp_assets(
    sheet: np.ndarray,
    frame1: np.ndarray,
    sheet_path: Path,
    poster_path: Path,
) -> tuple[str, int, int]:
    """Encode WebP sheet (benchmarking lossless, palette-lossless, vs lossy) and frame-1 poster."""
    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_exact = sheet_path.with_suffix(".exact.tmp.webp")
    tmp_pal = sheet_path.with_suffix(".pal.tmp.webp")
    tmp_lossy = sheet_path.with_suffix(".lossy.tmp.webp")

    def run_webp(img: np.ndarray, dst: Path, extra_args: list[str]) -> int:
        h, w = img.shape[:2]
        run_ffmpeg_raw(
            [
                "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}",
                "-i", "pipe:0", "-c:v", "libwebp", *extra_args, str(dst),
            ],
            input_bytes=img.tobytes(),
        )
        return int(dst.stat().st_size)

    sz_exact = run_webp(sheet, tmp_exact, ["-lossless", "1", "-preset", "drawing", "-pix_fmt", "bgra"])

    # Clean monochrome palette encoding without -preset so libwebp enables Color Indexing (<=256 RGBA)
    chosen_pal_desc = ""
    sz_pal = 10**9
    for gb, ab in [(17, 17), (13, 13), (9, 9)]:
        pal_sheet, uniq = quantize_monochrome_sheet(sheet, gb, ab)
        sz_pal = run_webp(pal_sheet, tmp_pal, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])
        chosen_pal_desc = f"palette-lossless-{gb}x{ab}({uniq}c)"
        if sz_pal <= 350 * 1024:
            break

    sz_lossy = run_webp(
        sheet, tmp_lossy, ["-lossless", "0", "-quality", "85", "-preset", "drawing", "-pix_fmt", "yuva420p"]
    )

    if sz_exact <= 350 * 1024:
        mode = f"lossless-exact (exact={sz_exact} B, {chosen_pal_desc}={sz_pal} B, q85={sz_lossy} B)"
        tmp_exact.replace(sheet_path)
    elif sz_pal <= 350 * 1024 or sz_pal <= sz_lossy:
        mode = f"{chosen_pal_desc} ({chosen_pal_desc}={sz_pal} B <= 350 KiB, exact={sz_exact} B, q85={sz_lossy} B)"
        tmp_pal.replace(sheet_path)
    else:
        mode = f"lossy-q85 (q85={sz_lossy} B, {chosen_pal_desc}={sz_pal} B, exact={sz_exact} B)"
        tmp_lossy.replace(sheet_path)

    for tmp in (tmp_exact, tmp_pal, tmp_lossy):
        tmp.unlink(missing_ok=True)

    # Encode frame-1 static fallback poster (300x286)
    run_webp(frame1, poster_path, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])

    return mode, int(sheet_path.stat().st_size), int(poster_path.stat().st_size)


def render_verification_sheets(sheet_path: Path, verify_dir: Path) -> None:
    """Decode actual runtime WebP sheet and composite onto #FDFDFD and #0A0A0A."""
    verify_dir.mkdir(parents=True, exist_ok=True)
    decoded_raw = run_ffmpeg_raw([
        "-i", str(sheet_path),
        "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
    ])
    decoded = np.frombuffer(decoded_raw, dtype=np.uint8).reshape((SHEET_H, SHEET_W, 4))
    alpha = decoded[..., 3:4].astype(np.float32) / 255.0
    rgb = decoded[..., :3].astype(np.float32)

    for fname, bg_rgb in [("contact-light.png", (253, 253, 253)), ("contact-dark.png", (10, 10, 10))]:
        bg = np.array(bg_rgb, dtype=np.float32)
        comp = np.round(rgb * alpha + bg * (1.0 - alpha)).astype(np.uint8)
        out_path = verify_dir / fname
        run_ffmpeg_raw(
            [
                "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{SHEET_W}x{SHEET_H}",
                "-i", "pipe:0", str(out_path),
            ],
            input_bytes=comp.tobytes(),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify-dir",
        type=Path,
        default=None,
        help="Optional directory to write contact-light.png and contact-dark.png from decoded WebP.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    video_path = repo_root / "public" / "riding.mp4"
    frames_dir = repo_root / "frames"
    sheet_path = repo_root / "public" / "images" / "skeleton-riding-sheet.v1.webp"
    poster_path = repo_root / "public" / "images" / "skeleton-riding-poster.v1.webp"

    if not video_path.exists():
        print(f"Missing source video: {video_path}", file=sys.stderr)
        return 1

    frames = load_source_frames(video_path)
    crop_roi = frames[:, ROI_Y0:ROI_Y1, ROI_X0:ROI_X1]
    lum_roi = (
        0.299 * crop_roi[..., 0]
        + 0.587 * crop_roi[..., 1]
        + 0.114 * crop_roi[..., 2]
    )

    wheels = detect_wheels(lum_roi)
    masks = build_static_masks(wheels)

    rgba_roi_frames = [
        extract_frame_rgba(crop_roi[i], lum_roi[i], masks)
        for i in range(FRAME_COUNT)
    ]

    crop_rect = compute_crop_rect(rgba_roi_frames)
    scaled = scale_frames_to_target(rgba_roi_frames, crop_rect)
    export_png_sequence(scaled, frames_dir)

    sheet = build_sprite_sheet(scaled)
    webp_mode, sheet_bytes, poster_bytes = encode_webp_assets(
        sheet, scaled[0], sheet_path, poster_path
    )

    if args.verify_dir is not None:
        render_verification_sheets(sheet_path, args.verify_dir)

    print(f"Wheels detected: {wheels}")
    print(f"Union crop rect (1080p): x=[{crop_rect[0]}..{crop_rect[1]}), y=[{crop_rect[2]}..{crop_rect[3]}) ({crop_rect[1]-crop_rect[0]}x{crop_rect[3]-crop_rect[2]})")
    print(f"Exported {FRAME_COUNT} RGBA PNGs to {frames_dir} ({CELL_W}x{CELL_H})")
    print(f"Sprite sheet: {sheet_path} ({SHEET_W}x{SHEET_H}, {webp_mode}, {sheet_bytes} bytes)")
    print(f"Poster image: {poster_path} ({CELL_W}x{CELL_H}, {poster_bytes} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
