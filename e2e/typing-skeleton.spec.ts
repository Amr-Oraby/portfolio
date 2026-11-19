import { test, expect } from "@playwright/test";

test.describe("Hero TypingSkeleton E2E", () => {
  test("renders typing canvas in Hero portrait slot after loader, receives HTTP 200 immutable sheet, and removes the legacy sitting skeleton", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const sheetResponses: Array<{
      url: string;
      status: number;
      cacheControl: string;
    }> = [];
    const legacyPortraitRequests: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("skeleton-hero-typing-sheet.v1.webp")) {
        sheetResponses.push({
          url,
          status: res.status(),
          cacheControl: res.headers()["cache-control"] ?? "",
        });
      }
      if (url.includes("portrait.png")) {
        legacyPortraitRequests.push(url);
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Confirm sheet decode completes cleanly without legacy portrait fetch
    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 },
    );

    const stage = page.getByTestId("hero-typing-stage");
    const canvas = page.getByTestId("hero-typing-canvas");
    await expect(stage).toBeVisible();
    await expect(canvas).toBeVisible();

    await expect
      .poll(() => sheetResponses.length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(1);
    expect(sheetResponses[0].status).toBe(200);
    expect(sheetResponses[0].cacheControl).toContain("immutable");

    const sheetDecoded = await page.evaluate(async () => {
      const img = new Image();
      img.src = "/images/skeleton-hero-typing-sheet.v1.webp";
      await img.decode();
      return {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      };
    });
    expect(sheetDecoded.naturalWidth).toBe(1824);
    expect(sheetDecoded.naturalHeight).toBe(1974);

    // Poster wrapper hides after first canvas draw so drop-shadow does not double
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const poster = document.querySelector(
              '[data-testid="hero-typing-poster"]',
            );
            return poster?.parentElement?.style.display ?? "";
          }),
        { timeout: 10_000 },
      )
      .toBe("none");

    // Legacy sitting skeleton is removed; portrait, figure caption, and borders remain removed
    const sittingImg = page.locator('img[src*="skeleton-sitting.png"]');
    await expect(sittingImg).toHaveCount(0);
    await expect(page.locator("text=Fig. 001")).toHaveCount(0);
    await expect(page.locator("text=Portrait")).toHaveCount(0);
    expect(legacyPortraitRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("animates non-empty canvas pixels continuously past one full 2.29s cycle (infinite typing loop)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 },
    );

    await expect(page.getByTestId("hero-typing-canvas")).toBeVisible();

    // Wait for first frame draw
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const poster = document.querySelector(
              '[data-testid="hero-typing-poster"]',
            );
            return poster?.parentElement?.style.display ?? "";
          }),
        { timeout: 10_000 },
      )
      .toBe("none");

    const sampleSnapshot = async () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="hero-typing-canvas"]',
        ) as HTMLCanvasElement | null;
        if (!canvas) return null;
        const ctx = canvas.getContext("2d");
        if (!ctx || canvas.width === 0 || canvas.height === 0) return null;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonZeroAlpha = 0;
        let hash = 2166136261;
        for (let i = 0; i < data.length; i += 16) {
          if (data[i + 3] > 0) nonZeroAlpha += 1;
          hash ^= data[i] + (data[i + 3] << 8);
          hash = Math.imul(hash, 16777619);
        }
        return { nonZeroAlpha, hash };
      });

    const cycle1Hashes = new Set<number>();
    for (let i = 0; i < 8; i += 1) {
      const snap = await sampleSnapshot();
      expect(snap).not.toBeNull();
      expect(snap!.nonZeroAlpha).toBeGreaterThan(250);
      cycle1Hashes.add(snap!.hash);
      await page.waitForTimeout(160);
    }
    expect(cycle1Hashes.size).toBeGreaterThanOrEqual(4);

    // Wait across the 2.292s wrap boundary to ensure typing continues in cycle 2
    await page.waitForTimeout(1200);
    const cycle2Hashes = new Set<number>();
    for (let i = 0; i < 6; i += 1) {
      const snap = await sampleSnapshot();
      expect(snap).not.toBeNull();
      expect(snap!.nonZeroAlpha).toBeGreaterThan(250);
      cycle2Hashes.add(snap!.hash);
      await page.waitForTimeout(160);
    }
    expect(cycle2Hashes.size).toBeGreaterThanOrEqual(3);
  });

  test("starts cleanly on repeat refresh without loader, pauses off-screen, and keeps poster fallback on sheet failure", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.getElementById("initial-loader-overlay"),
      undefined,
      { timeout: 15_000 },
    );

    // Repeat refresh skips InitialLoader and starts typing canvas without stalling
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#initial-loader-overlay")).toHaveCount(0);
    await expect(page.getByTestId("hero-typing-canvas")).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const poster = document.querySelector(
              '[data-testid="hero-typing-poster"]',
            );
            return poster?.parentElement?.style.display ?? "";
          }),
        { timeout: 10_000 },
      )
      .toBe("none");

    const getCanvasHash = () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          '[data-testid="hero-typing-canvas"]',
        ) as HTMLCanvasElement | null;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || canvas.width === 0) return 0;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let h = 2166136261;
        for (let i = 0; i < data.length; i += 32) {
          h ^= data[i + 3] + (data[i] << 8);
          h = Math.imul(h, 16777619);
        }
        return h;
      });

    // Scroll far off-screen past Hero -> animation pauses cleanly
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const pausedHashA = await getCanvasHash();
    await page.waitForTimeout(350);
    const pausedHashB = await getCanvasHash();
    expect(pausedHashB).toBe(pausedHashA);

    // Scroll back to Hero top -> animation resumes
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(async () => (await getCanvasHash()) !== pausedHashA, {
        timeout: 4_000,
      })
      .toBe(true);

    // Aborted sprite sheet falls back cleanly to static poster without blank stage
    await page.route("**/skeleton-hero-typing-sheet.v1.webp", (route) =>
      route.abort("failed"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    const poster = page.getByTestId("hero-typing-poster");
    await expect(poster).toBeVisible();
    const posterNaturalW = await poster.evaluate(
      (img: HTMLImageElement) => img.naturalWidth,
    );
    expect(posterNaturalW).toBeGreaterThan(0);
  });

  test("preserves responsive zero-overflow layout across breakpoints, supports dark mode, and animates under reduced-motion", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const vp of [
      { name: "narrow-mobile", width: 320, height: 568 },
      { name: "mobile", width: 375, height: 812 },
      { name: "sm-tablet", width: 640, height: 800 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "lg-desktop", width: 1024, height: 768 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () => !document.getElementById("initial-loader-overlay"),
        undefined,
        { timeout: 15_000 },
      );

      const canvas = page.getByTestId("hero-typing-canvas");
      const headline = page.locator("text=experiences.");
      const bottomBar = page.locator("text=Amr Oraby").first();
      await expect(canvas).toBeVisible();

      const box = await canvas.boundingBox();
      const headlineBox = await headline.boundingBox();
      const bottomBarBox = await bottomBar.boundingBox();
      expect(box).not.toBeNull();
      expect(headlineBox).not.toBeNull();
      expect(bottomBarBox).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(200);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);

      // Ensure enlarged typing skeleton never overlaps Hero headline text or bottom signature
      const overlaps = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ) =>
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      expect(overlaps(box!, headlineBox!), `${vp.name} headline overlap`).toBe(
        false,
      );
      expect(
        overlaps(box!, bottomBarBox!),
        `${vp.name} bottom bar overlap`,
      ).toBe(false);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(
        overflow.scrollWidth,
        `${vp.name} horizontal overflow`,
      ).toBeLessThanOrEqual(overflow.innerWidth);
    }

    // Confirm typing animation runs even under reduced-motion (D2)
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const poster = document.querySelector(
              '[data-testid="hero-typing-poster"]',
            );
            return poster?.parentElement?.style.display ?? "";
          }),
        { timeout: 10_000 },
      )
      .toBe("none");

    const themeToggle = page.getByRole("button", { name: "Toggle theme" });
    const wasDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    );
    await themeToggle.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains("dark"),
        ),
      )
      .toBe(!wasDark);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
