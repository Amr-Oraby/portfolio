#!/usr/bin/env python3
"""Extract, clean, and pack the 48-frame skeleton backflip sprite sheet.

Reads frames [0..87] (0-indexed) from `public/backflip.mp4`, subsamples 48
representative frames, removes the white background, curved rotation/motion
lines (f=18..62), black ground oval and airborne shadows (f=0..87), and
enclosed background pockets while preserving
skull, ankles, toes, fingers, clavicles, ribs, vertebrae, and mid-gray far limbs,
then exports:
  - frames/backflip/frame-1.png .. frames/backflip/frame-48.png (180x204 RGBA)
  - public/images/skeleton-backflip-sheet.v3.webp (1504x1272, 8x6, 4px gutters)
  - public/images/skeleton-backflip-poster.v3.webp (180x204 from frame 1)

Reuses core ffmpeg/CCL/scaling/WebP helpers from
`.agents/skills/skeleton-animation/scripts/extract_sprite.py`.
"""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import sys
import time
import numpy as np

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


START_FRAME = 0
END_FRAME = 87
FRAME_COUNT = 48

CELL_W = 180
CELL_H = 204
GUTTER = 4
STRIDE_W = CELL_W + 2 * GUTTER  # 188
STRIDE_H = CELL_H + 2 * GUTTER  # 212
COLS = 8
ROWS = 6
SHEET_W = COLS * STRIDE_W  # 1880
SHEET_H = ROWS * STRIDE_H  # 1272

# Working ROI covering full backflip motion (x=[480..1480), y=[0..1040))
ROI_X0, ROI_X1 = 480, 1480
ROI_Y0, ROI_Y1 = 0, 1040


