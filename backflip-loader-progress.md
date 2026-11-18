# Implementation Progress: `feature/skeleton-backflip-loader`

- **Current Git Branch**: `feature/skeleton-backflip-loader` (branched cleanly from `main` at `96e593f`)
- **Untouched Protected Files**: `components/promt.txt`, `.agents/skills/skeleton-animation/*`, `skeleton-animation-skill.md`, `frames/frame-1..28.png` (riding frames)

---

## Completed Tasks (DONE)

### 1. Branch & Git Setup

- [x] Created dedicated branch `feature/skeleton-backflip-loader` off `main` (`96e593f`).
- [x] Verified `.agents/skills/skeleton-animation/SKILL.md` remains completely unmodified.

### 2. Planning & Adversarial Review

- [x] Completed full read-only investigation of `public/backflip.mp4` (`91` frames, `[0..87]` active timeline, motion-line metrics, black oval geometry, `y=0` ankle/cranium touches, `minterpolate` benchmark).
- [x] Audited `InitialLoader.tsx`, downstream `#initial-loader-overlay` observers (`RidingSkeleton`, `PeekingSkeleton`, Playwright E2E), and T=0 Hero LCP / RAM constraints.
- [x] Completed adversarial review and resolved all 4 blocking/high-severity findings into [backflip-loader-plan.md](backflip-loader-plan.md).

### 3. Frontend & Next.js Config Implementation (Subagent B)

- [x] Created [components/animations/LoaderBackflipSkeleton.tsx](components/animations/LoaderBackflipSkeleton.tsx):
  - `"use client"`, `React.memo`, `useSyncExternalStore` for `saveData`.
  - Exact sprite contract (`88` frames, `10×9` grid, `150×170` cell, `4px` gutter, `158×178` stride, `1.45s` one-shot `repeat: 0`).
  - `START_DEADLINE_MS = 600` decode abort + static poster underlay (`POSTER_SRC` -> `/images/skull-logo.png` fallback) + synchronous poster hide after `drawFrame(0)` (zero double `dark:drop-shadow`).
  - Clamped frame index `0..87`, `visibilitychange` pause/resume, full cleanup (`canvas.width = 0; canvas.height = 0;`, `src = ""`, `gsCtx.revert()`).
- [x] Updated [components/animations/InitialLoader.tsx](components/animations/InitialLoader.tsx):
  - Mounted `<LoaderBackflipSkeleton onFinished={handleAnimFinished} startDeadlineMs={START_DEADLINE_MS} />` in the crosshair stage.
  - Switched `00%..99%` text and hairline `scaleX` to DOM refs in rAF (preventing ~85 React rerenders).
  - Implemented dual-gate completion (`BASE_DURATION_MS = 1400` + `animDone` or `MAX_LOADER_MS = 2400`) + `HOLD_COMPLETE_MS = 150` + `EXIT_FALLBACK_MS = 700` + full timer/rAF cleanup.
- [x] Updated [next.config.ts](next.config.ts):
  - Added immutable `Cache-Control: public, max-age=31536000, immutable` headers for `/images/skeleton-backflip-sheet.v1.webp` and `/images/skeleton-backflip-poster.v1.webp`.
- [x] Verified `npm run typecheck` and `eslint` pass (`exit 0`) on all 3 files.

### 4. Unit & E2E Test Authoring (Subagent C)

- [x] Created [components/animations/**tests**/InitialLoader.test.tsx](components/animations/__tests__/InitialLoader.test.tsx) (7 unit/lifecycle test cases).
- [x] Updated [components/animations/**tests**/build-and-assets.test.ts](components/animations/__tests__/build-and-assets.test.ts) with backflip WebP size budgets (`<= 250 KiB` sheet, `<= 25 KiB` poster) and immutable header checks.
- [x] Created [e2e/initial-loader-backflip.spec.ts](e2e/initial-loader-backflip.spec.ts) (Chromium E2E tests for live canvas pixel diffs, immutable `200`, clean dismissal, aborted-sheet fallback, responsive overflow, and dark mode).
- [x] Updated [e2e/performance-build.spec.ts](e2e/performance-build.spec.ts) to validate `skeleton-backflip-sheet.v1.webp` status, `immutable` header, and `<= 250 KiB` content-length.
- [x] Verified `npm run typecheck` and `eslint` pass (`exit 0`) on all 4 test files.

### 5. Video Extraction & Visual Asset Generation (Subagent A)

- [x] Created [scripts/extract-backflip-frames.py](scripts/extract-backflip-frames.py) (reusing core helpers from `.agents/skills/skeleton-animation/scripts/extract_sprite.py` without modifying the skill):
  - Smart `y=0` top-edge sealing (`f=23..28` cranium `>= 80px`; `f=28..38` ankle/foot gaps `<= 60px` + `f=38` right-ankle `y=0..3` bridge; leaves `f=37..38` between-ankles sky open).
  - Curved rotation/motion-line removal (`f=18..62`, disk `R=5` opening on `fg_sil0`, opening trapped `f=30..31` arc bubbles first, protecting `f=38` fingertips).
  - Black ground oval & airborne shadow removal (`f=0..87`, full horizontal box `y >= 928` guarded by `foot_keep` `6px` sole reconstruction after excluding trapped between-leg sky).
  - Isolated foreground debris strip (`< 25 px`) + 2-step geodesic AA edge skirt (`rgb = 0` on transparent/AA pixels).
