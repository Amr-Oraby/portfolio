import { test, expect } from "@playwright/test";

interface BackflipSampleResult {
  nonEmptySamples: number;
  firstNonEmptyAlphaCount: number;
  maxChangedPixels: number;
}

test.describe("InitialLoader Backflip Skeleton E2E", () => {
  test("skips the loader after the first load even when refreshed during exit", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.locator("#initial-loader-overlay")).toBeVisible({
      timeout: 5_000,
    });

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.sessionStorage.getItem("portfolio-initial-loader-seen")
        )
      )
      .toBe("1");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#initial-loader-overlay")).toHaveCount(0);
  });

  test("renders overlay and canvas, receives HTTP 200 immutable sheet, and animates pixels during backflip", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const sheetResponses: Array<{
      url: string;
      status: number;
      cacheControl: string;
    }> = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("response", (res) => {
      if (res.url().includes("skeleton-backflip-sheet")) {
        sheetResponses.push({
          url: res.url(),
          status: res.status(),
          cacheControl: res.headers()["cache-control"] ?? "",
        });
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const overlay = page.locator("#initial-loader-overlay");
    const stage = page.getByTestId("loader-backflip-stage");
    const canvas = page.getByTestId("loader-backflip-canvas");

    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await expect(stage).toBeVisible({ timeout: 5_000 });
    await expect(canvas).toBeVisible({ timeout: 5_000 });

    const sampleResult = await page.evaluate<BackflipSampleResult>(() => {
      return new Promise((resolve) => {
        const start = performance.now();
        let firstSnapshot: Uint8ClampedArray | null = null;
        let firstNonEmptyAlphaCount = 0;
        let nonEmptySamples = 0;
        let maxChangedPixels = 0;
        let lastSampleTime = 0;

        const sample = (now: number) => {
          const canvasEl = document.querySelector<HTMLCanvasElement>(
            '[data-testid="loader-backflip-canvas"]'
          );

          if (
            canvasEl &&
            canvasEl.width > 0 &&
            canvasEl.height > 0 &&
            now - lastSampleTime >= 32
          ) {
            lastSampleTime = now;
            const ctx = canvasEl.getContext("2d");
            if (ctx) {
              const { data } = ctx.getImageData(
                0,
                0,
                canvasEl.width,
                canvasEl.height
              );
              let alphaCount = 0;
              for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 0) alphaCount += 1;
              }

              if (alphaCount > 0) {
                nonEmptySamples += 1;
                if (!firstSnapshot) {
                  firstSnapshot = new Uint8ClampedArray(data);
                  firstNonEmptyAlphaCount = alphaCount;
                } else {
                  let changed = 0;
                  for (let i = 0; i < data.length; i += 4) {
                    if (
                      data[i] !== firstSnapshot[i] ||
                      data[i + 1] !== firstSnapshot[i + 1] ||
                      data[i + 2] !== firstSnapshot[i + 2] ||
                      data[i + 3] !== firstSnapshot[i + 3]
                    ) {
                      changed += 1;
                    }
                  }
                  if (changed > maxChangedPixels) {
                    maxChangedPixels = changed;
                  }
                }
              }
            }
          }

          if (nonEmptySamples >= 2 && maxChangedPixels > 50) {
            resolve({
              nonEmptySamples,
              firstNonEmptyAlphaCount,
              maxChangedPixels,
            });
            return;
          }

          if (
            (!document.getElementById("initial-loader-overlay") &&
              now - start > 500) ||
            now - start > 4_500
          ) {
            resolve({
              nonEmptySamples,
              firstNonEmptyAlphaCount,
              maxChangedPixels,
            });
            return;
          }

          requestAnimationFrame(sample);
        };

        requestAnimationFrame(sample);
      });
    });

    expect(sampleResult.nonEmptySamples).toBeGreaterThanOrEqual(2);
    expect(sampleResult.firstNonEmptyAlphaCount).toBeGreaterThan(0);
    expect(sampleResult.maxChangedPixels).toBeGreaterThan(50);

    await expect
      .poll(() => sheetResponses.length, { timeout: 5_000 })
      .toBeGreaterThan(0);

    for (const res of sheetResponses) {
      expect(res.status).toBe(200);
      expect(res.cacheControl).toContain("immutable");
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("transitions away and detaches #initial-loader-overlay within 5000ms and unlocks body scroll", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const overlay = page.locator("#initial-loader-overlay");
    await overlay.waitFor({ state: "attached", timeout: 5_000 });
    await overlay.waitFor({ state: "detached", timeout: 5_000 });

    const bodyOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(bodyOverflow).not.toBe("hidden");

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("falls back to poster and dismisses cleanly when backflip sprite sheet request is aborted", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.route("**/skeleton-backflip-sheet.v3.webp", (route) =>
      route.abort()
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });

    const overlay = page.locator("#initial-loader-overlay");
    await expect(overlay).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("loader-backflip-poster")).toBeVisible({
      timeout: 5_000,
    });

    await overlay.waitFor({ state: "detached", timeout: 5_000 });

    const bodyOverflow = await page.evaluate(
      () => document.body.style.overflow
    );
    expect(bodyOverflow).not.toBe("hidden");
    expect(pageErrors).toEqual([]);
  });

  test("maintains zero horizontal overflow across mobile and desktop during/after dismissal and supports dark mode", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    const viewports = [
      { name: "mobile", width: 375, height: 812 },
      { name: "desktop", width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      if (page.url().startsWith("http")) {
        await page.evaluate(() => {
          window.sessionStorage.clear();
          delete document.documentElement.dataset.loaderSeen;
        });
      }
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const overlay = page.locator("#initial-loader-overlay");
      const stage = page.getByTestId("loader-backflip-stage");
      await expect(overlay).toBeVisible({ timeout: 5_000 });
      await expect(stage).toBeVisible({ timeout: 5_000 });

      const stageBox = await stage.boundingBox();
      expect(stageBox).not.toBeNull();
      expect(stageBox!.x).toBeGreaterThanOrEqual(0);
      expect(stageBox!.x + stageBox!.width).toBeLessThanOrEqual(vp.width);

      const duringOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        duringOverflow.scrollWidth,
        `${vp.name} horizontal overflow during loader`
      ).toBeLessThanOrEqual(duringOverflow.innerWidth);

      await overlay.waitFor({ state: "detached", timeout: 5_000 });

      const afterOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        afterOverflow.scrollWidth,
        `${vp.name} horizontal overflow after loader`
      ).toBeLessThanOrEqual(afterOverflow.innerWidth);
    }

    // Verify dark mode toggle works cleanly and persists through loader reload
    const themeToggle = page.getByRole("button", { name: "Toggle theme" });
    await expect(themeToggle).toBeVisible();

    const wasDarkInitially = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    await themeToggle.click();

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(!wasDarkInitially);

    const toggledOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(toggledOverflow.scrollWidth).toBeLessThanOrEqual(
      toggledOverflow.innerWidth
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#initial-loader-overlay")).toHaveCount(0);
    await expect(page.getByTestId("loader-backflip-stage")).toHaveCount(0);
    await page.waitForTimeout(300);

    const reloadedOverflowState = await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      seenFlag: window.sessionStorage.getItem("portfolio-initial-loader-seen"),
    }));
    expect(reloadedOverflowState.seenFlag).toBe("1");
    expect(reloadedOverflowState.bodyOverflow).not.toBe("hidden");
    expect(reloadedOverflowState.scrollWidth).toBeLessThanOrEqual(
      reloadedOverflowState.innerWidth
    );

    await themeToggle.click();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(wasDarkInitially);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