def load_skill_core(repo_root: Path):
    """Import reusable core helpers from the skeleton-animation skill without modifying it."""
    core_path = (
        repo_root
        / ".agents"
        / "skills"
        / "skeleton-animation"
        / "scripts"
        / "extract_sprite.py"
    )
    spec = importlib.util.spec_from_file_location("skeleton_extract_sprite", core_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load skill helper: {core_path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def make_disk_kernel(radius: int) -> np.ndarray:
    yy, xx = np.mgrid[-radius:radius + 1, -radius:radius + 1]
    return (xx * xx + yy * yy <= radius * radius + 0.5).astype(np.float32)


def disk_dilate_2d(mask: np.ndarray, radius: int) -> np.ndarray:
    """Fast circular dilation via PyTorch CUDA/CPU conv2d with NumPy fallback."""
    if radius <= 0:
        return mask.copy()
    if HAS_TORCH:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        with torch.no_grad():
            k = torch.from_numpy(make_disk_kernel(radius)).to(device).view(1, 1, 2 * radius + 1, 2 * radius + 1)
            t = torch.from_numpy(mask.astype(np.float32)).to(device).unsqueeze(0).unsqueeze(0)
            out = (F.conv2d(t, k, padding=radius) > 0.5).squeeze(0).squeeze(0).cpu().numpy()
            return out

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


def disk_erode_2d(mask: np.ndarray, radius: int) -> np.ndarray:
    return ~disk_dilate_2d(~mask, radius)


def compute_ext_bg(
    lum: np.ndarray,
    frame_idx: int,
    bg_med: float,
    ext_lum: float,
    ink_lum: float,
    scanline_ccl,
) -> np.ndarray:
    """4-border exterior flood-fill with smart y=0 sealing for skull (f=23..27) and ankles (f=36..38)."""
    pad_lum = np.pad(lum, ((1, 1), (1, 1)), mode="constant", constant_values=bg_med)
    pad_light = pad_lum >= ext_lum

    # Smart y=0 sealing (ROI_Y0 == 0)
    top_ink = lum[0] < ink_lum
    if top_ink.any():
        ink_xs = np.where(top_ink)[0]
        # Find dark runs along row 0
        breaks = np.where(np.diff(ink_xs) > 1)[0]
        run_starts = np.concatenate([[ink_xs[0]], ink_xs[breaks + 1]])
        run_ends = np.concatenate([ink_xs[breaks], [ink_xs[-1]]])

        # Gap between consecutive dark runs
        for r_idx in range(len(run_starts) - 1):
            g0 = int(run_ends[r_idx]) + 1
            g1 = int(run_starts[r_idx + 1])  # exclusive
            gap_w = g1 - g0
            # Wide cranium interior at y=0 (f=23..27: single large gap >= 80px between 2 skull walls)
            if 22 <= frame_idx <= 28 and gap_w >= 80:
                pad_light[1, g0 + 1 : g1 + 1] = False
            # Ankle/foot bone interiors at y=0 (f=28..38: <= 60px bone interiors, leave sky > 60px open)
            elif gap_w <= 60:
                pad_light[1, g0 + 1 : g1 + 1] = False

        # f=38 right ankle ink starts at y=2..3 around global x=[928..975] -> bridge rows 0..3
        if frame_idx == 38:
            lx0, lx1 = 925 - ROI_X0, 992 - ROI_X0
            near_top_ink = (lum[:4, lx0:lx1] < ink_lum).any(axis=0)
            xs_a = np.where(near_top_ink)[0]
            if len(xs_a) >= 2:
                pad_light[1, lx0 + int(xs_a[0]) + 1 : lx0 + int(xs_a[-1]) + 2] = False

    lbl, _ = scanline_ccl(pad_light)
    bg_id = int(lbl[0, 0])
    assert bg_id > 0, f"Border seed failed on frame {frame_idx}"
    return (lbl == bg_id)[1:-1, 1:-1]


def strip_motion_arcs(
    l_work: np.ndarray,
    ext_bg0: np.ndarray,
    frame_idx: int,
    bg_med: float,
    scanline_ccl,
) -> np.ndarray:
    """Remove detached and touching curved rotation/motion lines on f=18..62."""
    if not (18 <= frame_idx <= 62):
        return l_work

    ext_mask = ext_bg0
    # On f=30..31, the upper rotation arc closes a loop against the arm & skull, trapping a large sky bubble
    # (f=30: area ~18.8k, y=[55..251]; f=31: area ~26.5k, y=[62..288]). Open it first so R=5 severs the arc cleanly.
    if frame_idx in (30, 31):
        inner_sky = (~ext_bg0) & (l_work >= bg_med - 18.0)
        lbl_s, n_s = scanline_ccl(inner_sky)
        if n_s > 0:
            ys_s, xs_s = np.where(lbl_s > 0)
            ids_s = lbl_s[ys_s, xs_s]
            areas_s = np.bincount(lbl_s.ravel(), minlength=n_s + 1)
            min_y_s = np.full(n_s + 1, l_work.shape[0], dtype=np.int32)
            np.minimum.at(min_y_s, ids_s, ys_s)
            is_bubble = (
                (np.arange(n_s + 1) > 0)
                & (areas_s >= 14000)
                & (areas_s <= 29000)
                & (min_y_s <= 80)
            )
            if is_bubble.any():
                ext_mask = ext_bg0 | is_bubble[lbl_s]

    fg_sil0 = ~ext_mask
    core = disk_erode_2d(fg_sil0, 5)
    opened = disk_dilate_2d(core, 7) & fg_sil0
    removed = fg_sil0 & (~opened)
    if not removed.any():
        return l_work

    opened_near = disk_dilate_2d(opened, 1)
    lbl_rem, n_rem = scanline_ccl(removed)
    if n_rem == 0:
        return l_work

    h, w = l_work.shape
    flat_lbl = lbl_rem.ravel()
    areas = np.bincount(flat_lbl, minlength=n_rem + 1)

    ys, xs = np.where(lbl_rem > 0)
    ids = lbl_rem[ys, xs]

    min_x = np.full(n_rem + 1, w, dtype=np.int32)
    max_x = np.full(n_rem + 1, -1, dtype=np.int32)
    min_y = np.full(n_rem + 1, h, dtype=np.int32)
    max_y = np.full(n_rem + 1, -1, dtype=np.int32)
    np.minimum.at(min_x, ids, xs)
    np.maximum.at(max_x, ids, xs)
    np.minimum.at(min_y, ids, ys)
    np.maximum.at(max_y, ids, ys)

    touches = np.zeros(n_rem + 1, dtype=bool)
    np.logical_or.at(touches, ids, opened_near[ys, xs])

    diags = np.hypot(max_x - min_x + 1, max_y - min_y + 1)
    idx_arr = np.arange(n_rem + 1)
    # Remove detached arc pieces (>= 10 px) or long touching arcs (>= 100 px and diag >= 35 px).
    # Protects stubby fingertips (e.g. f=38 [11x8, area=61]) and ankle caps.
    is_arc = (idx_arr > 0) & (
        ((~touches) & (areas >= 10))
        | (touches & (areas >= 100) & (diags >= 35.0))
    )

    if is_arc.any():
        arc_mask = is_arc[lbl_rem]
        # Also clear 1px anti-aliased fringe of removed arcs without touching opened skeleton body
        arc_fringe = disk_dilate_2d(arc_mask, 1) & (~opened)
        l_work = l_work.copy()
        l_work[arc_mask | arc_fringe] = bg_med
    return l_work


def strip_ground_oval(
    l_work: np.ndarray,
    ext_bg: np.ndarray,
    frame_idx: int,
    bg_med: float,
    ext_lum: float,
    scanline_ccl,
) -> np.ndarray:
    """Remove black ground oval and airborne shadows while preserving rounded toes/soles."""
    h, w = l_work.shape
    fg_sil = ~ext_bg
    lbl_fg, n_fg = scanline_ccl(fg_sil)
    if n_fg == 0:
        return l_work

    flat_fg = lbl_fg.ravel()
    areas = np.bincount(flat_fg, minlength=n_fg + 1)
    main_id = int(np.argmax(areas[1:]) + 1)
    main_mask = lbl_fg == main_id

    l_out = l_work.copy()

    # 1. Strip any disconnected bottom component with y_min >= 935 (airborne shadows f=26..35, 39..48)
    ys_all, xs_all = np.where(lbl_fg > 0)
    ids_all = lbl_fg[ys_all, xs_all]
    min_y_fg = np.full(n_fg + 1, h, dtype=np.int32)
    np.minimum.at(min_y_fg, ids_all, ys_all)
    drop_bot = (np.arange(n_fg + 1) > 0) & (np.arange(n_fg + 1) != main_id) & (min_y_fg >= 935)
    if drop_bot.any():
        drop_mask = drop_bot[lbl_fg]
        l_out[disk_dilate_2d(drop_mask, 2) & (~main_mask)] = bg_med

    # 2. If airborne (main skeleton does not reach y >= 942), clear faint ground shadow residues
    if not main_mask[942:, :].any():
        pale_shadow = (np.arange(h)[:, None] >= 940) & (l_out < 246.0) & (~main_mask)
        l_out[pale_shadow] = bg_med
        return l_out

    # 3. Grounded frame: span the full oval horizontal bounds across y >= 928
    dark_band = (l_out[935:1025, :] < 40.0) & main_mask[935:1025, :]
    dy_b, dx_b = np.where(dark_band)
    if len(dx_b) < 40:
        return l_out

    x_min_o, x_max_o = float(dx_b.min()), float(dx_b.max())
    xc = (x_min_o + x_max_o) / 2.0

    yy, xx = np.mgrid[0:h, 0:w]
    in_oval_box = (yy >= 928) & (xx >= x_min_o - 30.0) & (xx <= x_max_o + 30.0)

    # 4. Reconstruct rounded 6px black sole outlines around genuine light foot & lower-ankle interiors.
    # Enclosed between-leg pockets are cleared afterwards in clear_enclosed_pockets() so tilted feet are never eroded.
    deep_fg = disk_erode_2d(main_mask, 3)
    foot_light = (
        deep_fg
        & (l_out >= 115.0)
        & (yy >= 908)
        & (yy <= 998)
    )
    lbl_fl, n_fl = scanline_ccl(foot_light)
    if n_fl > 0:
        fl_areas = np.bincount(lbl_fl.ravel(), minlength=n_fl + 1)
        leg_xs = np.where(main_mask[840:920, :].any(axis=0))[0]
        if len(leg_xs) > 0:
            lx_min = float(leg_xs.min()) - 60.0
            lx_max = float(leg_xs.max()) + 60.0
        else:
            lx_min, lx_max = xc - 180.0, xc + 180.0
        valid_fl = (np.arange(n_fl + 1) > 0) & (fl_areas >= 30)
        foot_light = valid_fl[lbl_fl] & (xx >= lx_min) & (xx <= lx_max)

    foot_keep = disk_dilate_2d(foot_light, 6)
    strip_oval = in_oval_box & (~foot_keep)
    l_out[strip_oval] = bg_med
    return l_out


def count_interior_holes(mask: np.ndarray, scanline_ccl) -> int:
    """Count enclosed background holes inside a foreground binary component."""
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    sub = np.pad(mask[y0 : y1 + 1, x0 : x1 + 1], ((1, 1), (1, 1)), mode="constant", constant_values=False)
    lbl, n_comp = scanline_ccl(~sub)
    ext_id = int(lbl[0, 0])
    areas = np.bincount(lbl.ravel(), minlength=n_comp + 1)
    idx = np.arange(n_comp + 1)
    return int(((idx > 0) & (idx != ext_id) & (areas >= 15)).sum())


def clear_enclosed_pockets(
    l_work: np.ndarray,
    ext_bg: np.ndarray,
    frame_idx: int,
    bg_med: float,
    ext_lum: float,
    ink_lum: float,
    scanline_ccl,
) -> tuple[np.ndarray, np.ndarray]:
    """Remove trapped background pockets between limbs and residual leg-gap motion lines."""
    # Geodesic reach from ext_bg only through dark ink lines (never crosses solid bone fill >= 165)
    ink_or_ext = ext_bg | (l_work < 165.0)
    ext_ink_reach = ext_bg.copy()
    for _ in range(18):
        ext_ink_reach = disk_dilate_2d(ext_ink_reach, 1) & ink_or_ext
    ext_reach3 = disk_dilate_2d(ext_ink_reach, 3)

    # Chest-cavity dark fill reachability to protect ribs, sternum, and clavicles
    chest_seed = disk_erode_2d((~ext_bg) & (l_work < 35.0), 4)
    lbl_c, n_c = scanline_ccl(chest_seed)
    if n_c > 0:
        ca = np.bincount(lbl_c.ravel(), minlength=n_c + 1)
        chest_seed = ((np.arange(n_c + 1) > 0) & (ca >= 25))[lbl_c]
    chest_reach = chest_seed.copy()
    dark_space = (~ext_bg) & (l_work < 155.0)
    for _ in range(9):
        chest_reach = disk_dilate_2d(chest_reach, 1) & dark_space
    chest_reach2 = disk_dilate_2d(chest_reach, 2)

    # Major solid-gray far limbs (>= 400 px; excludes small neck vertebrae/joint shading)
    gray_fill = (~ext_bg) & (l_work >= 150.0) & (l_work <= 218.0)
    solid_gray = disk_erode_2d(gray_fill, 2)
    lbl_g, n_g = scanline_ccl(solid_gray)
    if n_g > 0:
        ga = np.bincount(lbl_g.ravel(), minlength=n_g + 1)
        big_gray = ((np.arange(n_g + 1) > 0) & (ga >= 400))[lbl_g]
    else:
        big_gray = solid_gray
    big_gray_near14 = disk_dilate_2d(big_gray, 14)

    # Direct white-to-gray shading reach without an intervening ink barrier (protects vertebrae/pelvis)
    sg_reach = solid_gray.copy()
    free_space = (~ext_bg) & (~(l_work < 140.0))
    for _ in range(5):
        sg_reach = disk_dilate_2d(sg_reach, 1) & free_space

    bright = (~ext_bg) & (l_work >= 232.0)
    lbl, n_br = scanline_ccl(bright)
    pockets = np.zeros_like(ext_bg)
    if n_br > 0:
        areas = np.bincount(lbl.ravel(), minlength=n_br + 1)
        for cid in range(1, n_br + 1):
            area = int(areas[cid])
            if area < 280:
                continue
            comp = lbl == cid
            if count_interior_holes(comp, scanline_ccl) > 0:
                continue
            border = disk_dilate_2d(comp, 1) & (~comp)
            bc = max(1, int(border.sum()))
            bg_frac = float((border & big_gray_near14).sum()) / bc
            direct_gray = float((border & sg_reach).sum()) / bc
            ext_ink_frac = float((border & ext_reach3).sum()) / bc
            chest_frac = float((border & chest_reach2).sum()) / bc
            if direct_gray > 0.05 or bg_frac < 0.14:
                continue

            ys, _ = np.where(comp)
            y_min = int(ys.min())
            is_top_ankle_gap = (
                (36 <= frame_idx <= 38)
                and (y_min <= 40)
                and (area >= 800)
                and (ext_ink_frac <= 0.18)
                and (chest_frac == 0.0)
            )
            is_main_pocket = (
                (ext_ink_frac <= 0.08)
                and (
                    area >= 1800
                    or (chest_frac < 0.21 and (area >= 290 or bg_frac >= 0.75))
                )
            )
            if is_top_ankle_gap or is_main_pocket:
                pockets |= comp

    l_out = l_work.copy()
    if pockets.any():
        l_out[pockets] = bg_med

    # Clean horizontal motion lines inside cleared between-leg pockets and outer leg whiskers on landing (f=47..54)
    if 47 <= frame_idx <= 54:
        if pockets.any():
            has_above = np.zeros_like(pockets)
            has_below = np.zeros_like(pockets)
            for dy in range(1, 8):
                has_above[dy:, :] |= pockets[:-dy, :]
                has_below[:-dy, :] |= pockets[dy:, :]
            h_bridge = has_above & has_below & (~pockets) & (~ext_bg)
            lbl_hb, n_hb = scanline_ccl(h_bridge)
            for hid in range(1, n_hb + 1):
                hm = lbl_hb == hid
                hy, _ = np.where(hm)
                if int(hy.max() - hy.min() + 1) <= 10:
                    l_out[disk_dilate_2d(hm, 1) & (disk_dilate_2d(pockets, 2) | hm)] = bg_med

        ext_cur = compute_ext_bg(l_out, frame_idx, bg_med, ext_lum, ink_lum, scanline_ccl)
        fg_cur = ~ext_cur
        opened3 = disk_dilate_2d(disk_erode_2d(fg_cur, 3), 4) & fg_cur
        spurs = fg_cur & (~opened3)
        spurs[:700, :] = False
        lbl_sp, n_sp = scanline_ccl(spurs)
        for sid in range(1, n_sp + 1):
            sm = lbl_sp == sid
            sy, sx = np.where(sm)
            bw = int(sx.max() - sx.min() + 1)
            bh = int(sy.max() - sy.min() + 1)
            if bh <= 7 and bw >= 4:
                l_out[disk_dilate_2d(sm, 1) & (~opened3)] = bg_med

    bg_final = compute_ext_bg(l_out, frame_idx, bg_med, ext_lum, ink_lum, scanline_ccl)
    bg_final |= pockets
    return l_out, bg_final


def process_all_frames(rgb_frames: np.ndarray, core) -> tuple[np.ndarray, dict]:
    n, h, w, _ = rgb_frames.shape
    roi_rgb = rgb_frames[:, ROI_Y0:ROI_Y1, ROI_X0:ROI_X1]
    lum_all = (
        0.299 * roi_rgb[..., 0]
        + 0.587 * roi_rgb[..., 1]
        + 0.114 * roi_rgb[..., 2]
    )

    corners = np.concatenate([
        lum_all[:, :20, :20].ravel(),
        lum_all[:, :20, -20:].ravel(),
        lum_all[:, -20:, :20].ravel(),
        lum_all[:, -20:, -20:].ravel(),
    ])
    bg_med = float(np.median(corners))
    pure_bg_lum = max(180.0, bg_med - 7.0)  # 247.0
    ext_lum = max(160.0, bg_med - 25.0)     # 229.0
    ink_lum = 125.0

    rgba_roi = np.zeros((*lum_all.shape, 4), dtype=np.uint8)
    for i in range(n):
        l_work = lum_all[i].copy()

        # Pass 1: Initial exterior flood-fill with smart y=0 sealing
        ext_bg0 = compute_ext_bg(l_work, i, bg_med, ext_lum, ink_lum, core.scanline_ccl_4conn)

        # Pass 2: Curved rotation/motion-line removal (f=18..62)
        l_work = strip_motion_arcs(l_work, ext_bg0, i, bg_med, core.scanline_ccl_4conn)
        ext_bg1 = compute_ext_bg(l_work, i, bg_med, ext_lum, ink_lum, core.scanline_ccl_4conn)

        # Pass 3: Ground black oval & airborne shadow removal (f=0..87)
        l_work = strip_ground_oval(l_work, ext_bg1, i, bg_med, ext_lum, core.scanline_ccl_4conn)
        ext_bg2 = compute_ext_bg(l_work, i, bg_med, ext_lum, ink_lum, core.scanline_ccl_4conn)

        # Pass 4: Enclosed limb-gap pocket & residual landing motion-line removal
        l_work, bg_comp = clear_enclosed_pockets(
            l_work, ext_bg2, i, bg_med, ext_lum, ink_lum, core.scanline_ccl_4conn
        )

        # Strip tiny isolated floating foreground debris (< 25 px)
        lbl_fg, n_fg = core.scanline_ccl_4conn(~bg_comp)
        if n_fg > 0:
            fg_areas = np.bincount(lbl_fg.ravel(), minlength=n_fg + 1)
            small_fg = (np.arange(n_fg + 1) > 0) & (fg_areas < 25)
            bg_comp |= small_fg[lbl_fg]

        # Pass 5: Zero-halo 2-step geodesic anti-aliased skirt (rgb = 0 on AA & transparent pixels)
        step1 = core.dilate_8_1(bg_comp) & (~bg_comp) & (l_work >= 35.0)
        step2 = core.dilate_8_1(bg_comp | step1) & (~bg_comp) & (~step1) & (l_work >= 55.0)
        outer_aa = step1 | step2
        near_fg = core.dilate_8_1(~bg_comp)
        bg_aa = bg_comp & near_fg & (l_work < pure_bg_lum)

        aa_band = outer_aa | bg_aa
        pure_bg = bg_comp & (~bg_aa)

        alpha = np.full(l_work.shape, 255, dtype=np.uint8)
        rgb = roi_rgb[i].astype(np.float32)

        alpha[pure_bg] = 0
        rgb[pure_bg] = 0.0

        t = np.clip((pure_bg_lum - l_work[aa_band]) / (pure_bg_lum - 35.0), 0.0, 1.0)
        alpha[aa_band] = np.round(t * 255.0).astype(np.uint8)
        rgb[aa_band] = 0.0
        rgb[alpha == 0] = 0.0

        rgba_roi[i, ..., :3] = np.round(rgb).astype(np.uint8)
        rgba_roi[i, ..., 3] = alpha

    return rgba_roi, {
        "bg_med": bg_med,
        "pure_bg_lum": pure_bg_lum,
        "ext_lum": ext_lum,
        "torch_cuda": bool(HAS_TORCH and torch.cuda.is_available()),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--verify-dir",
        type=Path,
        default=None,
        help="Optional directory for contact-light.png, contact-dark.png, contact-pockets.png.",
    )
    args = parser.parse_args()

    t0 = time.perf_counter()
    repo_root = Path(__file__).resolve().parent.parent
    core = load_skill_core(repo_root)

    video_path = repo_root / "public" / "backflip.mp4"
    frames_dir = repo_root / "frames" / "backflip"
    sheet_path = repo_root / "public" / "images" / "skeleton-backflip-sheet.v3.webp"
    poster_path = repo_root / "public" / "images" / "skeleton-backflip-poster.v3.webp"

    if not video_path.exists():
        print(f"Missing source video: {video_path}", file=sys.stderr)
        return 1

    vw, vh = core.get_video_dims(video_path)
    rgb = core.load_frames_rgb(video_path, START_FRAME, END_FRAME, 1, vw, vh)
    rgba_roi, stats = process_all_frames(rgb, core)
    source_indices = np.linspace(0, len(rgba_roi) - 1, FRAME_COUNT).round().astype(int)
    rgba_roi = rgba_roi[source_indices]

    scaled, cw, ch = core.pad_and_scale(rgba_roi, CELL_W, CELL_H)
    assert (cw, ch) == (CELL_W, CELL_H), f"Unexpected cell dims {cw}x{ch}"

    core.export_png_sequence_single_pass(scaled, frames_dir)
    pack_stats = core.pack_and_encode_webp(
        scaled,
        GUTTER,
        sheet_path,
        poster_path,
        is_monochrome=True,
        allow_4096=False,
        benchmark_webp=False,
    )
    assert pack_stats["cols"] == COLS and pack_stats["rows"] == ROWS, f"Grid mismatch: {pack_stats}"
    assert pack_stats["sheet"] == f"{SHEET_W}x{SHEET_H}", f"Sheet dim mismatch: {pack_stats}"

    # Verify zero alpha in all 4px gutters on the actual decoded WebP
    raw_dec = core.run_ffmpeg(["-i", str(sheet_path), "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"])
    dec = np.frombuffer(raw_dec, dtype=np.uint8).reshape((SHEET_H, SHEET_W, 4))
    gutter_mask = np.ones((SHEET_H, SHEET_W), dtype=bool)
    for idx in range(FRAME_COUNT):
        r, c = idx // COLS, idx % COLS
        y = r * STRIDE_H + GUTTER
        x = c * STRIDE_W + GUTTER
        gutter_mask[y : y + CELL_H, x : x + CELL_W] = False
    max_gutter_alpha = int(dec[..., 3][gutter_mask].max())
    assert max_gutter_alpha == 0, f"Non-zero gutter alpha detected: {max_gutter_alpha}"

    if args.verify_dir is not None:
        core.write_verify_sheets(sheet_path, args.verify_dir, SHEET_W, SHEET_H)

    elapsed = round(time.perf_counter() - t0, 2)
    print(f"Done in {elapsed}s | stats={stats} | pack={pack_stats} | max_gutter_alpha={max_gutter_alpha}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
