---
name: skeleton-animation
description: >-
  Turn raw 2D line-art skeleton MP4 videos (no alpha, white/off-white background)
  into zero-halo transparent WebP sprite sheets and performant GSAP + Canvas
  animations in this Next.js 16 / React 19 / Tailwind v4 portfolio. Use when
  probing, extracting, or animating skeleton videos (e.g. backflip.mp4,
  skeleton-vid.mp4).
---

# Skeleton Animation Workflow

## Token & Repo Rules
- **Do NOT** read root Lighthouse JSONs (`*-report.json`, `*-desktop*.json`, `*-mobile*.json`) or run `Get-ChildItem -Recurse` into `node_modules` / `.next`.
- Read only targeted line ranges (`AGENTS.md`: check `node_modules/next/dist/docs/` before Next 16 edits; `CLAUDE.md`: place animations in `components/animations/`, keep parent components Server Components).

## 4-Phase Process

### 1. Branch & Git Hygiene
- Branch from `main` (verify `git status` and ancestry first): `git checkout -b feature/<name>`.
- Keep raw `public/*.mp4`, `/frames/`, `/test-results/`, and `/playwright-report/` gitignored.

### 2. Probe First (1 Command)
```bash
python .agents/skills/skeleton-animation/scripts/probe_video.py public/<video>.mp4
```
- Never upsample 24 FPS video to 50 FPS (`fps=50` creates `2:2:...:3` duplicate judder and `2.08x` RAM).
- Classify from `archetype`:
  - `traveling-or-in-place-cycle` -> horizontal GSAP sweep + distance-locked frame index (`riding.mp4`).
  - `stationary-loop-or-pingpong` -> time-based GSAP/ticker loop (`skeleton-vid.mp4`).
  - `triggered-one-shot` -> `IntersectionObserver` / hover / click trigger, trimming duplicate holds (`backflip.mp4`).
- Note `border_touch.top_y0_frames`, `background.corner_med` (`#FFFFFF` vs `#FBFBFB`), `is_monochrome`, `bottom_shadow_rows`, and `fits_2048`.

### 3. Extract & Visually Verify
```bash
python .agents/skills/skeleton-animation/scripts/extract_sprite.py \
  --video public/<video>.mp4 --start <S> --end <E> --step <1|2> \
  --cell-w <W> --pocket-mode <none|deep-bright> \
  --frames-dir frames \
  --sheet-out public/images/<name>-sheet.v1.webp \
  --poster-out public/images/<name>-poster.v1.webp \
  --verify-dir "<scratch_dir>"
```
- **Hard invariants**:
  - Never use `ffmpeg` `colorkey`/`lumakey` (destroys white bones/tires).
  - Keep `--pocket-mode none` by default; only clear enclosed pockets after confirming no skull/bone erasure, and use geometry masks if bike-like shapes exist (see `scripts/extract-riding-frames.py`).
  - Keep `gutter >= 4` (`STRIDE = CELL + 2 * GUTTER`) and total sheet `<= 2048x2048` on mobile.
  - Visually inspect `contact-light.png` (`#FDFDFD`), `contact-dark.png` (`#0A0A0A`), and `contact-pockets.png` (`#FF00FF`) via `read_file` before frontend wiring.

### 4. Frontend, Caching & Verification
- Follow [frontend-gsap.md](./references/frontend-gsap.md) for Server/Client split, Tailwind v4 `translate` vs GSAP `transform` separation, loader/intersection gating, retry + poster fallback, and `next.config.ts` immutable headers.
- Follow [testing-e2e.md](./references/testing-e2e.md) for Vitest mocks and Playwright isolated-port verification (`tsc --noEmit`, `npm run lint`, `vitest run`, `playwright test`).
