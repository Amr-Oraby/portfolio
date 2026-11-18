"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const SHEET_SRC = "/images/skeleton-riding-sheet.v1.webp";
const POSTER_SRC = "/images/skeleton-riding-poster.v1.webp";

const FRAME_COUNT = 28;
const GRID_COLS = 7;
const CELL_WIDTH = 300;
const CELL_HEIGHT = 286;
const GUTTER = 4;
const STRIDE_X = CELL_WIDTH + GUTTER * 2; // 308
const STRIDE_Y = CELL_HEIGHT + GUTTER * 2; // 294

const DESKTOP_SPEED_PX_S = 135;
const MOBILE_SPEED_PX_S = 95;
const CYCLE_RATIO = 0.92;
const RETRY_DELAYS_MS = [1000, 3000];

type NetworkInformation = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

function subscribeStaticPreference(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const connection = (navigator as NavigatorWithConnection).connection;
  const handleChange = () => onStoreChange();

  connection?.addEventListener?.("change", handleChange);

  return () => {
    connection?.removeEventListener?.("change", handleChange);
  };
}

function getStaticPreferenceSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return (navigator as NavigatorWithConnection).connection?.saveData === true;
}

function getStaticPreferenceServerSnapshot(): boolean {
  return false;
}

export interface RidingSkeletonProps {
  className?: string;
}

/**
 * Renders the bicycle-riding skeleton cruising along the top border of TechMarquee.
 * Lazily decodes a 28-frame WebP sprite sheet after the initial loader dismisses
 * and synchronizes pedal cadence to horizontal GSAP travel distance.
 */
