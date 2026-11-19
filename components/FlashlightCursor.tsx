"use client";

import { useEffect, useRef } from "react";

const ORB_HALF_PX = 65;

export default function FlashlightCursor() {
  const orbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (document.hidden) return;
    // Only activate on devices with a fine pointer (mouse/trackpad), never on touch-only devices
    const isPointerFine = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
    if (!isPointerFine) return;

    const orb = orbRef.current;
    if (!orb) return;

    let rafId: number | null = null;
    let mouseX = -1000;
    let mouseY = -1000;
    let isVisible = false;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        orb.style.opacity = "0";
        isVisible = false;
      }
    };

    const updatePosition = () => {
      orb.style.transform = `translate3d(${mouseX - ORB_HALF_PX}px, ${mouseY - ORB_HALF_PX}px, 0)`;
      if (!isVisible) {
        orb.style.opacity = "1";
        isVisible = true;
      }
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (rafId === null) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseLeave = () => {
      orb.style.opacity = "0";
      isVisible = false;
    };

    const handleMouseEnter = () => {
      orb.style.opacity = "1";
      isVisible = true;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={orbRef}
      aria-hidden="true"
      className="fl-orb pointer-events-none fixed top-0 left-0 z-40 h-[130px] w-[130px] rounded-full opacity-0 transition-opacity duration-300 ease-out will-change-transform [contain:layout_style_paint]"
      style={{ transform: "translate3d(-1000px, -1000px, 0)" }}
    />
  );
}