- [x] Generated & verified outputs (`32.85s` runtime on PyTorch CUDA):
  - `frames/backflip/frame-1.png` .. `frames/backflip/frame-88.png` (`88` RGBA PNGs, `150×170`; `frames/frame-1..28.png` riding frames untouched).
  - [public/images/skeleton-backflip-sheet.v1.webp](public/images/skeleton-backflip-sheet.v1.webp) (`1580×1602`, `argb`, `10×9` grid, `4px` gutters, `palette-lossless-15x15(87c)`, **`188,954` bytes / `184.5 KiB`** `<= 250 KiB`, `max_gutter_alpha = 0`, `border_alpha = 0`).
  - [public/images/skeleton-backflip-poster.v1.webp](public/images/skeleton-backflip-poster.v1.webp) (`150×170`, `argb`, **`7,476` bytes / `7.3 KiB`** `<= 25 KiB`).
- [x] Bumped asset filenames to `.v2.webp` ([skeleton-backflip-sheet.v2.webp](public/images/skeleton-backflip-sheet.v2.webp), [skeleton-backflip-poster.v2.webp](public/images/skeleton-backflip-poster.v2.webp)) so `Cache-Control: immutable` browsers bust the cached `150×170` `.v1.webp` sheet, and added dynamic `naturalWidth`/`naturalHeight` stride slicing in [LoaderBackflipSkeleton.tsx](components/animations/LoaderBackflipSkeleton.tsx).

### 6. Stage Sizing, Border Removal & Unit Test Fixes — DONE

- [x] Enlarged `<LoaderBackflipSkeleton />` stage in [LoaderBackflipSkeleton.tsx](components/animations/LoaderBackflipSkeleton.tsx) (`w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 xl:w-60 xl:h-60`, paired with `180×204` sprite frames).
- [x] Removed the 4 corner crosshair border elements around the skeleton in [InitialLoader.tsx](components/animations/InitialLoader.tsx).
- [x] Fixed `InitialLoader.test.tsx` (`180×204` constants, `afterEach` DOM cleanup race, `decode()` assertion filtering on `BACKFLIP_SHEET_SRC`, and session-skip test).
- [x] Ran `npm run typecheck`, `npm run lint`, and `npm test` -> `3` test files / `17` tests initially, then `18` tests passed (`exit 0`).

### 7. Session-Only Initial Loader, Pre-Paint Guard & Full Verification — DONE

- [x] Gated [InitialLoader.tsx](components/animations/InitialLoader.tsx) via `sessionStorage` key `portfolio-initial-loader-seen` (`useSyncExternalStore`) so the loader plays only on the initial website open per browser session and persists the flag on exit completion / unmount.
- [x] Added pre-paint inline `<script>` in [app/layout.tsx](app/layout.tsx) setting `document.documentElement.dataset.loaderSeen = "1"` plus `html[data-loader-seen="1"] #initial-loader-overlay { display: none !important; }` in [app/globals.css](app/globals.css) to eliminate any pre-hydration flash on refresh.
- [x] Guarded [LoaderBackflipSkeleton.tsx](components/animations/LoaderBackflipSkeleton.tsx) (`stageEl?.closest("#initial-loader-overlay") && document.documentElement.dataset.loaderSeen === "1"`) and [InitialLoader.tsx](components/animations/InitialLoader.tsx) effects so repeat page refreshes trigger zero `skeleton-backflip-sheet.v2.webp` fetches and zero scroll locks.
- [x] Verified zero errors and healthy performance after final edits: `npm run typecheck`, `npm run lint`, `npm test` (`3` files / `18` passed), and `npm run test:e2e` (`13/13` passed across `initial-loader-backflip.spec.ts`, `performance-build.spec.ts`, and `riding-skeleton.spec.ts`).

---

## Remaining Tasks (NOT DONE YET)

### 1. Optional Timing Adjustment (Paused per User Direction)

- [ ] Slow down `BACKFLIP_DURATION_S` (`1.45s`) and loader `BASE_DURATION_MS` / `MAX_LOADER_MS` only if still desired later.

### 2. Production Build & Playwright E2E

- [x] Verified production build + Chromium E2E [initial-loader-backflip.spec.ts](e2e/initial-loader-backflip.spec.ts) (`4/4` passed on `127.0.0.1:3099`, including zero reload sheet fetch and pre-paint guard).
- [x] Verified full `npm run test:e2e` (`13/13` passed across all 3 specs including CWV, LCP, CLS, long-task, console/page errors, and HTTP status checks).

### 3. Final Cleanup & Git Publish

- [ ] Exclude or handle untracked prompt/markdown docs (`components/promt.txt`, `backflip-loader-plan.md`, `backflip-loader-progress.md`), commit, merge, and push when requested.
