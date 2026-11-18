# Implementation Plan: Skeleton Backflip Animation for `InitialLoader`

- **Branch**: `feature/skeleton-backflip-loader` (branched off `main` at `96e593f`)
- **Source Video**: `public/backflip.mp4` (`1920×1080`, `h264`, `yuv420p`, no alpha, `24.0 fps`, `91` frames `0..90`, `3.7917 s`, AAC audio)
- **Primary Skill Reference**: `.agents/skills/skeleton-animation/SKILL.md` (do **not** modify the skill or duplicate its core utilities)

---

## 1. Architecture Summary

Keep `components/animations/InitialLoader.tsx` as the `"use client"` fullscreen overlay (`#initial-loader-overlay`, `fixed inset-0 z-[9999]`, Framer Motion `AnimatePresence` exit, `document.body.style.overflow` scroll lock) so downstream `MutationObserver` gates in `RidingSkeleton.tsx` and `PeekingSkeleton.tsx` plus all existing E2E specs remain untouched.

Replace the static `/images/skull-logo.png` inside the centerpiece crosshair frame with a memoized leaf component **`components/animations/LoaderBackflipSkeleton.tsx`** (`React.memo`):
- Fixed-size stage: `w-24 h-24 sm:w-28 sm:h-28` (`96px` mobile / `112px` `sm+`, no `overflow-hidden` on inner crosshair frame so `dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]` is never clipped).
- Mobile LCP protection: `96×96` (`9,216 CSS px²`) stays strictly smaller than `HeroContent`'s `portrait.png` (`130×160 = 20,800 CSS px²`), preventing LCP hijacking.
- Immediate static underlay: renders `POSTER_SRC` (`/images/skeleton-backflip-poster.v1.webp`, `object-contain`, `onError` -> `/images/skull-logo.png`) until `<canvas>` draws frame `0`, then synchronously hides the poster wrapper (`style.display = "none"`) with zero React re-render and zero double `drop-shadow`.
- One-shot GSAP playback (`repeat: 0`) inside `gsap.context()`, holding the landed final frame until `InitialLoader` slides up and unmounts (`canvas.width = 0; canvas.height = 0; sheetImg.src = ""` for `0 MiB` VRAM overlap with `RidingSkeleton`).

---

## 2. Video Analysis & Exact Frame Timeline (`public/backflip.mp4`)

- **Background & Shading**: Monochrome grayscale (`corner_med = 254`, `#FEFEFE`). Far-side limbs/foot are mid-gray (`lum ~ 185–202`); front skull, ribs, pelvis, limbs, and front foot are white (`lum ~ 245–255`) with black outlines (`lum ~ 0–35`).
- **Per-Frame Sequence (`0..90`)**:
  - `f=0`: upright crouch-ready starting pose (already moving, `mse(0->1) = 771.78`, `0` leading duplicates).
  - `f=1..15`: anticipation crouch (`f=15` deepest crouch).
  - `f=16..25`: launch & takeoff (`f=23` skull clips `y=0`; feet touch ground oval through `f=25`).
  - `f=26..48`: airborne 360° rotation (`f=26` first separation from oval; `f=28..32` & `36..38` feet clip `y=0`; peak skull speed `83.7 px/frame`).
  - `f=49..59`: landing (`f=49`) -> landing impact crouch (`f=58..59`).
  - `f=60..73`: stand-up recovery (`f=73` upright stand).
  - `f=74..86`: arm-swing & weight settle (`f=86->87` `mse = 6.45`).
  - `f=87..90`: trailing static hold (`mse = 0.11–0.54`).
- **Selected Range**: **`[0..87]` (`88` unique frames, `step=1`)**, dropping dead static frames `88..90`.
- **Cleaned Skeleton-Only Union BBox**: `x=[550..1434], y=[0..1002]` (`885×1003`, `aspect = 1.1333`).

---

## 3. FPS, Smoothness & Sprite Sheet Contract

