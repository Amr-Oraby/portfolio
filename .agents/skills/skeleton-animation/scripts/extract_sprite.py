#!/usr/bin/env python3
"""Fast generalized transparent sprite-sheet extractor for 2D line-art skeleton videos.

Uses:
  - Single-pass ffmpeg decoding (-nostdin)
  - 4-border seeded scanline RLE Union-Find CCL (~45x faster than Python deque BFS)
  - Batched PyTorch CUDA morphology (with NumPy CPU fallback)
  - Adaptive corner background thresholds (handles #FFFFFF and off-white #FBFBFB)
  - Safe symmetric transparent padding when subjects touch frame edges (y == 0)
  - Single-invocation ffmpeg PNG export + atomic .tmp.webp writes for sheet & poster
  - Packed uint32 color-count checks (assert uniq <= 256 for indexed lossless WebP)
"""

from __future__ import annotations

import argparse
import glob
import math
import os
from pathlib import Path
import subprocess
import sys
import time
import numpy as np

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


def run_ffmpeg(args: list[str], input_bytes: bytes | None = None) -> bytes:
    try:
        proc = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", *args],
            input=input_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
        return proc.stdout
    except subprocess.CalledProcessError as exc:
        err = exc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"ffmpeg failed ({' '.join(args[:6])}): {err}") from exc


def get_video_dims(video_path: Path) -> tuple[int, int]:
    proc = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x",
            str(video_path),
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    w_s, h_s = proc.stdout.decode("utf-8").strip().split("x")
    return int(w_s), int(h_s)


def load_frames_rgb(video_path: Path, start: int, end: int, step: int, w: int, h: int) -> np.ndarray:
    expr = f"between(n,{start},{end})"
    if step > 1:
        expr += f"*not(mod(n-{start},{step}))"
    raw = run_ffmpeg([
        "-i", str(video_path),
        "-vf", f"select='{expr}'",
        "-vsync", "0",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "pipe:1",
    ])
    expected_count = (end - start) // step + 1
    frame_bytes = w * h * 3
    if len(raw) != expected_count * frame_bytes:
        raise RuntimeError(f"Expected {expected_count * frame_bytes} RGB bytes, got {len(raw)}")
    return np.frombuffer(raw, dtype=np.uint8).reshape((expected_count, h, w, 3))


