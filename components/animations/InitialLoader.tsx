"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jetbrainsMono } from "@/public/fonts/JetBrains";
import { fraunces } from "@/public/fonts/Fraunces";
import LoaderBackflipSkeleton from "@/components/animations/LoaderBackflipSkeleton";

const BASE_DURATION_MS = 1400;
const START_DEADLINE_MS = 600;
const MAX_LOADER_MS = 2400;
const HOLD_COMPLETE_MS = 150;
const EXIT_FALLBACK_MS = 700;
export const LOADER_SEEN_KEY = "portfolio-initial-loader-seen";

const STATUS_INIT = "INITIALIZING ENVIRONMENT";
const STATUS_CURATE = "CURATING DIGITAL WORKS";
const STATUS_CALIBRATE = "CALIBRATING INTERACTION";
const STATUS_READY = "EXPERIENCE READY";

const INITIAL_TRACK_STYLE = {
  transform: "scaleX(0)",
  willChange: "transform",
} as const;

const emptySubscribe = () => () => {};

function getLoaderSeenSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      document.documentElement.dataset.loaderSeen === "1" ||
      window.sessionStorage.getItem(LOADER_SEEN_KEY) === "1"
    );
  } catch {
    return document.documentElement.dataset.loaderSeen === "1";
  }
}

function getLoaderSeenServerSnapshot(): boolean {
  return false;
}

function markLoaderSeenStorage(): void {
  try {
    window.sessionStorage.setItem(LOADER_SEEN_KEY, "1");
  } catch {
    // Ignore storage errors in restricted browsing contexts
  }
}

function getStatusText(val: number): string {
  if (val < 35) return STATUS_INIT;
  if (val < 70) return STATUS_CURATE;
  if (val < 100) return STATUS_CALIBRATE;
  return STATUS_READY;
}