- **Why NOT `ffmpeg minterpolate`**: Empirical test on `f=24..49` showed `3.07×` mid-gray outline blur (`4.0×` at `f=26->27`), `-25%..-28%` ink washout, `13,670–16,439` ghost pixels around fast-spinning limbs, and sprite dimensions exceeding mobile `2048×2048`.
- **Playback Pacing**: Play all **`88` unique native frames** in **`1.45 s` (~60 fps)** — locked `1:1` to `60Hz` VSync (zero `1:1:2` judder, zero duplicated frames), crisp athletic feel, matching `InitialLoader`'s `1400ms` base ramp.
- **Exact Sprite Contract** (shared across extraction, frontend, and tests):
  - `FRAME_COUNT = 88` (`0..87`)
  - `GRID_COLS = 10`, `GRID_ROWS = 9`
  - `CELL_WIDTH = 150`, `CELL_HEIGHT = 170` (`170/150 = 1.1333`, exact match to `885×1003` bbox — zero distortion; `1.5×` Retina for `96–112px` box)
  - `GUTTER = 4` (all 4 sides) -> `STRIDE_X = 158`, `STRIDE_Y = 178`
  - `SHEET_WIDTH = 1580`, `SHEET_HEIGHT = 1602` (`<= 2048×2048`, `~9.65 MiB` decoded RGBA)
  - Size budgets: sheet `<= 250 KiB` (expected `~170–200 KiB` lossless indexed `15×15` WebP), poster `<= 25 KiB` (expected `~8–10 KiB`).
- **Asset Paths**:
  - Intermediate PNGs (gitignored via `/frames/`, isolated from `riding` PNGs): `frames/backflip/frame-1.png .. frame-88.png`
  - Runtime WebPs: `public/images/skeleton-backflip-sheet.v1.webp`, `public/images/skeleton-backflip-poster.v1.webp`
  - Immutable `Cache-Control: public, max-age=31536000, immutable` rules in `next.config.ts`.

---

## 4. Critical Background, Motion-Line & Black-Oval Cleanup Rules (`scripts/extract-backflip-frames.py`)

Reuse core helpers (`load_frames_rgb`, `scanline_ccl_4conn`, `dilate_8_1`, `pad_and_scale`, `export_png_sequence_single_pass`, `pack_and_encode_webp`, `write_verify_sheets`) from `.agents/skills/skeleton-animation/scripts/extract_sprite.py`, plus 4 verified backflip-specific passes:

1. **Smart `y=0` Top-Edge Sealing (`f=23..32, 36..38`)**:
   - Seal wide clipped cranium gaps (`>= 80 px` on `f=23..27`).
   - On `f=36..38`, seal bone interior gaps `<= 60 px` (`f=37` `54px` left ankle, `f=38` `27px` left foot) AND bridge `f=38` right ankle `y=0..3` (`[928..975]`), while explicitly clearing the trapped between-ankles sky pocket (`f=36..38`) so ankle bones never hollow out.
2. **Curved Rotation / Motion-Line Removal (`f=20..59`, verify `f=18..19` & `60..62`)**:
   - Compute initial `ext_bg0` (`lum >= bg_med - 25 = 229`) and `fg_sil0 = ~ext_bg0`.
   - Apply disk `R=5` morphological opening (`opened = dilate_r(erode_r(fg_sil0, 5), 7) & fg_sil0`), removing detached `area >= 10` OR touching `(area >= 100 and bbox_diag >= 35.0)` from `fg_sil0 & (~opened)` (preserving stubby `f=38` fingertips `[11×8, area=61]`).
   - Clear `arc_mask` to `bg_med` before recomputing final `ext_bg`.
3. **Black Ground Oval Removal (`f=0..87`)**:
   - Strip disconnected bottom shadows (`y_min >= 935` on `f=26..35, 39..48`) and pale airborne ground shadows (`y >= 940, lum < 245`).
   - On grounded frames (`f=0..25, 49..87`), fit solid dark ellipse `(xc, yc, rx_raw, ry_raw)` with asymmetric padding (`rx + 16`, `+16` below `yc`, `+2` above `yc`).
   - **Adversarial fix**: Exclude trapped bright sky (`lum >= 229` between legs) *before* computing `foot_light` seed (`erode_r(fg_sil0, 3)`), and bound `dilate_r(foot_light, 7)` strictly to connected foot/leg interiors (`y <= 965`) so zero black oval fragments survive down to `y=1002`.
