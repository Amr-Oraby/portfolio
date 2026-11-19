import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import nextConfig from "@/next.config";

const ROOT = path.resolve(__dirname, "../../..");

describe("Build config & static animation assets", () => {
  it("keeps riding sprite sheet and fallback poster within size budgets", () => {
    const sheetPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-riding-sheet.v1.webp"
    );
    const posterPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-riding-poster.v1.webp"
    );

    expect(fs.existsSync(sheetPath)).toBe(true);
    expect(fs.existsSync(posterPath)).toBe(true);

    const sheetBytes = fs.statSync(sheetPath).size;
    const posterBytes = fs.statSync(posterPath).size;

    expect(sheetBytes).toBeGreaterThan(0);
    expect(sheetBytes).toBeLessThanOrEqual(350 * 1024);
    expect(posterBytes).toBeGreaterThan(0);
    expect(posterBytes).toBeLessThanOrEqual(60 * 1024);
  });

  it("keeps backflip sprite sheet and fallback poster within size budgets", () => {
    const sheetPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-backflip-sheet.v2.webp"
    );
    const posterPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-backflip-poster.v2.webp"
    );

    expect(fs.existsSync(sheetPath)).toBe(true);
    expect(fs.existsSync(posterPath)).toBe(true);

    const sheetBytes = fs.statSync(sheetPath).size;
    const posterBytes = fs.statSync(posterPath).size;

    expect(sheetBytes).toBeGreaterThan(0);
    expect(sheetBytes).toBeLessThanOrEqual(250 * 1024);
    expect(posterBytes).toBeGreaterThan(0);
    expect(posterBytes).toBeLessThanOrEqual(25 * 1024);

    const mobileSheetPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-backflip-sheet-mobile.v3.webp"
    );
    const mobilePosterPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-backflip-poster-mobile.v3.webp"
    );
    expect(fs.existsSync(mobileSheetPath)).toBe(true);
    expect(fs.existsSync(mobilePosterPath)).toBe(true);
    expect(fs.statSync(mobileSheetPath).size).toBeLessThanOrEqual(150 * 1024);
    expect(fs.statSync(mobilePosterPath).size).toBeLessThanOrEqual(10 * 1024);
  });

  it("keeps hero typing sprite sheet and fallback poster within size budgets", () => {
    const sheetPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-hero-typing-sheet.v1.webp"
    );
    const posterPath = path.join(
      ROOT,
      "public",
      "images",
      "skeleton-hero-typing-poster.v1.webp"
    );

    expect(fs.existsSync(sheetPath)).toBe(true);
    expect(fs.existsSync(posterPath)).toBe(true);

    const sheetBytes = fs.statSync(sheetPath).size;
    const posterBytes = fs.statSync(posterPath).size;

    expect(sheetBytes).toBeGreaterThan(0);
    expect(sheetBytes).toBeLessThanOrEqual(250 * 1024);
    expect(posterBytes).toBeGreaterThan(0);
    expect(posterBytes).toBeLessThanOrEqual(25 * 1024);
  });

  it("contains no unused starter SVGs or orphaned image assets in public/", () => {
    const removedAssets = [
      "public/file.svg",
      "public/globe.svg",
      "public/next.svg",
      "public/vercel.svg",
      "public/window.svg",
      "public/images/authjs-logo.svg",
      "public/images/project 1.jpg",
      "public/images/project 2.jpg",
    ];

    for (const relPath of removedAssets) {
      expect(
        fs.existsSync(path.join(ROOT, relPath)),
        `${relPath} should be removed`
      ).toBe(false);
    }
  });

  it("configures immutable Cache-Control headers for versioned skeleton WebP assets", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    const headerRules = await nextConfig.headers!();

    for (const target of [
      "/images/skeleton-riding-sheet.v1.webp",
      "/images/skeleton-riding-poster.v1.webp",
      "/images/skeleton-backflip-sheet.v2.webp",
      "/images/skeleton-backflip-poster.v2.webp",
      "/images/skeleton-backflip-sheet-mobile.v3.webp",
      "/images/skeleton-backflip-poster-mobile.v3.webp",
      "/images/skeleton-hero-typing-sheet.v1.webp",
      "/images/skeleton-hero-typing-poster.v1.webp",
    ]) {
      const rule = headerRules.find((r) => r.source === target);
      expect(rule, `Missing headers rule for ${target}`).toBeDefined();
      const cacheHeader = rule?.headers.find(
        (h) => h.key.toLowerCase() === "cache-control"
      );
      expect(cacheHeader?.value).toContain("max-age=31536000");
      expect(cacheHeader?.value).toContain("immutable");
    }
  });
});
