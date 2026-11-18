# Testing & E2E Verification Reference

`package.json` defines `dev`, `build`, `start`, and `lint` only — invoke `npx tsc --noEmit`, `npx vitest run`, and `npx playwright test` directly.

---

## 1. Vitest (`vitest.config.mts`, `vitest.setup.ts`, `components/animations/__tests__/*.test.tsx`)

- **Config**: `environment: "jsdom"`, `include: ["components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"]`, exclude `e2e/**`.
- **Required JSDOM mocks** (remember Next `<Image>` internal `handleLoading` reads `HTMLImageElement` properties in JSDOM):
  - `vi.hoisted(...)` `gsap` mock: `matchMedia`, `context`, `fromTo`, `set`, `to`, `timeline`, `delayedCall`, `ticker`, and `revert` spy.
  - `HTMLImageElement.prototype.decode` returning `Promise.resolve()`, plus `naturalWidth`, `naturalHeight`, `complete` checking `Boolean(this.getAttribute("src"))` so empty/poster paths don't misbehave.
  - `HTMLCanvasElement.prototype.getContext("2d")` returning `{ clearRect: vi.fn(), drawImage: vi.fn(), imageSmoothingEnabled: true, imageSmoothingQuality: "high" }`.
  - `HTMLElement.prototype.getBoundingClientRect`, `clientWidth`, and `offsetWidth` keyed by `data-testid` (`...-lane`, `...-canvas`).
  - `IntersectionObserver`, `ResizeObserver`, `MutationObserver`, `window.matchMedia`, `navigator.connection`, and `document.hidden`.
- **Assertions**:
  - Parent Server Component wrapper (`aria-hidden="true"`, `overflow-x-clip`, existing icons intact).
  - `navigator.connection.saveData = true` renders `[data-testid="...-poster"]` and skips sheet decode.
  - `#initial-loader-overlay` removal (`MutationObserver`) + intersection decodes sheet, draws frame `0` at `(sx=GUTTER, sy=GUTTER, sw=CELL_W, sh=CELL_H)`, and starts GSAP `fromTo`.
  - `visibilitychange` pauses/resumes active tween; `unmount()` disconnects all observers and calls `revert()`.
  - Failed `img.decode()` retries with fake timers (`1000ms`, `3000ms`) and falls back to static poster without leaving an invisible blank canvas.

---

## 2. Playwright E2E (`playwright.config.ts`, `e2e/*.spec.ts`)

- **Port Isolation (Critical)**: Set `baseURL: "http://127.0.0.1:3099"` and `webServer: { command: "npm run build && npx next start -H 127.0.0.1 -p 3099", url: "http://127.0.0.1:3099", reuseExistingServer: false }`. Never use port `3000` with `reuseExistingServer: true` — running `next build` overwrites `.next/` and breaks a running `npm run dev` on port `3000`, hanging `InitialLoader` at `00%`.
- **Do not run redundant `npm run build` right before `npx playwright test`**: `playwright.config.ts` already executes `npm run build`.
- **Required E2E assertions**:
  1. Sprite sheet request returns HTTP `200`, `cache-control` contains `immutable`, and `img.decode()` has `naturalWidth > 0`.
  2. Existing marquee animation (`animationName` contains `marquee`, `animationPlayState === "running"`, changing `transform`) stays intact.
  3. Continuous motion via `DOMMatrix(getComputedStyle(canvas).transform).m41`: monotonic decrease across screen, off-screen entry/exit, and `wrapJumpCount >= 1`.
  4. Non-empty canvas pixels (`ctx.getImageData(0, 0, w, h).data` alpha > 0 across multiple timestamps).
  5. `document.documentElement.scrollWidth <= window.innerWidth` across `375x812`, `768x1024`, and `1440x900`, plus dark-mode toggle cleanly with zero console/page errors.
  6. Motion still runs cleanly even under `page.emulateMedia({ reducedMotion: "reduce" })` (unless site-wide reduced motion is later implemented).

---

## 3. Final Command Gate (Run After Last Edit)

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
npm.cmd run lint
.\node_modules\.bin\vitest.cmd run
.\node_modules\.bin\playwright.cmd test
```