def scanline_ccl_4conn(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """Fast 4-connected component labeling via horizontal row-run Union-Find."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    padded = np.pad(mask.astype(np.int8), ((0, 0), (1, 1)), mode="constant", constant_values=0)
    diffs = padded[:, 1:] - padded[:, :-1]

    sy, sx = np.where(diffs == 1)
    ey, ex = np.where(diffs == -1)

    parent = [0]
    row_runs: list[list[tuple[int, int, int]]] = [[] for _ in range(h)]
    sy_list = sy.tolist()
    sx_list = sx.tolist()
    ex_list = ex.tolist()

    for y_val, s_val, e_val in zip(sy_list, sx_list, ex_list):
        lbl = len(parent)
        parent.append(lbl)
        row_runs[y_val].append((s_val, e_val, lbl))

    for y in range(1, h):
        runs = row_runs[y]
        prev = row_runs[y - 1]
        if not runs or not prev:
            continue
        j = 0
        plen = len(prev)
        for s, e, lbl in runs:
            while j < plen and prev[j][1] <= s:
                j += 1
            k = j
            while k < plen and prev[k][0] < e:
                a, b = lbl, prev[k][2]
                while parent[a] != a:
                    parent[a] = parent[parent[a]]
                    a = parent[a]
                while parent[b] != b:
                    parent[b] = parent[parent[b]]
                    b = parent[b]
                if a != b:
                    if a < b:
                        parent[b] = a
                    else:
                        parent[a] = b
                k += 1

    remap = np.arange(len(parent), dtype=np.int32)
    for i in range(1, len(parent)):
        p = parent[i]
        while parent[p] != p:
            p = parent[p]
        remap[i] = p

    dense_map = np.zeros(len(parent), dtype=np.int32)
    next_id = 1
    for i in range(1, len(parent)):
        r = int(remap[i])
        if dense_map[r] == 0:
            dense_map[r] = next_id
            next_id += 1
        dense_map[i] = dense_map[r]

    for y, runs in enumerate(row_runs):
        row_arr = labels[y]
        for s, e, lbl in runs:
            row_arr[s:e] = dense_map[lbl]

    return labels, next_id - 1


def batch_morph_and_dist(
    dark_batch: np.ndarray,
    light_batch: np.ndarray,
    ink_close_radius: int = 2,
    dist_steps: int = 24,
) -> tuple[np.ndarray, np.ndarray]:
    """Compute morphological ink closing and distance-to-barrier across all frames."""
    n, h, w = dark_batch.shape
    k = 2 * ink_close_radius + 1

    if HAS_TORCH:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        chunk_size = 12 if device.type == "cuda" else n
        try:
            closed_out = np.empty((n, h, w), dtype=bool)
            dist_out = np.empty((n, h, w), dtype=np.int16)
            with torch.no_grad():
                for s0 in range(0, n, chunk_size):
                    s1 = min(n, s0 + chunk_size)
                    cn = s1 - s0
                    dt = torch.from_numpy(dark_batch[s0:s1].astype(np.float32)).to(device).unsqueeze(1)
                    dil = F.max_pool2d(dt, kernel_size=k, stride=1, padding=ink_close_radius)
                    closed_t = (1.0 - F.max_pool2d(1.0 - dil, kernel_size=k, stride=1, padding=ink_close_radius)) > 0.5
                    closed_out[s0:s1] = closed_t.squeeze(1).cpu().numpy()
                    del dt, dil, closed_t

                    lt = torch.from_numpy(light_batch[s0:s1]).to(device).unsqueeze(1)
                    cur = (~lt).float()
                    dist_t = torch.zeros((cn, 1, h, w), dtype=torch.int16, device=device)
                    for r in range(1, dist_steps + 1):
                        nxt = F.max_pool2d(cur, kernel_size=3, stride=1, padding=1)
                        newly = (nxt > 0.5) & (cur <= 0.5) & lt
                        dist_t[newly] = r
                        cur = nxt
                        if not (lt & (cur <= 0.5)).any():
                            break
                    dist_t[lt & (cur <= 0.5)] = dist_steps + 1
                    dist_out[s0:s1] = dist_t.squeeze(1).cpu().numpy()
                    del lt, cur, dist_t
            return closed_out, dist_out
        except RuntimeError:
            if device.type == "cuda":
                torch.cuda.empty_cache()

    # NumPy CPU fallback
    def dilate1(m: np.ndarray) -> np.ndarray:
        p = np.pad(m, ((0, 0), (1, 1), (1, 1)), mode="constant", constant_values=False)
        return (
            m | p[:, :-2, 1:-1] | p[:, 2:, 1:-1] | p[:, 1:-1, :-2] | p[:, 1:-1, 2:]
            | p[:, :-2, :-2] | p[:, :-2, 2:] | p[:, 2:, :-2] | p[:, 2:, 2:]
        )

    cur = dark_batch.copy()
    for _ in range(ink_close_radius):
        cur = dilate1(cur)
    for _ in range(ink_close_radius):
        cur = ~dilate1(~cur)
    closed = cur

    bcur = ~light_batch
    dist = np.zeros((n, h, w), dtype=np.int16)
    for r in range(1, dist_steps + 1):
        nxt = dilate1(bcur)
        newly = nxt & (~bcur) & light_batch
        dist[newly] = r
        bcur = nxt
    dist[light_batch & (~bcur)] = dist_steps + 1
    return closed, dist


def dilate_8_1(mask: np.ndarray) -> np.ndarray:
    p = np.pad(mask, 1, mode="constant", constant_values=False)
    return (
        mask
        | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
        | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    )


def extract_all_frames(
    rgb_frames: np.ndarray,
    shadow_y: int | None,
    pocket_mode: str,
    min_debris_area: int,
) -> tuple[np.ndarray, dict]:
    n, h, w, _ = rgb_frames.shape
    lum = (
        0.299 * rgb_frames[..., 0]
        + 0.587 * rgb_frames[..., 1]
        + 0.114 * rgb_frames[..., 2]
    )

    corners = np.concatenate([
        lum[:, :20, :20].ravel(),
        lum[:, :20, -20:].ravel(),
        lum[:, -20:, :20].ravel(),
        lum[:, -20:, -20:].ravel(),
    ])
    bg_med = float(np.median(corners))
    pure_bg_lum = max(180.0, bg_med - 7.0)
    ext_lum = max(160.0, bg_med - 25.0)
    ink_lum = 125.0

    spread = rgb_frames.max(axis=-1).astype(np.int16) - rgb_frames.min(axis=-1).astype(np.int16)
    is_monochrome = int((spread > 15).sum()) < max(100, int(0.0001 * rgb_frames.size / 3))

    # Work inside tight ROI + 16px border safety margin (handles y=0 clips safely)
    fg_approx = lum < (bg_med - 14.0)
    any_fg = fg_approx.any(axis=0)
    ys_u, xs_u = np.where(any_fg)
    rx0 = max(0, int(xs_u.min()) - 16)
    rx1 = min(w, int(xs_u.max()) + 17)
    ry0 = max(0, int(ys_u.min()) - 16)
    ry1 = min(h, int(ys_u.max()) + 17)

    rgb_roi = rgb_frames[:, ry0:ry1, rx0:rx1]
    lum_roi = lum[:, ry0:ry1, rx0:rx1].copy()

    # Optional horizontal shadow strip (pad 1px border around ROI so 4-border flood fill reaches all sides)
    if shadow_y is not None and shadow_y > ry0:
        sy_local = shadow_y - ry0
        if sy_local < lum_roi.shape[1]:
            lum_roi[:, sy_local:, :] = bg_med

    # Pad 1px pure background ring around ROI so 4-border flood-fill always seals cleanly even if subject hits edge
    pad_lum = np.pad(lum_roi, ((0, 0), (1, 1), (1, 1)), mode="constant", constant_values=bg_med)
    pad_ext_light = pad_lum >= ext_lum

    # If a frame touches the top video border (ry0 == 0, clipped outline), seal between dark ink flanks at row 0
    if ry0 == 0:
        for i in range(n):
            ink_top = np.where(lum_roi[i, 0] < ink_lum)[0]
            if len(ink_top) >= 2:
                pad_ext_light[i, 1, int(ink_top[0]) + 1 : int(ink_top[-1]) + 2] = False

    ext_bg_list = []
    for i in range(n):
        lbl_ext, _ = scanline_ccl_4conn(pad_ext_light[i])
        bg_id = int(lbl_ext[0, 0])
        assert bg_id > 0, f"Border seed failed on frame {i}"
        ext_bg_list.append((lbl_ext == bg_id)[1:-1, 1:-1])
    ext_bg = np.stack(ext_bg_list, axis=0)

    closed_dark = None
    dmap = None
    if pocket_mode == "deep-bright":
        dark_roi = lum_roi < ink_lum
        hole_light_roi = (~dark_roi) & (~ext_bg)
        closed_dark, dmap = batch_morph_and_dist(dark_roi, hole_light_roi, ink_close_radius=2, dist_steps=24)

    rgba_roi = np.zeros((*lum_roi.shape, 4), dtype=np.uint8)
    for i in range(n):
        l_work = lum_roi[i]
        bg_comp = ext_bg[i].copy()

        if pocket_mode == "deep-bright" and closed_dark is not None and dmap is not None:
            barrier = closed_dark[i] | bg_comp
            lbl_in, n_comp = scanline_ccl_4conn(~barrier)
            if n_comp > 0:
                flat_lbl = lbl_in.ravel()
                areas = np.bincount(flat_lbl, minlength=n_comp + 1)
                mean_lum = np.bincount(flat_lbl, weights=l_work.ravel(), minlength=n_comp + 1) / np.maximum(1, areas)
                max_dist = np.zeros(n_comp + 1, dtype=np.int16)
                np.maximum.at(max_dist, flat_lbl, dmap[i].ravel())
                is_bg_pocket = (np.arange(n_comp + 1) > 0) & (areas >= 25) & (mean_lum >= pure_bg_lum - 8.0) & (max_dist >= 10)
                bg_comp |= is_bg_pocket[lbl_in]

        if min_debris_area > 0:
            lbl_fg, n_fg = scanline_ccl_4conn(~bg_comp)
            if n_fg > 0:
                fg_areas = np.bincount(lbl_fg.ravel(), minlength=n_fg + 1)
                small_fg = (np.arange(n_fg + 1) > 0) & (fg_areas < min_debris_area)
                bg_comp |= small_fg[lbl_fg]

        # Zero-halo geodesic anti-aliased skirt
        step1 = dilate_8_1(bg_comp) & (~bg_comp) & (l_work >= 35.0)
        step2 = dilate_8_1(bg_comp | step1) & (~bg_comp) & (~step1) & (l_work >= 55.0)
        outer_aa = step1 | step2
        near_fg = dilate_8_1(~bg_comp)
        bg_aa = bg_comp & near_fg & (l_work < pure_bg_lum)

        aa_band = outer_aa | bg_aa
        pure_bg = bg_comp & (~bg_aa)

        alpha = np.full(l_work.shape, 255, dtype=np.uint8)
        rgb = rgb_roi[i].astype(np.float32)

        alpha[pure_bg] = 0
        rgb[pure_bg] = 0.0

        t = np.clip((pure_bg_lum - l_work[aa_band]) / (pure_bg_lum - 35.0), 0.0, 1.0)
        alpha[aa_band] = np.round(t * 255.0).astype(np.uint8)
        rgb[aa_band] = 0.0
        rgb[alpha == 0] = 0.0

        rgba_roi[i, ..., :3] = np.round(rgb).astype(np.uint8)
        rgba_roi[i, ..., 3] = alpha

    stats = {
        "roi": [rx0, rx1, ry0, ry1],
        "bg_med": bg_med,
        "pure_bg_lum": pure_bg_lum,
        "ext_lum": ext_lum,
        "pocket_mode": pocket_mode,
        "is_monochrome": is_monochrome,
        "torch_cuda": bool(HAS_TORCH and torch.cuda.is_available()),
    }
    return rgba_roi, stats


def pad_and_scale(
    rgba_roi: np.ndarray,
    cell_w: int,
    cell_h: int | None,
) -> tuple[np.ndarray, int, int]:
    n, rh, rw, _ = rgba_roi.shape
    ys, xs = np.where((rgba_roi[..., 3] > 0).any(axis=0))
    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    span_x = max_x - min_x + 1
    span_y = max_y - min_y + 1

    if cell_h is None:
        cell_h = max(2, int(round(cell_w * span_y / span_x / 2) * 2))

    # Pad enough source pixels to clear Lanczos-3 kernel support at output edges.
    scale_ratio = max(span_x / cell_w, span_y / cell_h)
    pad = max(16, int(math.ceil(4.0 * scale_ratio)))
    target_w = span_x + 2 * pad
    target_h = int(round(target_w * cell_h / cell_w))
    if target_h < span_y + 2 * pad:
        target_h = span_y + 2 * pad
        target_w = int(round(target_h * cell_w / cell_h))

    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    x0 = int(round(cx - target_w / 2.0))
    y0 = int(round(cy - target_h / 2.0))
    x1 = x0 + target_w
    y1 = y0 + target_h

    # Clamp + transparent pad if crop exceeds ROI boundaries (e.g. y=0 clip)
    pl = max(0, -x0)
    pr = max(0, x1 - rw)
    pt = max(0, -y0)
    pb = max(0, y1 - rh)
    sx0, sx1 = max(0, x0), min(rw, x1)
    sy0, sy1 = max(0, y0), min(rh, y1)

    cropped = rgba_roi[:, sy0:sy1, sx0:sx1]
    if pl or pr or pt or pb:
        cropped = np.pad(cropped, ((0, 0), (pt, pb), (pl, pr), (0, 0)), mode="constant", constant_values=0)

    raw_out = run_ffmpeg(
        [
            "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{target_w}x{target_h}", "-i", "pipe:0",
            "-vf", f"scale={cell_w}:{cell_h}:flags=lanczos",
            "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1",
        ],
        input_bytes=cropped.tobytes(),
    )
    scaled = np.frombuffer(raw_out, dtype=np.uint8).reshape((n, cell_h, cell_w, 4)).copy()
    scaled[scaled[..., 3] == 0, :3] = 0

    border_alpha = max(
        int(scaled[:, 0, :, 3].max()),
        int(scaled[:, -1, :, 3].max()),
        int(scaled[:, :, 0, 3].max()),
        int(scaled[:, :, -1, 3].max()),
    )
    if border_alpha != 0:
        raise AssertionError(f"Frame border clipping detected: max border alpha={border_alpha}")
    return scaled, cell_w, cell_h


def export_png_sequence_single_pass(scaled: np.ndarray, frames_dir: Path) -> None:
    frames_dir.mkdir(parents=True, exist_ok=True)
    for stale in glob.glob(str(frames_dir / "frame-*.png")):
        os.remove(stale)

    n, ch, cw, _ = scaled.shape
    run_ffmpeg(
        [
            "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{cw}x{ch}", "-i", "pipe:0",
            "-compression_level", "9",
            "-start_number", "1",
            str(frames_dir / "frame-%d.png"),
        ],
        input_bytes=scaled.tobytes(),
    )


def pack_and_encode_webp(
    scaled: np.ndarray,
    gutter: int,
    sheet_path: Path,
    poster_path: Path,
    is_monochrome: bool,
    allow_4096: bool,
    benchmark_webp: bool,
) -> dict:
    n, ch, cw, _ = scaled.shape
    sw, sh = cw + 2 * gutter, ch + 2 * gutter
    cols = max(1, min(n, math.ceil(math.sqrt(n * sh / sw))))
    rows = math.ceil(n / cols)
    sheet_w, sheet_h = cols * sw, rows * sh

    max_dim = 4096 if allow_4096 else 2048
    if sheet_w > max_dim or sheet_h > max_dim:
        raise AssertionError(
            f"Sheet {sheet_w}x{sheet_h} exceeds mobile limit {max_dim}x{max_dim}; increase --step or reduce --cell-w"
        )

    sheet = np.zeros((sheet_h, sheet_w, 4), dtype=np.uint8)
    for i in range(n):
        r, c = i // cols, i % cols
        y = r * sh + gutter
        x = c * sw + gutter
        sheet[y:y + ch, x:x + cw] = scaled[i]

    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    poster_path.parent.mkdir(parents=True, exist_ok=True)

    def run_webp(img: np.ndarray, dst: Path, extra: list[str]) -> int:
        ih, iw = img.shape[:2]
        tmp = dst.with_suffix(".tmp.webp")
        try:
            run_ffmpeg(
                [
                    "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{iw}x{ih}", "-i", "pipe:0",
                    "-c:v", "libwebp", *extra, str(tmp),
                ],
                input_bytes=img.tobytes(),
            )
            sz = int(tmp.stat().st_size)
            tmp.replace(dst)
            return sz
        finally:
            tmp.unlink(missing_ok=True)

    # Fast monochrome palette quantization (<=256 unique RGBA for libwebp Color Indexing)
    def quantize_mono(img: np.ndarray, gb: int, ab: int) -> tuple[np.ndarray, int]:
        g = np.round(0.299 * img[..., 0] + 0.587 * img[..., 1] + 0.114 * img[..., 2]).astype(np.int32)
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

    mode = "lossless-exact"
    if is_monochrome and not benchmark_webp:
        # Try <=256 RGBA bins directly (15x15 = 225 max pairs, guaranteed <=256)
        pal_img, uniq = quantize_mono(sheet, 15, 15)
        assert uniq <= 256, f"Palette exceeded 256 RGBA entries: {uniq}"
        sheet_bytes = run_webp(pal_img, sheet_path, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])
        mode = f"palette-lossless-15x15({uniq}c)"
    else:
        sheet_bytes = run_webp(sheet, sheet_path, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])
        if sheet_bytes > 350 * 1024 and is_monochrome:
            pal_img, uniq = quantize_mono(sheet, 15, 15)
            assert uniq <= 256
            sheet_bytes = run_webp(pal_img, sheet_path, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])
            mode = f"palette-lossless-15x15({uniq}c)"
        elif sheet_bytes > 350 * 1024:
            sheet_bytes = run_webp(sheet, sheet_path, ["-lossless", "0", "-quality", "88", "-pix_fmt", "yuva420p"])
            mode = "lossy-q88"

    poster_bytes = run_webp(scaled[0], poster_path, ["-lossless", "1", "-compression_level", "6", "-pix_fmt", "bgra"])
    return {
        "cols": cols,
        "rows": rows,
        "cell": f"{cw}x{ch}",
        "gutter": gutter,
        "stride": f"{sw}x{sh}",
        "sheet": f"{sheet_w}x{sheet_h}",
        "mode": mode,
        "sheet_bytes": sheet_bytes,
        "poster_bytes": poster_bytes,
    }


def write_verify_sheets(sheet_path: Path, verify_dir: Path, sheet_w: int, sheet_h: int) -> None:
    verify_dir.mkdir(parents=True, exist_ok=True)
    raw = run_ffmpeg(["-i", str(sheet_path), "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"])
    decoded = np.frombuffer(raw, dtype=np.uint8).reshape((sheet_h, sheet_w, 4))
    alpha = decoded[..., 3:4].astype(np.float32) / 255.0
    rgb = decoded[..., :3].astype(np.float32)

    for fname, bg_rgb in [
        ("contact-light.png", (253, 253, 253)),
        ("contact-dark.png", (10, 10, 10)),
        ("contact-pockets.png", (255, 0, 255)),
    ]:
        bg = np.array(bg_rgb, dtype=np.float32)
        comp = np.round(rgb * alpha + bg * (1.0 - alpha)).astype(np.uint8)
        run_ffmpeg(
            ["-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{sheet_w}x{sheet_h}", "-i", "pipe:0", str(verify_dir / fname)],
            input_bytes=comp.tobytes(),
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--start", required=True, type=int)
    parser.add_argument("--end", required=True, type=int)
    parser.add_argument("--step", type=int, default=1)
    parser.add_argument("--cell-w", type=int, default=300)
    parser.add_argument("--cell-h", type=int, default=None)
    parser.add_argument("--gutter", type=int, default=4)
    parser.add_argument("--shadow-y", type=int, default=None, help="Optional Y row above which bottom shadow starts")
    parser.add_argument("--pocket-mode", choices=("none", "deep-bright"), default="none")
    parser.add_argument("--min-debris-area", type=int, default=0, help="Strip isolated foreground specks smaller than N px")
    parser.add_argument("--frames-dir", type=Path, default=Path("frames"))
    parser.add_argument("--sheet-out", required=True, type=Path)
    parser.add_argument("--poster-out", required=True, type=Path)
    parser.add_argument("--verify-dir", type=Path, default=None)
    parser.add_argument("--allow-4096", action="store_true")
    parser.add_argument("--benchmark-webp", action="store_true")
    args = parser.parse_args()

    t0 = time.perf_counter()
    vw, vh = get_video_dims(args.video)
    rgb = load_frames_rgb(args.video, args.start, args.end, args.step, vw, vh)
    rgba_roi, extract_stats = extract_all_frames(rgb, args.shadow_y, args.pocket_mode, args.min_debris_area)
    scaled, cw, ch = pad_and_scale(rgba_roi, args.cell_w, args.cell_h)
    export_png_sequence_single_pass(scaled, args.frames_dir)
    pack_stats = pack_and_encode_webp(
        scaled,
        args.gutter,
        args.sheet_out,
        args.poster_out,
        extract_stats["is_monochrome"],
        args.allow_4096,
        args.benchmark_webp,
    )
    if args.verify_dir is not None:
        sw, sh = (int(v) for v in pack_stats["sheet"].split("x"))
        write_verify_sheets(args.sheet_out, args.verify_dir, sw, sh)

    elapsed = round(time.perf_counter() - t0, 2)
    print(f"Done in {elapsed}s | extract={extract_stats} | pack={pack_stats}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
