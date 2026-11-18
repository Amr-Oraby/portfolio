#!/usr/bin/env python3
"""Extract, clean, and pack the 55-frame Hero typing skeleton sprite sheet.

Reads frames [4..58] (0-indexed, native 24 fps, 2.292s forward loop) from
`public/hero-vid.mp4` inside the tight character ROI, removes the white
exterior background, strips the enclosed triangular background pocket (P1)
between the left arm, shirt torso, right hand, and laptop lid on all 55 frames,
removes isolated compression debris (< 25 px), applies a zero-halo 2-step
geodesic anti-aliased skirt, and exports:
  - frames/hero-typing/frame-1.png .. frames/hero-typing/frame-55.png (220x274 RGBA)
  - public/images/skeleton-hero-typing-sheet.v1.webp (1824x1974, 8x7, 4px gutters)
  - public/images/skeleton-hero-typing-poster.v1.webp (220x274 palette-matched frame 1)

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


START_FRAME = 4
END_FRAME = 58
FRAME_COUNT = END_FRAME - START_FRAME + 1  # 55

CELL_W = 220
CELL_H = 274
GUTTER = 4
STRIDE_W = CELL_W + 2 * GUTTER  # 228
STRIDE_H = CELL_H + 2 * GUTTER  # 282
COLS = 8
ROWS = 7
SHEET_W = COLS * STRIDE_W  # 1824
SHEET_H = ROWS * STRIDE_H  # 1974

# Tight working ROI covering typing subject + generous padding while excluding 3 tiny frame-corner H.264 specks
ROI_X0, ROI_X1 = 640, 1290
ROI_Y0, ROI_Y1 = 115, 915


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


def compute_ext_bg(
    lum: np.ndarray,
    frame_idx: int,
    bg_med: float,
    ext_lum: float,
    scanline_ccl,
) -> np.ndarray:
    """4-border exterior flood-fill with padded pure-background ring."""
    pad_lum = np.pad(lum, ((1, 1), (1, 1)), mode="constant", constant_values=bg_med)
    lbl, _ = scanline_ccl(pad_lum >= ext_lum)
    bg_id = int(lbl[0, 0])
    assert bg_id > 0, f"Border seed failed on frame {START_FRAME + frame_idx}"
    return (lbl == bg_id)[1:-1, 1:-1]


def clear_p1_pockets(
    lum: np.ndarray,
    ext_bg: np.ndarray,
    scanline_ccl,
) -> tuple[np.ndarray, int]:
    """Clear the enclosed P1 background pocket (and pinched sub-pocket) between arm, torso, and laptop lid."""
    bg_comp = ext_bg.copy()
    bright_enclosed = (lum >= 232.0) & (~ext_bg)
    lbl_b, n_b = scanline_ccl(bright_enclosed)
    if n_b == 0:
        return bg_comp, 0

    ys, xs = np.where(lbl_b > 0)
    ids = lbl_b[ys, xs]
    areas = np.bincount(lbl_b.ravel(), minlength=n_b + 1)

    sum_x = np.bincount(ids, weights=xs, minlength=n_b + 1)
    sum_y = np.bincount(ids, weights=ys, minlength=n_b + 1)
    max_x = np.full(n_b + 1, -1, dtype=np.int32)
    max_y = np.full(n_b + 1, -1, dtype=np.int32)
    np.maximum.at(max_x, ids, xs)
    np.maximum.at(max_y, ids, ys)

    cx = sum_x / np.maximum(1, areas) + ROI_X0
    cy = sum_y / np.maximum(1, areas) + ROI_Y0
    gx_max = max_x + ROI_X0
    gy_max = max_y + ROI_Y0

    comp_ids = np.arange(n_b + 1)
    is_main_p1 = (
        (comp_ids > 0)
        & (cx >= 966.0)
        & (cx <= 996.0)
        & (cy >= 610.0)
        & (cy <= 650.0)
        & (gx_max >= 988)
        & (areas >= 350)
    )
    is_sub_p1 = (
        (comp_ids > 0)
        & (cx >= 940.0)
        & (cx <= 958.0)
        & (cy >= 652.0)
        & (cy <= 670.0)
        & (areas <= 160)
        & (gy_max <= 672)
    )

    p1_mask = is_main_p1 | is_sub_p1
    bg_comp |= p1_mask[lbl_b]
    return bg_comp, int(p1_mask.sum())


def process_all_frames(rgb_frames: np.ndarray, core) -> tuple[np.ndarray, dict]:
    n = rgb_frames.shape[0]
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
    pure_bg_lum = max(180.0, bg_med - 7.0)  # ~248.0
    ext_lum = max(160.0, bg_med - 25.0)     # ~230.0

    rgba_roi = np.zeros((*lum_all.shape, 4), dtype=np.uint8)
    p1_hits = 0

    for i in range(n):
        l_work = lum_all[i]
        ext_bg = compute_ext_bg(l_work, i, bg_med, ext_lum, core.scanline_ccl_4conn)
        bg_comp, hits = clear_p1_pockets(l_work, ext_bg, core.scanline_ccl_4conn)
        p1_hits += hits

        # Strip tiny isolated floating foreground debris (< 25 px)
        lbl_fg, n_fg = core.scanline_ccl_4conn(~bg_comp)
        if n_fg > 0:
            fg_areas = np.bincount(lbl_fg.ravel(), minlength=n_fg + 1)
            small_fg = (np.arange(n_fg + 1) > 0) & (fg_areas < 25)
            bg_comp |= small_fg[lbl_fg]

        # Zero-halo 2-step geodesic anti-aliased skirt (rgb = 0 on AA & transparent pixels)
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
        "p1_total_components": p1_hits,
    }


def quantize_mono(img: np.ndarray, gb: int = 15, ab: int = 15) -> tuple[np.ndarray, int]:
    """Quantize monochrome RGBA image onto a <= 256-entry palette for lossless Color Indexing."""
    g = np.round(
        0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]
    ).astype(np.int32)
    a = img[..., 3].astype(np.int32)
    g[g >= 240] = 255
    g[g <= 18] = 0
    a[a <= 8] = 0
    a[a >= 247] = 255

    sg = 255.0 / (gb - 1)
    sa = 255.0 / (ab - 1)
    gq = np.round(np.round(g / sg) * sg).clip(0, 255).astype(np.uint8)
    aq = np.round(np.round(a / sa) * sa).clip(0, 255).astype(np.uint8)

    out = np.zeros_like(img)
    out[..., 0] = gq
    out[..., 1] = gq
    out[..., 2] = gq
    out[..., 3] = aq
    out[aq == 0] = 0
    uniq = int(len(np.unique(out.view(np.uint32).ravel())))
    return out, uniq


def encode_lossless_webp(img: np.ndarray, dst: Path, core) -> int:
    dst.parent.mkdir(parents=True, exist_ok=True)
    h, w = img.shape[:2]
    tmp = dst.with_suffix(".tmp.webp")
    try:
        core.run_ffmpeg(
            [
                "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}", "-i", "pipe:0",
                "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra",
                str(tmp),
            ],
            input_bytes=img.tobytes(),
        )
        sz = int(tmp.stat().st_size)
        tmp.replace(dst)
        return sz
    finally:
        tmp.unlink(missing_ok=True)


def pack_8x7_sheet_and_poster(
    scaled: np.ndarray,
    sheet_path: Path,
    poster_path: Path,
    core,
) -> dict:
    """Pack 55 frames into an exact 8x7 grid (1824x1974 <= 2048x2048) with 4px transparent gutters."""
    sheet = np.zeros((SHEET_H, SHEET_W, 4), dtype=np.uint8)
    for i in range(FRAME_COUNT):
        r, c = i // COLS, i % COLS
        y = r * STRIDE_H + GUTTER
        x = c * STRIDE_W + GUTTER
        sheet[y : y + CELL_H, x : x + CELL_W] = scaled[i]

    pal_sheet, uniq_sheet = quantize_mono(sheet, 15, 15)
    assert uniq_sheet <= 256, f"Palette exceeded 256 RGBA entries: {uniq_sheet}"
    sheet_bytes = encode_lossless_webp(pal_sheet, sheet_path, core)

    pal_poster, uniq_poster = quantize_mono(scaled[0], 15, 15)
    assert uniq_poster <= 256, f"Poster palette exceeded 256 RGBA entries: {uniq_poster}"
    poster_bytes = encode_lossless_webp(pal_poster, poster_path, core)

    return {
        "cols": COLS,
        "rows": ROWS,
        "cell": f"{CELL_W}x{CELL_H}",
        "gutter": GUTTER,
        "stride": f"{STRIDE_W}x{STRIDE_H}",
        "sheet": f"{SHEET_W}x{SHEET_H}",
        "mode": f"palette-lossless-15x15({uniq_sheet}c)",
        "sheet_bytes": sheet_bytes,
        "poster_bytes": poster_bytes,
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

    video_path = repo_root / "public" / "hero-vid.mp4"
    frames_dir = repo_root / "frames" / "hero-typing"
    sheet_path = repo_root / "public" / "images" / "skeleton-hero-typing-sheet.v1.webp"
    poster_path = repo_root / "public" / "images" / "skeleton-hero-typing-poster.v1.webp"

    if not video_path.exists():
        print(f"Missing source video: {video_path}", file=sys.stderr)
        return 1

    vw, vh = core.get_video_dims(video_path)
    rgb = core.load_frames_rgb(video_path, START_FRAME, END_FRAME, 1, vw, vh)
    rgba_roi, stats = process_all_frames(rgb, core)

    scaled, cw, ch = core.pad_and_scale(rgba_roi, CELL_W, CELL_H)
    assert (cw, ch) == (CELL_W, CELL_H), f"Unexpected cell dims {cw}x{ch}"

    core.export_png_sequence_single_pass(scaled, frames_dir)
    pack_stats = pack_8x7_sheet_and_poster(scaled, sheet_path, poster_path, core)

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
