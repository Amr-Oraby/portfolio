---
name: skeleton-animation-skill
description: >-
  Complete end-to-end engineering record and reusable skill playbook for the
  skeleton animation pipeline (riding.mp4 -> TechMarquee + RidingSkeleton),
  including the modularized Antigravity skill at .agents/skills/skeleton-animation/.
---

# Skeleton Animation Skill (`skeleton-animation-skill.md`)

Complete engineering record of how we converted `public/riding.mp4` into a zero-halo transparent sprite sheet and an infinitely looping GSAP + Canvas animation on `TechMarquee`, plus the hardened, benchmarked tooling in [.agents/skills/skeleton-animation/](.agents/skills/skeleton-animation/SKILL.md) for future videos (`public/backflip.mp4`, `public/skeleton-vid.mp4`, and beyond).

> **Token-Saving Tip for Agents:** For routine execution on new videos, load the modular Antigravity skill at [.agents/skills/skeleton-animation/SKILL.md](.agents/skills/skeleton-animation/SKILL.md) and its helper scripts (`probe_video.py`, `extract_sprite.py`) instead of re-reading this full case-study document. Never read root `*-report.json` Lighthouse files or recurse into `node_modules`.

---

## 1. End-to-End Architecture

```text
Raw MP4 (1920x1080, 24fps, yuv420p, no alpha, AAC audio)
  │
  ▼ [1] Probe (scripts/probe_video.py: ffprobe + ffmpeg gray pipe -> numpy, ~1.4-2.2s)
  │     • Native FPS, corner bg_lum, chroma spread, y=0 border touches, shadow profile
  │     • Duplicate hold trim, loop-seam matrix (frame[e] vs frame[s-1]), archetype, 2048px grid fit
  │
  ▼ [2] Extract & Pack (scripts/extract_sprite.py / extract-riding-frames.py)
  │     • Scanline RLE Union-Find CCL + batched PyTorch CUDA morphology (or NumPy CPU fallback)
  │     • 4-border flood-fill (with y=0 ink seal) -> pocket cleanup -> geodesic AA skirt (rgb=0)
  │     • Adaptive Lanczos padding -> single-pass PNG export -> 4px-gutter WebP sheet + poster
  │     • Visually inspect contact-light (#FDFDFD), contact-dark (#0A0A0A), contact-pockets (#FF00FF)
  │
  ▼ [3] Next.js 16 + GSAP + Canvas Integration
  │     • Server Component wrapper (overflow-x-clip) + "use client" <canvas> lane (-translate-y-*)
  │     • Loader MutationObserver (subtree: false) + dual IntersectionObservers + retry/poster fallback
  │     • gsap.matchMedia() loop (pre-declared let nextTween) + monotonic distance frame sync + ResizeObserver
  │
  ▼ [4] Isolated Verification
        • tsc --noEmit -> eslint -> vitest run -> playwright test on isolated port 3099
```

---

## 2. Exact Case Study: `public/riding.mp4` -> `TechMarquee` + `RidingSkeleton`

### 2.1 Environment & Tools Verified
- **Repo Stack**: Next.js `16.2.12` (Turbopack), React `19.2.4`, TypeScript `5`, Tailwind CSS `v4`, `gsap` `3.15.1`, `vitest` `4.1.12`, `@playwright/test` `1.65.1`.
- **Media & Compute Tools**: `ffmpeg` / `ffprobe` (`8.1.2`), Python `3.14.6` with `numpy==2.5.1` and `torch==2.11.0+cu128` (CUDA available). Because `PIL`, `cv2`, `rembg`, `pngquant`, and `sharp` were not installed, raw `rgb24`/`rgba` byte streams were piped directly between `ffmpeg` (`-nostdin`) and `numpy`/`torch`.

### 2.2 Step-by-Step Build Process
1. **Git Hygiene & Branching**:
   - Checked `git status` and branch ancestry: `main` (`79d34df`) was 1 commit *ahead* of `animation-skeleton` (`9db674e`), and `public/riding.mp4`, `public/backflip.mp4`, and `public/skeleton-vid.mp4` (`6.14 MiB`) were untracked.
   - Created `feature/skeleton-riding-marquee` from `main` and updated [.gitignore](.gitignore) to ignore `public/*.mp4`, `/frames/`, `/test-results/`, and `/playwright-report/`.
