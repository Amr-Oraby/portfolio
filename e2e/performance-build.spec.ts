import { test, expect } from "@playwright/test";

test.describe("Performance, CWV & Production Build Health", () => {
  test("does not eagerly fetch riding sprite sheet above the fold before scrolling", async ({
    page,
  }) => {
    for (const vp of [
      { name: "mobile", width: 375, height: 812 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const spriteRequests: string[] = [];
      page.on("request", (req) => {
        if (req.url().includes("skeleton-riding-sheet")) {
          spriteRequests.push(req.url());
        }
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => !document.getElementById("initial-loader-overlay"),
        undefined,
        { timeout: 15_000 }
      );
      await page.waitForTimeout(500);

      expect(
        spriteRequests,
        `${vp.name}: sprite sheet should wait until near TechMarquee instead of competing with Hero LCP`
      ).toEqual([]);

      page.removeAllListeners("request");
    }
  });

  test("loads all sections and routes cleanly with zero 4xx/5xx responses and valid cache headers", async ({
    page,
  }) => {
    const failedResponses: Array<{ url: string; status: number }> = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    let sheetContentLength = 0;
    let sheetCacheControl = "";
    let backflipSheetStatus = 0;
    let backflipSheetContentLength = 0;
    let backflipSheetCacheControl = "";
    let heroTypingSheetStatus = 0;
    let heroTypingSheetContentLength = 0;
    let heroTypingSheetCacheControl = "";

    page.on("response", (res) => {
      if (res.status() >= 400) {
        failedResponses.push({ url: res.url(), status: res.status() });
      }
      if (res.url().includes("skeleton-riding-sheet.v1.webp")) {
        sheetCacheControl = res.headers()["cache-control"] ?? "";
        sheetContentLength = Number(res.headers()["content-length"] ?? 0);
      }
      if (res.url().includes("skeleton-backflip-sheet.v2.webp")) {
        backflipSheetStatus = res.status();
        backflipSheetCacheControl = res.headers()["cache-control"] ?? "";
        backflipSheetContentLength = Number(res.headers()["content-length"] ?? 0);
      }
      if (res.url().includes("skeleton-hero-typing-sheet.v1.webp")) {
        heroTypingSheetStatus = res.status();
        heroTypingSheetCacheControl = res.headers()["cache-control"] ?? "";
        heroTypingSheetContentLength = Number(res.headers()["content-length"] ?? 0);
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 }
    );

    // Scroll progressively down the full document to verify every dynamic chunk and asset
    const totalHeight = await page.evaluate(
      () => document.documentElement.scrollHeight
    );
    for (let y = 0; y <= totalHeight; y += 600) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
      await page.waitForTimeout(150);
    }

    await expect
      .poll(() => sheetCacheControl, { timeout: 10_000 })
      .toContain("immutable");
    expect(sheetContentLength).toBeGreaterThan(0);
    expect(sheetContentLength).toBeLessThanOrEqual(350 * 1024);

    await expect
      .poll(() => backflipSheetStatus, { timeout: 10_000 })
      .toBe(200);
    expect(backflipSheetCacheControl).toContain("immutable");
    expect(backflipSheetContentLength).toBeGreaterThan(0);
    expect(backflipSheetContentLength).toBeLessThanOrEqual(250 * 1024);

    await expect
      .poll(() => heroTypingSheetStatus, { timeout: 10_000 })
      .toBe(200);
    expect(heroTypingSheetCacheControl).toContain("immutable");
    expect(heroTypingSheetContentLength).toBeGreaterThan(0);
    expect(heroTypingSheetContentLength).toBeLessThanOrEqual(250 * 1024);

    expect(failedResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("maintains zero CLS, healthy LCP, and smooth rAF cadence without long main-thread stalls", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __cwvMetrics: {
          cls: number;
          lcp: number;
          longTasksAfterLoad: number[];
        };
      };
      w.__cwvMetrics = { cls: 0, lcp: 0, longTasksAfterLoad: [] };

      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<
            PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          >) {
            if (!entry.hadRecentInput && entry.value) {
              w.__cwvMetrics.cls += entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        // Ignore if unsupported
      }

      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) w.__cwvMetrics.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // Ignore if unsupported
      }
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 }
    );

    const lane = page.getByTestId("riding-skeleton-lane");
    await lane.scrollIntoViewIfNeeded();
    const canvas = page.getByTestId("riding-skeleton-canvas");
    await expect(canvas).toBeVisible();

    // Start measuring long tasks + rAF frame deltas specifically while riding runs
    await page.evaluate(() => {
      const w = window as unknown as {
        __cwvMetrics: { longTasksAfterLoad: number[] };
      };
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            w.__cwvMetrics.longTasksAfterLoad.push(entry.duration);
          }
        }).observe({ type: "longtask", buffered: false });
      } catch {
        // Ignore if unsupported
      }
    });

    const rafStats = await page.evaluate(
      () =>
        new Promise<{ medianDeltaMs: number; maxDeltaMs: number; frames: number }>(
          (resolve) => {
            const deltas: number[] = [];
            let prev = performance.now();
            const start = prev;
            const tick = (now: number) => {
              deltas.push(now - prev);
              prev = now;
              if (now - start < 1500) {
                requestAnimationFrame(tick);
              } else {
                const sorted = [...deltas].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
                resolve({
                  medianDeltaMs: median,
                  maxDeltaMs: sorted[sorted.length - 1] ?? 0,
                  frames: deltas.length,
                });
              }
            };
            requestAnimationFrame(tick);
          }
        )
    );

    const metrics = await page.evaluate(
      () =>
        (
          window as unknown as {
            __cwvMetrics: {
              cls: number;
              lcp: number;
              longTasksAfterLoad: number[];
            };
          }
        ).__cwvMetrics
    );

    expect(metrics.cls).toBeLessThan(0.01);
    expect(metrics.lcp).toBeGreaterThan(0);
    expect(metrics.lcp).toBeLessThan(5000);
    expect(rafStats.frames).toBeGreaterThan(25);
    expect(rafStats.medianDeltaMs).toBeLessThan(36);
    expect(
      metrics.longTasksAfterLoad.filter((d) => d > 120)
    ).toEqual([]);
  });

  test("pauses animation when scrolled off-screen and resumes cleanly when scrolled back", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 }
    );

    const lane = page.getByTestId("riding-skeleton-lane");
    await lane.scrollIntoViewIfNeeded();
    const canvas = page.getByTestId("riding-skeleton-canvas");
    await expect(canvas).toBeVisible();

    // Wait until sprite starts moving
    await expect
      .poll(
        () =>
          canvas.evaluate(
            (el) => new DOMMatrix(getComputedStyle(el).transform).m41
          ),
        { timeout: 10_000 }
      )
      .toBeLessThan(1440);

    // Confirm active motion on screen
    const xActive1 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    await page.waitForTimeout(300);
    const xActive2 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    expect(xActive2).not.toBe(xActive1);

    // Scroll far above TechMarquee (>120px rootMargin) -> must pause
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);

    const xPaused1 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    await page.waitForTimeout(400);
    const xPaused2 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    expect(xPaused2).toBe(xPaused1);

    // Scroll back into view -> must resume
    await lane.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const xResumed1 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    await page.waitForTimeout(350);
    const xResumed2 = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    expect(xResumed2).not.toBe(xResumed1);
  });
});
