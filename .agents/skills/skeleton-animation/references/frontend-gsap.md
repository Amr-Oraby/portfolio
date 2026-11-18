# Frontend, GSAP & Next.js 16 Integration Reference

Read relevant files in `node_modules/next/dist/docs/` (`headers.md`, `use-client.md`, `image.md`) before changing Next.js config or Server/Client boundaries. Note: Follow `CLAUDE.md` (`components/animations/`, prefer Server Components) over legacy `.claude/commands/ui-component.md`.

---

## 1. Layout, Overflow & Theme Conventions

- **Server/Client boundary**: Keep parent sections/marquees (e.g. `components/TechMarquee.tsx`) as Server Components so static icon SVG bundles stay off client JS. Do **not** use `next/dynamic(..., { ssr: false })` inside a Server Component (disallowed in Next.js 16).
- **Horizontal clip without vertical truncation**: `HomeBackground` and `body` have no `overflow-x-hidden`. Put `overflow-x-clip` on the outer wrapper, and never put `overflow-hidden` on the rider lane so vertical protrusion (`-translate-y-[calc(100%-2px)]`) and `dark:drop-shadow` are not clipped.
- **Tailwind v4 `translate` vs GSAP `transform`**: Tailwind v4 compiles `-translate-y-*` to CSS `translate`, which GSAP reads once and clears into `style.transform`. Place `-translate-y-*` on the outer `div` (`data-testid="...-lane"`) and run GSAP `x`/`y` strictly on the inner `<canvas>`.
- **Dark mode outline**: White-filled black-ink skeleton art needs `dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]` (matching `Marquee.tsx`, `About.tsx`, `PeekingSkeleton.tsx`).

---

## 2. Loading, Resilience & Lifecycle (`RidingSkeleton.tsx` Pattern)

- **Canvas context check**: Bail early if `canvas.getContext("2d")` is `null` and fall back via `queueMicrotask(() => setLoadFailed(true))` (async so ESLint `react-hooks/set-state-in-effect` stays clean).
- **`saveData` hydration-safe check**: Use `useSyncExternalStore(subscribeStaticPreference, getStaticPreferenceSnapshot, getStaticPreferenceServerSnapshot)` for `navigator.connection?.saveData === true` -> render static `<Image src={POSTER_SRC} unoptimized width={CELL_W} height={CELL_H} alt="" />`. (Keep motion running regardless of OS `prefers-reduced-motion` unless intentionally aligning the whole site, matching `TechMarquee` and `PeekingSkeleton`.)
- **Gated preload + pause**:
  1. Wait for `#initial-loader-overlay` removal: observe `initialLoaderEl.parentElement ?? document.body` with `{ childList: true, subtree: false }` (avoids ~85 RAF progress-text callbacks).
  2. Dual `IntersectionObserver`:
     - `preloadObserver` (`rootMargin: "900px 0px"`, disconnects once hit) triggers `img.decode()`.
     - `visibilityObserver` (`threshold: 0, rootMargin: "120px 0px"`) pauses/resumes GSAP when off-screen.
  3. Also sync on `document` `visibilitychange` (`!document.hidden`).
- **Retry & fallback on flaky network**:
  - Do **not** leave `loadStarted = true` on `img.decode()` rejection with `() => {}`.
  - Pass `img.decode().then(finalizeReady, handleLoadFailure)` + `img.onerror = handleLoadFailure`.
  - Retry with backoff (`[1000, 3000]` ms) + `window` `"online"` listener; if retries exhaust, set `loadFailed = true` to render `POSTER_SRC`.
  - On cleanup, set `cancelled = true`, clear `retryTimer`, set `pendingImg.src = ""`, disconnect observers, remove listeners, and call `mm?.revert()`.

---

## 3. Archetype Playback Patterns

### A. Traveling Cycle (`riding.mp4` -> `RidingSkeleton`)
- Pre-declare `let nextTween: gsap.core.Tween | null = null;` BEFORE `gsap.fromTo(...)` (GSAP's `immediateRender` invokes `onUpdate` synchronously before `const` assignment finishes, throwing a TDZ `ReferenceError`).
- Animate `{ x: trackWidth }` -> `{ x: -riderWidth }` with `ease: "none"`, `repeat: -1`, `duration = (trackWidth + riderWidth) / speedPxPerSec` (`135` desktop / `95` mobile inside `gsap.matchMedia()`).
- **Monotonic odometer distance sync (no moonwalking)**:
  - Track `prevProgress` and `traveledPx`: `deltaP = progress >= prevProgress ? progress - prevProgress : 1 - prevProgress + progress; traveledPx += deltaP * totalDistance;`.
  - For wheeled subjects: `pxPerCycle = CYCLE_RATIO * riderWidth` (derived from `wheel_circumference / crop_width`, `0.92` on `riding.mp4`), `frameIdx = Math.floor(traveledPx / (pxPerCycle / FRAME_COUNT)) % FRAME_COUNT`.
  - Redraw `<canvas>` only when `frameIdx !== lastFrameIdx` with `ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"`.
- **ResizeObserver**: Ignore `< 0.5px` width deltas (mobile address bar). On width change, capture `savedProgress = tween.progress()`, set `isRestoring = true`, rebuild inside `context.add(...)`, restore `nextTween.progress(savedProgress)`, then clear `isRestoring = false`.

### B. Stationary Loop / Ping-Pong (`skeleton-vid.mp4`)
- No horizontal GSAP `x` sweep; drive `frameIdx` via `gsap.to({ f: 0 }, { f: FRAME_COUNT - 1, duration: FRAME_COUNT / fps, ease: "none", repeat: -1, yoyo: isPingPong, snap: "f", onUpdate })`.

### C. Triggered One-Shot (`backflip.mp4`)
- Drive `frameIdx` with `repeat: 0` triggered by `IntersectionObserver` threshold, hover, or click, holding the last frame cleanly until reset.

---

## 4. Immutable Caching (`next.config.ts`)

Use exact versioned filenames (never `/images/name-:slug*.webp`, because `-` is not a delimiter in `path-to-regexp` and crashes Next.js startup):

```ts
return [
  {
    source: "/images/<name>-sheet.v1.webp",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  },
  {
    source: "/images/<name>-poster.v1.webp",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  },
];
```