2. **Parallel Subagent Investigation & Adversarial Plan Review**:
   - Video, Frontend/GSAP, and Performance subagents plus an Adversarial Plan Reviewer surfaced 6 blocking issues before implementation:
     - `riding.mp4` is **24.0 FPS** (`72` frames, `3.00s`), so `fps=50` creates `150` frames with uneven `2:2:...:3` duplication (`2.08x` RAM/bytes, zero extra motion, micro-judder).
     - Bones, skull, and tires are `#F8F8F8`–`#FFFFFF` (identical to `#FFFFFF`), so `colorkey`/`lumakey` punches holes through the skeleton.
     - Ground shadow sits at `y = 853..866`, while white tire interiors reach `y = 850..858` in `52/72` frames — blind `y >= 848` slicing decapitates both tires.
     - Frame `71 -> 0` jumps (`6px+` skull snap). Comparing `frame[e]` to `frame[s-1]` yielded `[4..31]` (`28` frames, `1.167 s`, `0.56x` step MSE).
     - `next/dynamic(..., { ssr: false })` inside a Server Component (`TechMarquee.tsx`) is illegal in Next.js 16.
     - Tailwind v4 `-translate-y-*` compiles to CSS `translate`, colliding with GSAP's `x` `transform` if placed on the same DOM element.
3. **Asset Extraction ([scripts/extract-riding-frames.py](scripts/extract-riding-frames.py))**:
   - Extracted frames `[4..31]`, fit front/rear wheel hubs and inner/outer tire circles, preserved rounded wheel bottoms before stripping `y >= 852` shadow wings, ran exterior flood-fill, cleaned enclosed bike/spoke/arm pockets while preserving spokes and knuckles, and applied a 2-step geodesic anti-aliased skirt (`rgb = 0` on AA pixels).
   - Cropped union bbox `710x677` -> Lanczos scaled to `300x286` -> exported `frames/frame-1.png`..`frame-28.png` and packed `public/images/skeleton-riding-sheet.v1.webp` (`2156x1176`, `7x4` grid, **`4px` transparent gutters** -> `308x294` stride, lossless indexed `palette-lossless-17x17(171c)`, **`274,996 bytes` / `268.5 KiB`**) + `public/images/skeleton-riding-poster.v1.webp` (`300x286`, **`41,188 bytes` / `40.2 KiB`**).
   - Visually verified `contact-light.png` (`#FDFDFD`) and `contact-dark.png` (`#0A0A0A`) via `read_file` with `max(gutter_alpha) == 0` and `max(border_alpha) == 0`.
4. **Frontend, Resilience & Caching**:
   - Refactored [components/TechMarquee.tsx](components/TechMarquee.tsx) (kept Server Component) into an `aria-hidden="true"` `overflow-x-clip` outer wrapper + inner `overflow-hidden` marquee strip + `<RidingSkeleton />` sibling.
   - Implemented [components/animations/RidingSkeleton.tsx](components/animations/RidingSkeleton.tsx) (`"use client"`):
     - Separates `-translate-y-[calc(100%-2px)]` on the lane `div` from GSAP `x` on `<canvas width={300} height={286}>` (`w-[76px] sm:w-[88px] md:w-[98px] lg:w-[108px]`, `dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]`).
     - Uses `useSyncExternalStore` for `navigator.connection?.saveData` static `<Image unoptimized>` fallback (keeps animation active regardless of OS `prefers-reduced-motion`, matching `TechMarquee` and `PeekingSkeleton`).
     - Observes `initialLoaderEl.parentElement ?? document.body` (`subtree: false`) + dual `IntersectionObserver` (`900px` preload, `120px` visibility pause) + `visibilitychange` + retry backoff (`[1000, 3000]` ms + `"online"` listener + static poster fallback on exhaustion).
     - Drives horizontal crossing via `gsap.matchMedia()` (`135 px/s` desktop, `95 px/s` mobile), syncing sprite frame to monotonic `progress`-delta distance (`CYCLE_RATIO = 0.92`, derived from wheel circumference `~784px / 710px` crop, scaled by `riderWidth`) with `ResizeObserver` width-only rebuilds (`isRestoring` guard + `context.add`).
   - Added `Cache-Control: public, max-age=31536000, immutable` in [next.config.ts](next.config.ts) for exact versioned `.v1.webp` paths.