export default function InitialLoader() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const alreadySeen = useSyncExternalStore(
    emptySubscribe,
    getLoaderSeenSnapshot,
    getLoaderSeenServerSnapshot
  );

  const [statusText, setStatusText] = useState(STATUS_INIT);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const percentRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hasFinishedRef = useRef(false);
  const rampDoneRef = useRef(false);
  const animDoneRef = useRef(false);
  const completedRef = useRef(false);
  const tryCompleteRef = useRef<(() => void) | null>(null);

  const handleExitComplete = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    markLoaderSeenStorage();
    document.documentElement.dataset.loaderSeen = "1";
    document.body.style.overflow = "";
    setIsDone(true);
  }, []);

  const handleAnimFinished = useCallback(() => {
    animDoneRef.current = true;
    tryCompleteRef.current?.();
  }, []);

  // Lock scroll while loader is active
  useEffect(() => {
    if (isDone || alreadySeen || getLoaderSeenSnapshot()) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isDone, alreadySeen]);

  // Coordinated dual-gate loader progression (1.4s ramp + backflip completion, hard-capped at 2.4s)
  useEffect(() => {
    if (!mounted || isDone || alreadySeen || getLoaderSeenSnapshot()) return;

    let cancelled = false;
    const startTime = performance.now();
    let animationFrameId = 0;
    let maxTimer: number | null = null;
    let holdTimer: number | null = null;
    let exitFallbackTimer: number | null = null;
    let lastStatus = STATUS_INIT;

    const tryComplete = () => {
      if (
        cancelled ||
        completedRef.current ||
        !rampDoneRef.current ||
        !animDoneRef.current
      ) {
        return;
      }

      completedRef.current = true;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (maxTimer !== null) {
        window.clearTimeout(maxTimer);
        maxTimer = null;
      }

      if (percentRef.current) {
        percentRef.current.textContent = "100%";
      }
      if (trackRef.current) {
        trackRef.current.style.transform = "scaleX(1)";
      }
      if (lastStatus !== STATUS_READY) {
        lastStatus = STATUS_READY;
        setStatusText(STATUS_READY);
      }

      holdTimer = window.setTimeout(() => {
        holdTimer = null;
        if (cancelled) return;
        setIsExiting(true);
        exitFallbackTimer = window.setTimeout(() => {
          exitFallbackTimer = null;
          if (!cancelled) {
            handleExitComplete();
          }
        }, EXIT_FALLBACK_MS);
      }, HOLD_COMPLETE_MS);
    };

    tryCompleteRef.current = tryComplete;

    if (rampDoneRef.current && animDoneRef.current) {
      tryComplete();
    }

    const tick = (now: number) => {
      if (cancelled || completedRef.current) return;

      const elapsed = Math.max(0, now - startTime);
      const fraction = Math.min(elapsed / BASE_DURATION_MS, 1);

      if (fraction < 1) {
        const current = Math.min(Math.floor(fraction * 100), 99);
        if (percentRef.current) {
          percentRef.current.textContent = `${String(current).padStart(2, "0")}%`;
        }
        if (trackRef.current) {
          trackRef.current.style.transform = `scaleX(${Math.min(fraction, 0.99)})`;
        }
        const nextStatus = getStatusText(current);
        if (nextStatus !== lastStatus) {
          lastStatus = nextStatus;
          setStatusText(nextStatus);
        }
        animationFrameId = requestAnimationFrame(tick);
      } else {
        animationFrameId = 0;
        rampDoneRef.current = true;
        tryComplete();

        if (!completedRef.current) {
          if (percentRef.current) {
            percentRef.current.textContent = "99%";
          }
          if (trackRef.current) {
            trackRef.current.style.transform = "scaleX(0.99)";
          }
          if (lastStatus !== STATUS_CALIBRATE) {
            lastStatus = STATUS_CALIBRATE;
            setStatusText(STATUS_CALIBRATE);
          }
        }
      }
    };

    maxTimer = window.setTimeout(() => {
      maxTimer = null;
      if (cancelled || completedRef.current) return;
      rampDoneRef.current = true;
      animDoneRef.current = true;
      tryComplete();
    }, MAX_LOADER_MS);

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      tryCompleteRef.current = null;
      if (completedRef.current && !hasFinishedRef.current) {
        markLoaderSeenStorage();
        document.documentElement.dataset.loaderSeen = "1";
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (maxTimer !== null) {
        window.clearTimeout(maxTimer);
        maxTimer = null;
      }
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (exitFallbackTimer !== null) {
        window.clearTimeout(exitFallbackTimer);
        exitFallbackTimer = null;
      }
    };
  }, [mounted, isDone, alreadySeen, handleExitComplete]);

  // If skipped on subsequent refreshes or exit animation completed, render nothing
  if (isDone || alreadySeen) {
    return null;
  }

  return (
    <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
      {!isExiting && (
        <motion.div
          id="initial-loader-overlay"
          key="initial-loader"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{
            y: "-100%",
            transition: {
              duration: 0.45,
              ease: [0.76, 0, 0.24, 1], // Crisp luxury editorial curve
            },
          }}
          className="fixed inset-0 z-[9999] flex flex-col justify-between bg-background text-foreground select-none overflow-hidden"
          style={{ willChange: "transform" }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--border) 0%, transparent 65%)",
            }}
          />

          {/* Architectural Crop Marks (Four Corners) */}
          <div className="absolute top-5 left-5 sm:top-9 sm:left-9 w-4 h-4 sm:w-6 sm:h-6 border-t border-l border-foreground/30 pointer-events-none" />
          <div className="absolute top-5 right-5 sm:top-9 sm:right-9 w-4 h-4 sm:w-6 sm:h-6 border-t border-r border-foreground/30 pointer-events-none" />
          <div className="absolute bottom-5 left-5 sm:bottom-9 sm:left-9 w-4 h-4 sm:w-6 sm:h-6 border-b border-l border-foreground/30 pointer-events-none" />
          <div className="absolute bottom-5 right-5 sm:bottom-9 sm:right-9 w-4 h-4 sm:w-6 sm:h-6 border-b border-r border-foreground/30 pointer-events-none" />

          {/* Top Editorial Metadata Bar */}
          <div
            className={`${jetbrainsMono.className} w-full flex justify-between items-center text-[9px] sm:text-[10px] tracking-[0.25em] uppercase text-main-gray pt-6 px-7 sm:pt-10 sm:px-14 z-10`}
          >
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground/80 animate-pulse" />
              <span>FRONTEND DEVELOPER</span>
            </div>
            <span className="hidden sm:inline-block">ISSUE Nº 07 / MMXXVI</span>
          </div>

          {/* Centerpiece Focal Point */}
          <motion.div
            exit={{ opacity: 0, y: -20, transition: { duration: 0.25, ease: "easeIn" } }}
            className="relative z-10 flex flex-col items-center text-center px-4 my-auto"
          >
            {/* Skeleton Stage */}
            <div className="relative mb-5 sm:mb-6">
              <LoaderBackflipSkeleton
                onFinished={handleAnimFinished}
                startDeadlineMs={START_DEADLINE_MS}
              />
            </div>

            {/* Brand Name Title */}
            <div className="mb-1">
              <h1
                className={`${jetbrainsMono.className} text-xs sm:text-sm font-semibold tracking-[0.32em] uppercase text-foreground`}
              >
                AMR ORABY
              </h1>
            </div>

            {/* Editorial Tagline */}
            <div className="mb-7">
              <p
                className={`${fraunces.className} font-serif italic text-xs sm:text-sm text-main-gray`}
              >
                Building digital experiences.
              </p>
            </div>

            {/* Precision Metric & Progress Line */}
            <div className="w-52 sm:w-64 flex flex-col items-center">
              <div
                className={`${jetbrainsMono.className} w-full flex justify-between items-center text-[10px] tracking-[0.2em] text-main-gray mb-2.5`}
              >
                <span className="tabular-nums">SYS.01</span>
                <span
                  ref={percentRef}
                  className="tabular-nums font-semibold text-foreground"
                >
                  00%
                </span>
              </div>

              {/* Hairline Track with GPU scaleX */}
              <div className="w-full h-px bg-foreground/15 relative overflow-hidden">
                <div
                  ref={trackRef}
                  className="absolute inset-0 bg-foreground origin-left"
                  style={INITIAL_TRACK_STYLE}
                />
              </div>

              {/* Dynamic Status Text */}
              <div
                className={`${jetbrainsMono.className} mt-3 text-[9px] sm:text-[10px] tracking-[0.25em] text-main-gray uppercase h-4 flex items-center justify-center`}
              >
                <span>{statusText}</span>
              </div>
            </div>
          </motion.div>

          {/* Bottom Editorial Metadata Bar */}
          <div
            className={`${jetbrainsMono.className} w-full flex justify-between items-center text-[9px] sm:text-[10px] tracking-[0.25em] uppercase text-main-gray pb-6 px-7 sm:pb-10 sm:px-14 z-10`}
          >
            <span>PORTFOLIO © 2026</span>
            <span className="hidden sm:inline-block">EST. 2018</span>
            <span>FIG. 000 / INIT</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
