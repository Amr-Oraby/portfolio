"use client";

import {
  memo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const SHEET_SRC = "/images/skeleton-backflip-sheet.v2.webp";
const POSTER_SRC = "/images/skeleton-backflip-poster.v2.webp";
const FALLBACK_EMBLEM_SRC = "/images/skull-logo.png";

const FRAME_COUNT = 88;
const GRID_COLS = 10;
const GRID_ROWS = 9;
const CELL_WIDTH = 180;
const CELL_HEIGHT = 204;
const GUTTER = 4;

const BACKFLIP_DURATION_S = 1.45;
const DEFAULT_START_DEADLINE_MS = 600;

type NetworkInformation = {
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

function subscribeSaveData(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const connection = (navigator as NavigatorWithConnection).connection;
  const handleChange = () => onStoreChange();

  connection?.addEventListener?.("change", handleChange);

  return () => {
    connection?.removeEventListener?.("change", handleChange);
  };
}

function getSaveDataSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return (navigator as NavigatorWithConnection).connection?.saveData === true;
}

function getSaveDataServerSnapshot(): boolean {
  return false;
}

export interface LoaderBackflipSkeletonProps {
  onFinished?: () => void;
  startDeadlineMs?: number;
  className?: string;
}

/**
 * Renders the one-shot 88-frame backflipping skeleton for InitialLoader.
 * Shows the frame-0 poster underlay until the sprite sheet decodes within
 * the start deadline and paints frame 0 onto the canvas.
 */
const LoaderBackflipSkeleton = memo(function LoaderBackflipSkeleton({
  onFinished,
  startDeadlineMs = DEFAULT_START_DEADLINE_MS,
  className,
}: LoaderBackflipSkeletonProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const posterWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFinishedRef = useRef(onFinished);
  const hasFinishedRef = useRef(false);

  const [loadFailed, setLoadFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  const saveData = useSyncExternalStore(
    subscribeSaveData,
    getSaveDataSnapshot,
    getSaveDataServerSnapshot
  );
  const showStaticPoster = saveData || loadFailed;

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stageEl = stageRef.current;
    const posterWrapperEl = posterWrapperRef.current;
    if (posterWrapperEl) {
      posterWrapperEl.style.display = "";
    }

    let cancelled = false;

    const finishOnce = () => {
      if (cancelled || hasFinishedRef.current) return;
      hasFinishedRef.current = true;
      onFinishedRef.current?.();
    };

    if (showStaticPoster || getSaveDataSnapshot()) {
      queueMicrotask(finishOnce);
      return () => {
        cancelled = true;
      };
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== CELL_WIDTH) canvas.width = CELL_WIDTH;
    if (canvas.height !== CELL_HEIGHT) canvas.height = CELL_HEIGHT;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      queueMicrotask(() => {
        if (cancelled) return;
        setLoadFailed(true);
        finishOnce();
      });
      return () => {
        cancelled = true;
      };
    }

    let settled = false;
    let hasCompleted = false;
    let deadlineTimer: number | null = null;
    let pendingImg: HTMLImageElement | null = null;
    let sheetImg: HTMLImageElement | null = null;
    let gsCtx: gsap.Context | null = null;
    let tween: gsap.core.Tween | null = null;
    let lastFrameIdx = -1;

    const clearDeadline = () => {
      if (deadlineTimer !== null) {
        window.clearTimeout(deadlineTimer);
        deadlineTimer = null;
      }
    };

    const drawFrame = (frameIdx: number) => {
      if (cancelled || !sheetImg || frameIdx === lastFrameIdx) return;

      const strideX =
        sheetImg.naturalWidth > 0 ? sheetImg.naturalWidth / GRID_COLS : CELL_WIDTH + GUTTER * 2;
      const strideY =
        sheetImg.naturalHeight > 0 ? sheetImg.naturalHeight / GRID_ROWS : CELL_HEIGHT + GUTTER * 2;
      const srcCellW = Math.max(1, strideX - GUTTER * 2);
      const srcCellH = Math.max(1, strideY - GUTTER * 2);

      const col = frameIdx % GRID_COLS;
      const row = Math.floor(frameIdx / GRID_COLS);
      const sx = col * strideX + GUTTER;
      const sy = row * strideY + GUTTER;

      ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      ctx.drawImage(
        sheetImg,
        sx,
        sy,
        srcCellW,
        srcCellH,
        0,
        0,
        CELL_WIDTH,
        CELL_HEIGHT
      );
      lastFrameIdx = frameIdx;
    };

    const abortAndFallback = () => {
      if (cancelled || settled) return;
      settled = true;
      clearDeadline();
      if (pendingImg) {
        pendingImg.onload = null;
        pendingImg.onerror = null;
        pendingImg.src = "";
        pendingImg = null;
      }
      if (posterWrapperEl) {
        posterWrapperEl.style.display = "";
      }
      setLoadFailed(true);
      finishOnce();
    };

    const finalizeReady = () => {
      if (cancelled || settled || !pendingImg) return;
      settled = true;
      clearDeadline();

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
          duration: BACKFLIP_DURATION_S,
          ease: "none",
          repeat: 0,
          paused: document.hidden,
          onUpdate: () => {
            const idx = Math.min(
              FRAME_COUNT - 1,
              Math.max(0, Math.floor(playhead.frame))
            );
            drawFrame(idx);
          },
          onComplete: () => {
            hasCompleted = true;
            drawFrame(FRAME_COUNT - 1);
            finishOnce();
          },
        });
      }, stageEl ?? undefined);
    };

    const handleVisibilityChange = () => {
      if (cancelled) return;
      if (document.hidden) {
        tween?.pause();
      } else if (!hasCompleted) {
        tween?.play();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    deadlineTimer = window.setTimeout(abortAndFallback, startDeadlineMs);

    const img = new window.Image();
    pendingImg = img;
    img.decoding = "async";
    img.onerror = abortAndFallback;
    if (typeof img.decode !== "function") {
      img.onload = finalizeReady;
    }
    img.src = SHEET_SRC;

    if (typeof img.decode === "function") {
      img.decode().then(finalizeReady, abortAndFallback);
    } else if (img.complete && img.naturalWidth > 0) {
      finalizeReady();
    }

    return () => {
      cancelled = true;
      clearDeadline();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
  }, [showStaticPoster, startDeadlineMs]);

  return (
    <div
      ref={stageRef}
      data-testid="loader-backflip-stage"
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 xl:w-60 xl:h-60",
        className
      )}
    >
      <div
        ref={posterWrapperRef}
        className={cn(
          "flex items-center justify-center",
          showStaticPoster
            ? "h-full w-full"
            : "pointer-events-none absolute inset-0"
        )}
      >
        <Image
          data-testid="loader-backflip-poster"
          src={posterFailed ? FALLBACK_EMBLEM_SRC : POSTER_SRC}
          alt=""
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          unoptimized
          loading="eager"
          onError={() => setPosterFailed(true)}
          className="h-full w-auto max-w-full object-contain select-none dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      </div>
      {!showStaticPoster && (
        <canvas
          ref={canvasRef}
          data-testid="loader-backflip-canvas"
          aria-hidden="true"
          width={CELL_WIDTH}
          height={CELL_HEIGHT}
          className="block h-full w-auto max-w-full aspect-[180/204] select-none dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      )}
    </div>
  );
});

export default LoaderBackflipSkeleton;