4. **Targeted Enclosed Pocket Cleanup (Never Global `deep-bright`)**:
   - Keep `--pocket-mode none` base so white skull, pelvis, femurs, tibias, and feet are never erased.
   - Clean the 3 verified enclosed pockets across their full touching ranges: between-legs vertical slot (`f=0..8, 48..87`), left-arm-to-hip gap (`f=69..87`), and arm-torso triangle (`f=47..63`), plus `min_debris_area = 25` (`f=46` speck) and 2-step geodesic AA skirt (`rgb = 0` on transparent/AA pixels).
5. **Visual Inspection Gate**: Inspect decoded WebP `contact-light.png` (`#FDFDFD`), `contact-dark.png` (`#0A0A0A`), and `contact-pockets.png` (`#FF00FF`) across all 88 frames via `read_file`; assert `border_alpha == 0` and `gutter_alpha == 0`.

---

## 5. `InitialLoader` Timing, GSAP Coordination & Safety Guarantees

- **Rerender Immunity**: Drive `00%..99%` text (`percentRef`) and hairline track (`trackRef` `scaleX`) via DOM refs in `requestAnimationFrame`; only update React state for the 4 status labels (`INITIALIZING ENVIRONMENT`, `CURATING DIGITAL WORKS`, `CALIBRATING INTERACTION`, `EXPERIENCE READY`). Wrap `LoaderBackflipSkeleton` in `React.memo` with `useCallback` `onFinished` stored in a `useRef`.
- **Dual-Gate + Deadline Failsafes**:
  - `BASE_DURATION_MS = 1400` (progress ramp)
  - `START_DEADLINE_MS = 600` (if `SHEET_SRC` hasn't decoded within `600ms`, abort `pendingImg.src = ""`, keep static `POSTER_SRC`, settle immediately — prevents starting a late flip that gets cut mid-air!)
  - `MAX_LOADER_MS = 2400` (unconditional hard ceiling so `#initial-loader-overlay` can never hang even if backgrounded)
  - `HOLD_COMPLETE_MS = 150` -> `isExiting = true` -> Framer Motion `0.45s` slide-up -> `EXIT_FALLBACK_MS = 700` safety call to `handleExitComplete`.
- **GSAP One-Shot**: `gsap.to(playhead, { frame: FRAME_COUNT, duration: 1.45, ease: "none", repeat: 0 })` inside `gsap.context()`, clamping `Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(playhead.frame)))` on `onUpdate` so frame `88` never paints empty, pausing on `document.hidden`, and cleaning up all timers, images, canvas backing store, and GSAP context on unmount.
- **`saveData` / Failure Safety**: Under `navigator.connection.saveData === true`, `!ctx`, decode error, or deadline timeout, defer `queueMicrotask(finishOnce)` (satisfying ESLint `react-hooks/set-state-in-effect`), render static poster -> `/images/skull-logo.png`, and dismiss loader on schedule.

---

## 6. Verification & Rollback Plan

- **Unit tests (`Vitest`)**:
  - `components/animations/__tests__/InitialLoader.test.tsx`: one-shot `repeat: 0`, frame `0` & clamped `87` draw, rAF rerender immunity, `saveData` fallback, decode error & `600ms` deadline fallback, `MAX_LOADER_MS` ceiling, unmount canvas/timer/GSAP cleanup.
  - `components/animations/__tests__/build-and-assets.test.ts`: backflip WebP byte budgets (`<= 250 KiB` sheet, `<= 25 KiB` poster) and `next.config.ts` `immutable` headers.
- **E2E & Performance tests (`Playwright` on isolated port `127.0.0.1:3099`)**:
  - `e2e/initial-loader-backflip.spec.ts`: `200` + `immutable` headers, non-empty animated canvas pixel diffs, clean detachment (`<= 5000ms`) + scroll unlock, blocked-sheet resilience, zero horizontal overflow across mobile/desktop + dark mode.
  - `e2e/performance-build.spec.ts` + `e2e/riding-skeleton.spec.ts`: verify Hero LCP isolation, `CLS < 0.01`, `LCP < 5000ms`, zero long tasks `> 120ms`, and zero regression on `RidingSkeleton`.
- **Command gate**: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
- **Rollback**: Isolated on `feature/skeleton-backflip-loader` (`git checkout main` or revert `InitialLoader.tsx` to static `skull-logo.png`).
