"use client";

import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export const TYPING_SHEET_SRC = "/images/skeleton-hero-typing-sheet.v1.webp";
export const TYPING_POSTER_SRC = "/images/skeleton-hero-typing-poster.v1.webp";

const FRAME_COUNT = 55;
const NATIVE_FPS = 24;
const LOOP_DURATION_S = FRAME_COUNT / NATIVE_FPS;

const GRID_COLS = 8;
const CELL_WIDTH = 220;
const CELL_HEIGHT = 274;
const GUTTER = 4;
const STRIDE_X = CELL_WIDTH + GUTTER * 2; // 228
const STRIDE_Y = CELL_HEIGHT + GUTTER * 2; // 282

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

export interface TypingSkeletonProps {
  className?: string;
}

/**
 * Renders the Hero's infinitely looping typing skeleton animation inside
 * the existing Hero portrait frame using a 55-frame WebP sprite sheet and GSAP.
 * Defers sheet fetch until `#initial-loader-overlay` dismisses cleanly.
 */
const TypingSkeleton = memo(function TypingSkeleton({
  className,
}: TypingSkeletonProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const posterWrapperRef = useRef<HTMLDivElement>(null);
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

    const stageEl = stageRef.current;
    const posterWrapperEl = posterWrapperRef.current;
    if (posterWrapperEl) {
      posterWrapperEl.style.display = "";
    }

    if (showStaticPoster || getStaticPreferenceSnapshot()) return;

    const canvas = canvasRef.current;
    if (!stageEl || !canvas) return;

    if (canvas.width !== CELL_WIDTH) canvas.width = CELL_WIDTH;
    if (canvas.height !== CELL_HEIGHT) canvas.height = CELL_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      queueMicrotask(() => setLoadFailed(true));
      return;
    }

    let cancelled = false;
    const initialLoaderEl = document.getElementById("initial-loader-overlay");
    let loaderDone =
      document.documentElement.dataset.loaderSeen === "1" || !initialLoaderEl;
    let inPreloadZone = typeof IntersectionObserver === "undefined";
    let isVisible = typeof IntersectionObserver === "undefined";
    let loadStarted = false;
    let retryCount = 0;
    let retryTimer: number | null = null;
    let initialRafId: number | null = null;

    let sheetImg: HTMLImageElement | null = null;
    let pendingImg: HTMLImageElement | null = null;
    let lastFrameIdx = -1;

    let bodyObserver: MutationObserver | null = null;
    let preloadObserver: IntersectionObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let gsCtx: gsap.Context | null = null;
    let tween: gsap.core.Tween | null = null;
    let onlineHandlerAttached = false;

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const drawFrame = (frameIdx: number) => {
      if (cancelled || !sheetImg || frameIdx === lastFrameIdx) return;

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

    const syncPlayback = () => {
      if (!tween || cancelled) return;
      const shouldPlay = isVisible && !document.hidden;
      if (shouldPlay) {
        if (tween.paused()) tween.play();
      } else if (!tween.paused()) {
        tween.pause();
      }
    };

    const handleVisibilityChange = () => {
      if (cancelled) return;
      syncPlayback();
    };

    const handleOnlineRetry = () => {
      if (cancelled || sheetImg || loadStarted) return;
      onlineHandlerAttached = false;
      window.removeEventListener("online", handleOnlineRetry);
      clearRetryTimer();
      maybeStartLoad();
    };

    const handleLoadFailure = () => {
      if (cancelled) return;
      if (pendingImg) {
        pendingImg.onload = null;
        pendingImg.onerror = null;
        pendingImg.src = "";
        pendingImg = null;
      }
      loadStarted = false;

      if (retryCount < RETRY_DELAYS_MS.length) {
        const delayMs = RETRY_DELAYS_MS[retryCount];
        retryCount += 1;
        clearRetryTimer();
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          if (!cancelled) {
            maybeStartLoad();
          }
        }, delayMs);

        if (!onlineHandlerAttached) {
          onlineHandlerAttached = true;
          window.addEventListener("online", handleOnlineRetry);
        }
        return;
      }

      if (posterWrapperEl) {
        posterWrapperEl.style.display = "";
      }
      setLoadFailed(true);
    };

    const finalizeReady = () => {
      if (cancelled || !pendingImg) return;

      clearRetryTimer();
      if (onlineHandlerAttached) {
        onlineHandlerAttached = false;
        window.removeEventListener("online", handleOnlineRetry);
      }

      sheetImg = pendingImg;
      sheetImg.onload = null;
      sheetImg.onerror = null;
      pendingImg = null;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      drawFrame(0);

      if (posterWrapperEl) {
        posterWrapperEl.style.display = "none";
      }

      gsCtx = gsap.context(() => {
        const playhead = { frame: 0 };
        tween = gsap.to(playhead, {
          frame: FRAME_COUNT,
          duration: LOOP_DURATION_S,
          ease: "none",
          repeat: -1,
          paused: !(isVisible && !document.hidden),
          onUpdate: () => {
            const idx = Math.min(
              FRAME_COUNT - 1,
              Math.max(0, Math.floor(playhead.frame))
            );
            drawFrame(idx);
          },
        });
      }, stageEl);

      syncPlayback();
    };

    function maybeStartLoad() {
      if (cancelled || loadStarted || sheetImg || !loaderDone || !inPreloadZone) {
        return;
      }

      loadStarted = true;
      const img = new window.Image();
      pendingImg = img;
      img.decoding = "async";
      if ("fetchPriority" in img) {
        (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
          "low";
      }
      img.onerror = handleLoadFailure;
      if (typeof img.decode !== "function") {
        img.onload = finalizeReady;
      }
      img.src = TYPING_SHEET_SRC;

      if (typeof img.decode === "function") {
        img.decode().then(finalizeReady, handleLoadFailure);
      } else if (img.complete && img.naturalWidth > 0) {
        finalizeReady();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (typeof IntersectionObserver !== "undefined") {
      preloadObserver = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            inPreloadZone = true;
            preloadObserver?.disconnect();
            preloadObserver = null;
            if (loaderDone && initialRafId === null) {
              maybeStartLoad();
            }
          }
        },
        { rootMargin: "900px 0px" }
      );
      preloadObserver.observe(stageEl);

      visibilityObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          isVisible = entry.isIntersecting;
          syncPlayback();
        },
        { threshold: 0, rootMargin: "120px 0px" }
      );
      visibilityObserver.observe(stageEl);
    }

    if (!loaderDone && initialLoaderEl) {
      const targetParent = initialLoaderEl.parentElement ?? document.body;
      bodyObserver = new MutationObserver(() => {
        if (!document.getElementById("initial-loader-overlay")) {
          loaderDone = true;
          bodyObserver?.disconnect();
          bodyObserver = null;
          maybeStartLoad();
        }
      });
      bodyObserver.observe(targetParent, { childList: true, subtree: false });
    } else if (typeof window.requestAnimationFrame === "function") {
      // Defer 1 frame on repeat visits so initial hydration & Hero CSS paint cleanly first
      initialRafId = window.requestAnimationFrame(() => {
        initialRafId = null;
        maybeStartLoad();
      });
    } else {
      maybeStartLoad();
    }

    return () => {
      cancelled = true;
      if (initialRafId !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(initialRafId);
        initialRafId = null;
      }
      clearRetryTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (onlineHandlerAttached) {
        onlineHandlerAttached = false;
        window.removeEventListener("online", handleOnlineRetry);
      }
      bodyObserver?.disconnect();
      bodyObserver = null;
      preloadObserver?.disconnect();
      preloadObserver = null;
      visibilityObserver?.disconnect();
      visibilityObserver = null;
      if (pendingImg) {
        pendingImg.onload = null;
        pendingImg.onerror = null;
        pendingImg.src = "";
        pendingImg = null;
      }
      if (sheetImg) {
        sheetImg.onload = null;
        sheetImg.onerror = null;
        sheetImg.src = "";
        sheetImg = null;
      }
      gsCtx?.revert();
      gsCtx = null;
      tween = null;
      canvas.width = 0;
      canvas.height = 0;
      if (posterWrapperEl) {
        posterWrapperEl.style.display = "";
      }
    };
  }, [showStaticPoster]);

  return (
    <div
      ref={stageRef}
      data-testid="hero-typing-stage"
      className={cn(
        "relative flex items-center justify-center w-full h-full",
        className
      )}
    >
      <div
        ref={posterWrapperRef}
        className={cn(
          "flex items-center justify-center",
          showStaticPoster
            ? "w-full h-full"
            : "pointer-events-none absolute inset-0"
        )}
      >
        <Image
          data-testid="hero-typing-poster"
          src={TYPING_POSTER_SRC}
          alt="Amr Oraby skeleton character typing on laptop"
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          unoptimized
          loading="eager"
          decoding="async"
          className="w-full h-auto max-h-full object-contain select-none dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      </div>
      {!showStaticPoster && (
        <canvas
          ref={canvasRef}
          data-testid="hero-typing-canvas"
          role="img"
          aria-label="Amr Oraby skeleton character typing on laptop"
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          className="block w-full h-auto max-h-full aspect-[220/274] object-contain select-none dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      )}
    </div>
  );
});

export default TypingSkeleton;
