#!/usr/bin/env python3
"""Single-pass JSON video analyzer for skeleton sprite-sheet extraction.

Inspects any MP4/MOV via ffprobe + single ffmpeg gray pipe (plus 3-frame RGB
chroma check) without writing temporary files, outputting a compact JSON summary
for skeleton-animation workflows.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import time
from pathlib import Path
import numpy as np


def run_cmd(cmd: list[str]) -> bytes:
    try:
        proc = subprocess.run(
            cmd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return proc.stdout
    except subprocess.CalledProcessError as exc:
        err = exc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Command failed ({' '.join(cmd[:4])}): {err}") from exc


def probe_metadata(video_path: Path) -> dict:
    raw = run_cmd([
        "ffprobe", "-v", "error",
        "-show_format", "-show_streams", "-of", "json",
        str(video_path),
    ])
    info = json.loads(raw.decode("utf-8"))
    vstream = next(s for s in info["streams"] if s["codec_type"] == "video")
    astream = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)

    num, den = (int(x) for x in vstream["avg_frame_rate"].split("/"))
    fps = round(num / den, 4) if den else 0.0
    pix_fmt = vstream["pix_fmt"]

    return {
        "file": video_path.name,
        "bytes": int(info["format"]["size"]),
        "codec": vstream["codec_name"],
        "pix_fmt": pix_fmt,
        "has_alpha": ("rgba" in pix_fmt) or ("yuva" in pix_fmt) or ("bgra" in pix_fmt),
        "width": int(vstream["width"]),
        "height": int(vstream["height"]),
        "fps": fps,
        "duration_s": round(float(vstream["duration"]), 4),
        "nb_frames": int(vstream.get("nb_frames") or round(float(vstream["duration"]) * fps)),
        "has_audio": astream is not None,
    }


def load_gray_frames(video_path: Path, width: int, height: int) -> np.ndarray:
    raw = run_cmd([
        "ffmpeg", "-nostdin", "-v", "error",
        "-i", str(video_path),
        "-vsync", "0",
        "-f", "rawvideo", "-pix_fmt", "gray",
        "pipe:1",
    ])
    frame_bytes = width * height
    n = len(raw) // frame_bytes
    if n == 0 or len(raw) != n * frame_bytes:
        raise RuntimeError(f"Unexpected gray byte count {len(raw)} for {width}x{height}")
    return np.frombuffer(raw, dtype=np.uint8).reshape((n, height, width))


def sample_chroma_stats(video_path: Path, width: int, height: int, n_frames: int) -> dict:
    """Measure color saturation across start, middle, and end frames."""
    idxs = sorted({0, n_frames // 2, n_frames - 1})
    expr = "+".join(f"eq(n,{i})" for i in idxs)
    raw = run_cmd([
        "ffmpeg", "-nostdin", "-v", "error",
        "-i", str(video_path),
        "-vf", f"select='{expr}'", "-vsync", "0",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ])
    rgb = np.frombuffer(raw, dtype=np.uint8).reshape((-1, height, width, 3))
    spread = rgb.max(axis=-1).astype(np.int16) - rgb.min(axis=-1).astype(np.int16)
    return {
        "max_chroma": int(spread.max()),
        "chroma_p999": int(np.percentile(spread, 99.9)),
        "colored_pixels_gt15": int((spread > 15).sum()),
    }


def analyze_frames(gray: np.ndarray, meta: dict, chroma: dict) -> dict:
    n, h, w = gray.shape

    corners = np.concatenate([
        gray[:, :20, :20].ravel(),
        gray[:, :20, -20:].ravel(),
        gray[:, -20:, :20].ravel(),
        gray[:, -20:, -20:].ravel(),
    ])
    bg_min = int(corners.min())
    bg_med = int(np.median(corners))
    fg_thresh = min(235, max(175, bg_med - 14))

    ink = gray < 130
    non_bg = gray < fg_thresh
    mid_gray_px = int(((gray[0] >= 80) & (gray[0] <= 220)).sum())
    dark_ink_px = int((gray[0] < 80).sum())

    any_fg = non_bg.any(axis=0)
    ys_u, xs_u = np.where(any_fg)
    union_bbox = {
        "x0": int(xs_u.min()), "x1": int(xs_u.max()) + 1,
        "y0": int(ys_u.min()), "y1": int(ys_u.max()) + 1,
        "w": int(xs_u.max() - xs_u.min() + 1),
        "h": int(ys_u.max() - ys_u.min() + 1),
    }

    border_touch = {
        "top_y0_frames": int(non_bg[:, 0, :].any(axis=1).sum()),
        "bottom_frames": int(non_bg[:, -1, :].any(axis=1).sum()),
        "left_frames": int(non_bg[:, :, 0].any(axis=1).sum()),
        "right_frames": int(non_bg[:, :, -1].any(axis=1).sum()),
    }

    xs_grid = np.arange(w, dtype=np.float32)
    ys_grid = np.arange(h, dtype=np.float32)
    cx_list, cy_list, fw_list, fh_list = [], [], [], []
    for i in range(n):
        m = ink[i] if ink[i].any() else non_bg[i]
        ry = np.where(m.any(axis=1))[0]
        rx = np.where(m.any(axis=0))[0]
        fh_list.append(int(ry[-1] - ry[0] + 1))
        fw_list.append(int(rx[-1] - rx[0] + 1))
        mass = max(1.0, float(m.sum()))
        cx_list.append(float((m.sum(axis=0) * xs_grid).sum() / mass))
        cy_list.append(float((m.sum(axis=1) * ys_grid).sum() / mass))

    drift_x = round(max(cx_list) - min(cx_list), 1)
    drift_y = round(max(cy_list) - min(cy_list), 1)

    ux0, ux1 = union_bbox["x0"], union_bbox["x1"]
    uy0, uy1 = union_bbox["y0"], union_bbox["y1"]
    sub = gray[:, uy0:uy1:4, ux0:ux1:4].astype(np.float32)
    flat = sub.reshape((n, -1))
    step_mse = np.mean((flat[1:] - flat[:-1]) ** 2, axis=1)
    active_steps = step_mse[step_mse > 5.0]
    med_step_mse = float(np.median(active_steps)) if len(active_steps) else float(np.median(step_mse))

    leading_hold = 0
    while leading_hold < len(step_mse) and step_mse[leading_hold] < 5.0:
        leading_hold += 1
    trailing_hold = 0
    while trailing_hold < len(step_mse) and step_mse[len(step_mse) - 1 - trailing_hold] < 5.0:
        trailing_hold += 1

    # Inspect bottom 60px of union_bbox for horizontal ground shadows
    y_bot0 = max(0, uy1 - 60)
    bot_slice = gray[:, y_bot0:uy1, ux0:ux1]
    row_dark_frac = (bot_slice < 140).mean(axis=2)
    wide_rows = np.where(row_dark_frac.max(axis=0) > 0.25)[0] + y_bot0
    shadow_profile = []
    for y in wide_rows:
        vals = gray[:, y, ux0:ux1]
        dark_cols = (vals < 140).sum(axis=1)
        med_dark = int(np.median(vals[vals < 180])) if (vals < 180).any() else 255
        shadow_profile.append({
            "y": int(y),
            "width_min": int(dark_cols.min()),
            "width_max": int(dark_cols.max()),
            "med_lum": med_dark,
        })

    # Loop-seam candidates excluding static duplicate-hold tails
    best_loops = []
    if n >= 18 and med_step_mse > 0:
        sq = np.sum(flat * flat, axis=1, keepdims=True)
        mse_mat = (sq + sq.T - 2.0 * (flat @ flat.T)) / flat.shape[1]
        for s in range(1, n - 15):
            for e in range(s + 15, n):
                seg_activity = float(np.median(step_mse[s - 1:e]))
                if seg_activity < 0.25 * med_step_mse:
                    continue
                ratio = float(mse_mat[e, s - 1] / med_step_mse)
                best_loops.append((ratio, s, e, e - s + 1))
        best_loops.sort(key=lambda item: (round(item[0], 3), -item[3]))

    top_loops = [
        {"start": s, "end": e, "frames": ln, "duration_s": round(ln / meta["fps"], 3), "seam_ratio": round(r, 3)}
        for r, s, e, ln in best_loops[:3]
    ]

    active_end = n - 1 - trailing_hold
    active_start = leading_hold
    trim_frames = max(1, active_end - active_start + 1)

    if best_loops and best_loops[0][0] <= 0.85 and drift_x < 45 and drift_y < 45:
        archetype = "traveling-or-in-place-cycle"
        rec_start, rec_end, rec_step = top_loops[0]["start"], top_loops[0]["end"], 1
    elif drift_x < 45 and drift_y < 45 and best_loops and best_loops[0][0] <= 1.35:
        archetype = "stationary-loop-or-pingpong"
        rec_start, rec_end, rec_step = active_start, active_end, 1
    else:
        archetype = "triggered-one-shot"
        rec_start, rec_end, rec_step = active_start, active_end, 1

    # Fit sprite sheet safely within mobile 2048x2048 GPU texture limit
    gutter = 4
    aspect = union_bbox["h"] / max(1, union_bbox["w"])
    chosen_step = rec_step
    for step_try in (1, 2):
        count_try = (rec_end - rec_start) // step_try + 1
        for cw in (300, 260, 220, 180):
            ch = max(2, int(round(cw * aspect / 2) * 2))
            sw, sh = cw + 2 * gutter, ch + 2 * gutter
            cols = max(1, min(count_try, math.ceil(math.sqrt(count_try * sh / sw))))
            rows = math.ceil(count_try / cols)
            if cols * sw <= 2048 and rows * sh <= 2048:
                chosen_step = step_try
                grid_preview = {
                    "frames": count_try,
                    "step": step_try,
                    "cell": f"{cw}x{ch}",
                    "gutter": gutter,
                    "grid": f"{cols}x{rows}",
                    "sheet": f"{cols * sw}x{rows * sh}",
                    "fits_2048": True,
                }
                break
        else:
            continue
        break
    else:
        cw, ch = 160, max(2, int(round(160 * aspect / 2) * 2))
        sw, sh = cw + 2 * gutter, ch + 2 * gutter
        count_try = (rec_end - rec_start) // 2 + 1
        cols = max(1, min(count_try, math.ceil(math.sqrt(count_try * sh / sw))))
        rows = math.ceil(count_try / cols)
        chosen_step = 2
        grid_preview = {
            "frames": count_try,
            "step": 2,
            "cell": f"{cw}x{ch}",
            "gutter": gutter,
            "grid": f"{cols}x{rows}",
            "sheet": f"{cols * sw}x{rows * sh}",
            "fits_2048": cols * sw <= 2048 and rows * sh <= 2048,
        }

    return {
        "background": {
            "corner_min": bg_min,
            "corner_med": bg_med,
            "suggested_pure_bg_lum": max(180, bg_med - 7),
            "suggested_ext_lum": max(160, bg_med - 25),
            "is_monochrome": chroma["colored_pixels_gt15"] == 0,
            "mid_gray_to_ink_ratio": round(mid_gray_px / max(1, dark_ink_px), 3),
            **chroma,
        },
        "union_bbox": union_bbox,
        "border_touch": border_touch,
        "motion": {
            "median_frame_w": int(np.median(fw_list)),
            "median_frame_h": int(np.median(fh_list)),
            "centroid_drift_x": drift_x,
            "centroid_drift_y": drift_y,
            "leading_duplicate_frames": leading_hold,
            "trailing_duplicate_frames": trailing_hold,
            "active_trim": f"[{active_start}..{active_end}] ({trim_frames}f)",
        },
        "bottom_shadow_rows": shadow_profile[:10],
        "archetype": archetype,
        "recommended_range": {"start": rec_start, "end": rec_end, "step": chosen_step, "frames": grid_preview["frames"]},
        "top_loop_candidates": top_loops,
        "sprite_grid_preview": grid_preview,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path, help="Path to source MP4/MOV video")
    args = parser.parse_args()

    if not args.video.exists():
        print(f"Video not found: {args.video}", file=sys.stderr)
        return 1

    t0 = time.perf_counter()
    meta = probe_metadata(args.video)
    gray = load_gray_frames(args.video, meta["width"], meta["height"])
    chroma = sample_chroma_stats(args.video, meta["width"], meta["height"], gray.shape[0])
    analysis = analyze_frames(gray, meta, chroma)
    elapsed_s = round(time.perf_counter() - t0, 2)

    out = {
        "probe_elapsed_s": elapsed_s,
        "meta": {**meta, "decoded_frames": int(gray.shape[0])},
        **analysis,
    }
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
