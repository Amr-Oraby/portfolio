import { test, expect, type Page } from "@playwright/test";

interface MotionSample {
  t: number;
  x: number;
  boxLeft: number;
  boxRight: number;
  width: number;
  viewportWidth: number;
}

interface MotionResult {
  fullSegment: MotionSample[];
  postWrapSegment: MotionSample[];
  wrapJumpCount: number;
}

async function waitForPageReadyAndScrollToLane(page: Page) {
  await page.waitForFunction(
    () => !document.getElementById("initial-loader-overlay"),
    undefined,
    { timeout: 15_000 }
  );

  const lane = page.locator('[data-testid="riding-skeleton-lane"][data-riding-direction="left"]');
  await lane.waitFor({ state: "attached", timeout: 15_000 });
  await lane.evaluate((el) => {
    el.scrollIntoView({ behavior: "instant", block: "center" });
  });

  return lane;
}

test.describe("RidingSkeleton & TechMarquee E2E", () => {
  test("renders lane and canvas with zero console/page errors and HTTP 200 sprite sheet with naturalWidth > 0", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const spriteResponses: Array<{
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
      if (res.url().includes("skeleton-riding-sheet.v1.webp")) {
        spriteResponses.push({
          url: res.url(),
          status: res.status(),
          cacheControl: res.headers()["cache-control"] ?? "",
        });
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const lane = await waitForPageReadyAndScrollToLane(page);
    const canvas = page.locator('[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]');

    await expect(lane).toBeVisible();
    await expect(canvas).toBeVisible();

    await expect
      .poll(() => spriteResponses.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    for (const res of spriteResponses) {
      expect(res.status).toBe(200);
      expect(res.cacheControl).toContain("immutable");
    }

    const spriteDimensions = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    }, spriteResponses[0].url);

    expect(spriteDimensions.naturalWidth).toBeGreaterThan(0);
    expect(spriteDimensions.naturalHeight).toBeGreaterThan(0);

    const techMarqueeWrapper = page
      .locator('.overflow-x-clip[aria-hidden="true"]')
      .filter({ has: lane });
    await expect(techMarqueeWrapper).toBeVisible();

    const marqueeTrack = techMarqueeWrapper.locator(".animate-marquee");
    await expect(marqueeTrack).toBeVisible();
    const marqueeIconCount = await marqueeTrack.locator("svg").count();
    expect(marqueeIconCount).toBeGreaterThanOrEqual(13);
    expect(marqueeIconCount % 13).toBe(0);

    const marqueeAnimBefore = await marqueeTrack.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        animationName: style.animationName,
        animationPlayState: style.animationPlayState,
        transform: style.transform,
      };
    });
    expect(marqueeAnimBefore.animationName).toContain("marquee");
    expect(marqueeAnimBefore.animationPlayState).toBe("running");

    await page.waitForTimeout(150);
    const marqueeTransformAfter = await marqueeTrack.evaluate(
      (el) => getComputedStyle(el).transform
    );
    expect(marqueeTransformAfter).not.toBe(marqueeAnimBefore.transform);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("moves right-to-left continuously across viewport and wraps back infinitely", async ({
    page,
  }) => {
    test.setTimeout(75_000);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForPageReadyAndScrollToLane(page);

    const canvas = page.locator('[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]');
    await expect(canvas).toBeVisible();

    // Wait until GSAP has attached an active transform to the canvas
    await page.waitForFunction(
      () => {
        const el = document.querySelector<HTMLElement>(
          '[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]'
        );
        if (!el) return false;
        const transform = getComputedStyle(el).transform;
        return Boolean(transform && transform !== "none");
      },
      undefined,
      { timeout: 15_000 }
    );

    const result = await page.evaluate<MotionResult>(() => {
      return new Promise((resolve, reject) => {
        const el = document.querySelector<HTMLElement>(
          '[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]'
        );
        if (!el) {
          reject(new Error("Missing riding-skeleton-canvas"));
          return;
        }

        const segments: MotionSample[][] = [[]];
        let wrapJumpCount = 0;
        const startTime = performance.now();
        const MAX_DURATION_MS = 45_000;

        const isCompleteSegment = (seg: MotionSample[]) => {
          if (seg.length < 10) return false;
          const first = seg[0];
          const last = seg[seg.length - 1];
          return (
            first.x >= first.viewportWidth - 35 &&
            last.x <= -last.width + 35
          );
        };

        const step = (now: number) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const x =
            style.transform && style.transform !== "none"
              ? new DOMMatrix(style.transform).m41
              : 0;
          const sample: MotionSample = {
            t: now,
            x,
            boxLeft: rect.left,
            boxRight: rect.right,
            width: rect.width,
            viewportWidth: window.innerWidth,
          };

          const currentSeg = segments[segments.length - 1];
          if (currentSeg.length > 0) {
            const prev = currentSeg[currentSeg.length - 1];
            // Large positive jump marks wrap from left exit back to right entrance
            if (sample.x - prev.x > Math.max(sample.viewportWidth * 0.4, 100)) {
              wrapJumpCount += 1;
              segments.push([sample]);
            } else {
              currentSeg.push(sample);
            }
          } else {
            currentSeg.push(sample);
          }

          // Stop as soon as we have one full right-to-left crossing AND post-wrap motion
          if (segments.length >= 2) {
            const prevSeg = segments[segments.length - 2];
            const newestSeg = segments[segments.length - 1];
            if (isCompleteSegment(prevSeg) && newestSeg.length >= 8) {
              resolve({
                fullSegment: prevSeg,
                postWrapSegment: newestSeg,
                wrapJumpCount,
              });
              return;
            }
          }

          if (now - startTime > MAX_DURATION_MS) {
            reject(
              new Error(
                `Timed out waiting for full crossing + wrap. Segments=${segments.length}, wraps=${wrapJumpCount}`
              )
            );
            return;
          }

          requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      });
    });

    expect(result.wrapJumpCount).toBeGreaterThanOrEqual(1);
    expect(result.fullSegment.length).toBeGreaterThanOrEqual(10);

    // Confirm monotonic right-to-left motion while crossing
    for (let i = 1; i < result.fullSegment.length; i++) {
      expect(result.fullSegment[i].x).toBeLessThanOrEqual(
        result.fullSegment[i - 1].x + 0.5
      );
    }

    const firstSample = result.fullSegment[0];
    const lastSample = result.fullSegment[result.fullSegment.length - 1];

    // Spans from outside/at right edge to outside left edge
    expect(firstSample.x).toBeGreaterThanOrEqual(
      firstSample.viewportWidth - 35
    );
    expect(firstSample.boxRight).toBeGreaterThanOrEqual(
      firstSample.viewportWidth - 1
    );
    expect(lastSample.x).toBeLessThanOrEqual(-lastSample.width + 35);
    expect(lastSample.boxLeft).toBeLessThanOrEqual(0);

    // Wraps cleanly back to right side and continues moving left
    const wrapFirst = result.postWrapSegment[0];
    const wrapLast = result.postWrapSegment[result.postWrapSegment.length - 1];
    expect(wrapFirst.x).toBeGreaterThanOrEqual(wrapFirst.viewportWidth - 35);
    expect(wrapLast.x).toBeLessThan(wrapFirst.x);
  });

  test("draws non-empty pixels on canvas across frames", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForPageReadyAndScrollToLane(page);

    await page.waitForFunction(
      () => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]'
        );
        if (!canvas || canvas.width === 0 || canvas.height === 0) {
          return false;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      },
      undefined,
      { timeout: 15_000 }
    );

    const alphaPixelCounts: number[] = [];
    for (let sampleIdx = 0; sampleIdx < 4; sampleIdx++) {
      const count = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]'
        );
        if (!canvas) return 0;
        const ctx = canvas.getContext("2d");
        if (!ctx) return 0;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonEmpty = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) nonEmpty += 1;
        }
        return nonEmpty;
      });
      alphaPixelCounts.push(count);
      if (sampleIdx < 3) {
        await page.waitForTimeout(120);
      }
    }

    for (const count of alphaPixelCounts) {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("maintains zero horizontal overflow across mobile, tablet, and desktop and toggles dark mode cleanly", async ({
    page,
  }) => {
    const viewports = [
      { name: "mobile", width: 375, height: 812 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ];

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const lane = await waitForPageReadyAndScrollToLane(page);
      await expect(lane).toBeVisible();

      const overflowCheck = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        overflowCheck.scrollWidth,
        `${vp.name} horizontal overflow`
      ).toBeLessThanOrEqual(overflowCheck.innerWidth);
    }

    // Verify dark mode toggle works cleanly on desktop without overflow or errors
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

    await expect(page.locator('[data-testid="riding-skeleton-lane"][data-riding-direction="left"]')).toBeVisible();
    await expect(page.locator('[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]')).toBeVisible();

    const darkOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(darkOverflow.scrollWidth).toBeLessThanOrEqual(darkOverflow.innerWidth);

    // Toggle back to restore initial theme cleanly
    await themeToggle.click();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains("dark"))
      )
      .toBe(wasDarkInitially);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("animates riding canvas right-to-left even under prefers-reduced-motion: reduce", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForPageReadyAndScrollToLane(page);

    const canvas = page.locator('[data-testid="riding-skeleton-canvas"][data-riding-direction="left"]');
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("riding-skeleton-poster")).toHaveCount(0);

    await expect
      .poll(
        async () =>
          canvas.evaluate(
            (el) => new DOMMatrix(getComputedStyle(el).transform).m41
          ),
        { timeout: 10_000 }
      )
      .toBeLessThan(1280);

    const xBefore = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );
    await page.waitForTimeout(450);
    const xAfter = await canvas.evaluate(
      (el) => new DOMMatrix(getComputedStyle(el).transform).m41
    );

    expect(xAfter).not.toBe(xBefore);
  });
});