5. **Testing & E2E**:
   - Added [vitest.config.mts](vitest.config.mts), [vitest.setup.ts](vitest.setup.ts), and [RidingSkeleton.test.tsx](components/animations/__tests__/RidingSkeleton.test.tsx) (`6` tests covering wrapper integration, `saveData` fallback, `prefers-reduced-motion` animation continuity, loader gating + GSAP `fromTo`, `visibilitychange` pause + `unmount` cleanup, and decode retry -> poster fallback), plus [build-and-assets.test.ts](components/animations/__tests__/build-and-assets.test.ts) (`3` tests covering asset size budgets, orphaned asset removal, and immutable cache headers).
   - Added [playwright.config.ts](playwright.config.ts) (`127.0.0.1:3099`, `reuseExistingServer: false`), [riding-skeleton.spec.ts](e2e/riding-skeleton.spec.ts) (`5` tests), and [performance-build.spec.ts](e2e/performance-build.spec.ts) (`4` tests covering above-the-fold Hero LCP isolation, full-page zero 4xx/5xx + immutable headers, zero CLS / rAF cadence / zero long tasks, and off-screen pause/resume).

---

## 3. Adversarial Challenge Upgrades Built Into `.agents/skills/skeleton-animation/`

After building Draft v1, an adversarial challenge agent benchmarked the pipeline against `riding.mp4`, `backflip.mp4` (`91f`), and `skeleton-vid.mp4` (`50f`), catching and driving 5 major upgrades:

1. **Speed (50.5s baseline -> 44.14s verified for 88f 1001x1038 `backflip.mp4`)**:
   - Replaced pure-Python `deque` BFS (`40.4s` on 28f) with vectorized scanline RLE Union-Find CCL (`scanline_ccl_4conn`).
   - Replaced sequential CPU distance/morph loops with chunked PyTorch CUDA `F.max_pool2d` (`chunk_size=12`, automatic CPU fallback).
   - Replaced 28 separate `ffmpeg` spawns (`1.47s`) with single-pass `-f image2` export (`0.11s`), `uint32`-packed `np.unique` (`5.19s` -> `~0.03s`), and adaptive Lanczos padding (`max(16, ceil(4 * scale_ratio))`).
2. **Generalization Beyond `riding.mp4`**:
   - Probed `backflip.mp4` (`13` frames touching `y=0`, `370.7px` vertical drift, trailing static hold `f88..90`, ground oval) and `skeleton-vid.mp4` (`#FBFBFB` `corner_med=252` background, leading hold `f0..5`, `986px` tall portrait).
   - `probe_video.py` runs in `1.4s–2.2s` and automatically classifies motion archetype, computes adaptive `bg_lum` thresholds, detects `y=0` edge touches, filters duplicate holds out of loop scoring, and checks `<= 2048x2048` mobile sheet constraints.
   - `extract_sprite.py` adds `ry0 == 0` top-ink sealing (proven across all `f23..f27` skulls in `backflip.mp4`), `--pocket-mode none` safe default (preventing skull erasure on non-bike videos), atomic `.tmp.webp` writes for both sheet and poster, `assert uniq <= 256`, and magenta `contact-pockets.png` verification.
3. **Runtime Resilience**:
   - Added retry backoff (`1s`, `3s`), `"online"` event recovery, static poster fallback on exhausted retries, early `!ctx` check, `pendingImg.src = ""` abort on unmount, and `subtree: false` loader observation.
4. **Token Efficiency**:
   - Consolidated reusable tooling into `.agents/skills/skeleton-animation/` (`SKILL.md`, `scripts/probe_video.py`, `scripts/extract_sprite.py`, `references/frontend-gsap.md`, `references/testing-e2e.md`) following `agy-customizations/docs/skills.md` progressive disclosure.
5. **Real-Browser Pitfalls Documented**:
   - `let nextTween` pre-declaration before `gsap.fromTo`; isolated Playwright port `3099` (`reuseExistingServer: false`) avoiding port `3000` dev-server cache corruption; exact versioned paths in `next.config.ts` avoiding `path-to-regexp` crash on `-:slug*`.
