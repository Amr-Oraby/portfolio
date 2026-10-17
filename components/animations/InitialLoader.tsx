"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jetbrainsMono } from "@/public/fonts/JetBrains";
import { fraunces } from "@/public/fonts/Fraunces";

const emptySubscribe = () => () => {};

export default function InitialLoader() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const shouldSkip = useSyncExternalStore(
    emptySubscribe,
    () => {
      try {
        if (typeof window !== "undefined") {
          if (window.location.search.includes("loader=true")) {
            return false;
          }
          return sessionStorage.getItem("portfolio_visited") === "true";
        }
        return false;
      } catch {
        return false;
      }
    },
    () => false
  );

  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const hasFinishedRef = useRef(false);

  // Lock scroll while loader is active
  useEffect(() => {
    if (shouldSkip || isDone) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [shouldSkip, isDone]);

  // Fast, punchy 2.0s loader progression
  useEffect(() => {
    if (!mounted || shouldSkip || isDone) return;

    const DURATION = 1400; // 1.4s progression + 150ms hold + 450ms exit = 2.0s total
    const startTime = performance.now();
    let animationFrameId: number;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      const fraction = Math.min(elapsed / DURATION, 1);
      const current = Math.min(Math.floor(fraction * 100), 100);

      setProgress(current);

      if (fraction < 1) {
        animationFrameId = requestAnimationFrame(tick);
      } else {
        setProgress(100);
        // Quick 150ms hold at 100%
        setTimeout(() => {
          setIsExiting(true);
        }, 150);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [mounted, shouldSkip, isDone]);

  const handleExitComplete = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    try {
      sessionStorage.setItem("portfolio_visited", "true");
      document.documentElement.classList.add("portfolio-visited");
    } catch {
      // Storage access fallback
    }

    document.body.style.overflow = "";
    setIsDone(true);
  };

  const getStatusText = (val: number) => {
    if (val < 35) return "INITIALIZING ENVIRONMENT";
    if (val < 70) return "CURATING DIGITAL WORKS";
    if (val < 100) return "CALIBRATING INTERACTION";
    return "EXPERIENCE READY";
  };

  // If already visited in session (after mount) or exit animation completed, render nothing
  if (isDone || (mounted && shouldSkip)) {
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
            {/* Monogram Box with Precision Framing */}
            <div className="relative mb-5 sm:mb-6">
              {/* Corner crosshair accents */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t border-l border-foreground/50" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t border-r border-foreground/50" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b border-l border-foreground/50" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b border-r border-foreground/50" />

              <div className="w-14 h-14 sm:w-16 sm:h-16 border border-foreground/80 flex items-center justify-center bg-background/60 backdrop-blur-xs">
                <span
                  className={`${fraunces.className} text-2xl sm:text-3xl font-light text-foreground select-none`}
                >
                  A
                </span>
              </div>
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
                <span className="tabular-nums font-semibold text-foreground">
                  {String(progress).padStart(2, "0")}%
                </span>
              </div>

              {/* Hairline Track with GPU scaleX */}
              <div className="w-full h-px bg-foreground/15 relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-foreground origin-left"
                  style={{
                    transform: `scaleX(${progress / 100})`,
                    willChange: "transform",
                  }}
                />
              </div>

              {/* Dynamic Status Text */}
              <div
                className={`${jetbrainsMono.className} mt-3 text-[9px] sm:text-[10px] tracking-[0.25em] text-main-gray uppercase h-4 flex items-center justify-center`}
              >
                <span>{getStatusText(progress)}</span>
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