export default function RidingSkeleton({ className }: RidingSkeletonProps) {
  const laneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const shouldUseStaticPoster = useSyncExternalStore(
    subscribeStaticPreference,
    getStaticPreferenceSnapshot,
    getStaticPreferenceServerSnapshot
  );
  const showStaticPoster = shouldUseStaticPoster || loadFailed;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (showStaticPoster || getStaticPreferenceSnapshot()) return;

    const laneEl = laneRef.current;
    const canvas = canvasRef.current;
    if (!laneEl || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      queueMicrotask(() => setLoadFailed(true));
      return;
    }

    let cancelled = false;
    const initialLoaderEl = document.getElementById("initial-loader-overlay");
    let loaderDone = !initialLoaderEl;
    let inPreloadZone = typeof IntersectionObserver === "undefined";
    let isVisible = typeof IntersectionObserver === "undefined";
    let loadStarted = false;
    let retryCount = 0;
    let retryTimer: number | null = null;

    let sheetImg: HTMLImageElement | null = null;
    let pendingImg: HTMLImageElement | null = null;
    let lastFrameIdx = -1;
    let traveledPx = 0;
    let prevProgress = 0;

    let bodyObserver: MutationObserver | null = null;
    let preloadObserver: IntersectionObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let mm: gsap.MatchMedia | null = null;
    let fallbackCleanup: (() => void) | null = null;
    let syncPlaybackRef: (() => void) | null = null;

    const drawFrame = (frameIdx: number) => {
      if (!ctx || !sheetImg || frameIdx === lastFrameIdx) return;

      const col = frameIdx % GRID_COLS;
      const row = Math.floor(frameIdx / GRID_COLS);
      const sx = col * STRIDE_X + GUTTER;
      const sy = row * STRIDE_Y + GUTTER;

      ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      ctx.drawImage(
        sheetImg,
        sx,
        sy,
        CELL_WIDTH,
        CELL_HEIGHT,
        0,
        0,
        CELL_WIDTH,
        CELL_HEIGHT
      );
      lastFrameIdx = frameIdx;
    };

    const measureTrackWidth = (isDesktop: boolean) => {
      const rectWidth = laneEl.getBoundingClientRect().width;
      if (rectWidth > 0) return rectWidth;
      if (laneEl.clientWidth > 0) return laneEl.clientWidth;
      if (window.innerWidth > 0) return window.innerWidth;
      return isDesktop ? 1280 : 390;
    };

    const measureRiderWidth = (isDesktop: boolean) => {
      const rectWidth = canvas.getBoundingClientRect().width;
      if (rectWidth > 0) return rectWidth;
      if (canvas.offsetWidth > 0) return canvas.offsetWidth;
      return isDesktop ? 98 : 76;
    };

    const setupBreakpointLoop = (
      isDesktop: boolean,
      context?: gsap.Context
    ) => {
      const speedPxPerSec = isDesktop
        ? DESKTOP_SPEED_PX_S
        : MOBILE_SPEED_PX_S;
      let tween: gsap.core.Tween | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let lastWidth = measureTrackWidth(isDesktop);

      const syncActiveTween = () => {
        if (!tween) return;
        const shouldPlay = isVisible && !document.hidden;
        if (shouldPlay) {
          if (tween.paused()) tween.play();
        } else if (!tween.paused()) {
          tween.pause();
        }
      };

      syncPlaybackRef = syncActiveTween;

      const buildTween = (
        initialProgress = 0,
        overrideTrackWidth?: number
      ) => {
        tween?.kill();

        const trackWidth =
          overrideTrackWidth && overrideTrackWidth > 0
            ? overrideTrackWidth
            : measureTrackWidth(isDesktop);
        const riderWidth = measureRiderWidth(isDesktop);
        const totalDistance = trackWidth + riderWidth;
        const duration = totalDistance / speedPxPerSec;

        gsap.set(canvas, { x: trackWidth });

        let isRestoring = initialProgress > 0;
        prevProgress = initialProgress;

        // Declare before gsap.fromTo because GSAP can invoke onUpdate synchronously
        // during immediateRender before assignment completes.
        let nextTween: gsap.core.Tween | null = null;
        nextTween = gsap.fromTo(
          canvas,
          { x: trackWidth },
          {
            x: -riderWidth,
            duration,
            ease: "none",
            repeat: -1,
            paused: true,
            onUpdate: () => {
              if (isRestoring || !nextTween) return;

              const progress = nextTween.progress();
              const deltaP =
                progress >= prevProgress
                  ? progress - prevProgress
                  : 1 - prevProgress + progress;
              traveledPx += deltaP * totalDistance;
              prevProgress = progress;

              const pxPerCycle = CYCLE_RATIO * riderWidth;
              const pxPerFrame = pxPerCycle / FRAME_COUNT;
              const frameIdx = Math.floor(traveledPx / pxPerFrame) % FRAME_COUNT;
              drawFrame(frameIdx);
            },
          }
        );

        if (initialProgress > 0) {
          nextTween.progress(initialProgress);
          prevProgress = initialProgress;
          isRestoring = false;
        }

        tween = nextTween;
        syncActiveTween();
      };

      buildTween(0);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver((entries) => {
          if (cancelled || context?.isReverted) return;

          const entryWidth = entries[0]?.contentRect?.width;
          const nextWidth =
            entryWidth && entryWidth > 0
              ? entryWidth
              : measureTrackWidth(isDesktop);

          // Ignore height-only changes (e.g., mobile browser address bar).
          if (Math.abs(nextWidth - lastWidth) < 0.5) return;

          lastWidth = nextWidth;
          const savedProgress = tween ? tween.progress() : 0;

          if (context) {
            context.add(() => buildTween(savedProgress, nextWidth));
          } else {
            buildTween(savedProgress, nextWidth);
          }
        });
        resizeObserver.observe(laneEl);
      }

      return () => {
        if (syncPlaybackRef === syncActiveTween) {
          syncPlaybackRef = null;
        }
        resizeObserver?.disconnect();
        resizeObserver = null;
        tween?.kill();
        tween = null;
      };
    };

    const setupAnimation = () => {
      if (cancelled) return;

      if (typeof window.matchMedia === "function") {
        mm = gsap.matchMedia();
        mm.add(
          {
            isDesktop: "(min-width: 768px)",
            isMobile: "(max-width: 767px)",
          },
          (context) => {
            const { isDesktop = false } = context.conditions ?? {};
            return setupBreakpointLoop(isDesktop, context);
          }
        );
      } else {
        fallbackCleanup = setupBreakpointLoop(window.innerWidth >= 768);
      }
    };

    const maybeStartLoad = () => {
      if (cancelled || loadStarted || !loaderDone || !inPreloadZone) return;
      loadStarted = true;

      const img = new window.Image();
      pendingImg = img;
      img.decoding = "async";
      img.src = SHEET_SRC;

      const finalizeReady = () => {
        if (cancelled) return;
        pendingImg = null;
        sheetImg = img;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        drawFrame(0);
        setupAnimation();
      };

      const handleLoadFailure = () => {
        if (cancelled || pendingImg !== img) return;
        img.onload = null;
        img.onerror = null;
        pendingImg = null;
        loadStarted = false;

        if (retryCount < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[retryCount++];
          retryTimer = window.setTimeout(() => {
            retryTimer = null;
            maybeStartLoad();
          }, delayMs);
        } else {
          setLoadFailed(true);
        }
      };

      img.onerror = handleLoadFailure;

      if (typeof img.decode === "function") {
        img.decode().then(finalizeReady, handleLoadFailure);
      } else if (img.complete && img.naturalWidth > 0) {
        finalizeReady();
      } else {
        img.onload = finalizeReady;
      }
    };

    const handleOnline = () => {
      if (cancelled || sheetImg || loadStarted) return;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      retryCount = 0;
      maybeStartLoad();
    };
    window.addEventListener("online", handleOnline);

    if (!loaderDone && initialLoaderEl) {
      const observeTarget = initialLoaderEl.parentElement ?? document.body;
      bodyObserver = new MutationObserver(() => {
        if (!document.getElementById("initial-loader-overlay")) {
          bodyObserver?.disconnect();
          bodyObserver = null;
          loaderDone = true;
          maybeStartLoad();
        }
      });
      bodyObserver.observe(observeTarget, {
        childList: true,
        subtree: false,
      });
    }

    if (typeof IntersectionObserver !== "undefined") {
      preloadObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            inPreloadZone = true;
            preloadObserver?.disconnect();
            preloadObserver = null;
            maybeStartLoad();
          }
        },
        { rootMargin: "900px 0px" }
      );
      preloadObserver.observe(laneEl);

      visibilityObserver = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
          syncPlaybackRef?.();
        },
        { threshold: 0, rootMargin: "120px 0px" }
      );
      visibilityObserver.observe(laneEl);
    }

    const handleVisibilityChange = () => {
      syncPlaybackRef?.();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    maybeStartLoad();

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      window.removeEventListener("online", handleOnline);
      if (pendingImg) {
        pendingImg.onload = null;
        pendingImg.onerror = null;
        pendingImg.src = "";
        pendingImg = null;
      }
      bodyObserver?.disconnect();
      preloadObserver?.disconnect();
      visibilityObserver?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      mm?.revert();
      mm = null;
      fallbackCleanup?.();
      fallbackCleanup = null;
      syncPlaybackRef = null;
    };
  }, [showStaticPoster]);

  return (
    <div
      ref={laneRef}
      data-testid="riding-skeleton-lane"
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none absolute top-0 inset-x-0 z-20 -translate-y-[calc(100%-2px)]",
        className
      )}
    >
      {showStaticPoster ? (
        <Image
          data-testid="riding-skeleton-poster"
          src={POSTER_SRC}
          alt=""
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          unoptimized
          className="ml-4 sm:ml-10 block w-[76px] sm:w-[88px] md:w-[98px] lg:w-[108px] h-auto dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      ) : (
        <canvas
          ref={canvasRef}
          data-testid="riding-skeleton-canvas"
          aria-hidden="true"
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          className="block w-[76px] sm:w-[88px] md:w-[98px] lg:w-[108px] aspect-[300/286] h-auto dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)] will-change-transform"
        />
      )}
    </div>
  );
}
