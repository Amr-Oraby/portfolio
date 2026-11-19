"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface MarqueeTrackProps {
  children: ReactNode;
}

/**
 * Pauses off-screen CSS marquee animations via IntersectionObserver and
 * document visibilitychange so hidden marquee bands consume zero GPU compositing.
 */
export default function MarqueeTrack({ children }: MarqueeTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    let isVisible = typeof IntersectionObserver === "undefined";

    const syncPlayState = () => {
      const shouldPlay = isVisible && !document.hidden;
      if (el.style.animationPlayState === (shouldPlay ? "running" : "paused")) return;
      el.style.animationPlayState = shouldPlay ? "running" : "paused";
    };

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
          syncPlayState();
        },
        { threshold: 0, rootMargin: "120px 0px" }
      );
      observer.observe(el.parentElement ?? el);
    }

    document.addEventListener("visibilitychange", syncPlayState);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncPlayState);
      el.style.animationPlayState = "";
    };
  }, []);

  return (
    <div
      ref={trackRef}
      className="animate-marquee whitespace-nowrap flex items-center"
    >
      {children}
    </div>
  );
}
