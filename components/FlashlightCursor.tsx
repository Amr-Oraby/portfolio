"use client";

import { useEffect, useRef } from "react";

export default function FlashlightCursor() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only activate on devices with a fine pointer (mouse/trackpad), never on touch-only devices
    const isPointerFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!isPointerFine) return;

    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;
    let mouseX = -1000;
    let mouseY = -1000;
    let isVisible = false;

    const updatePosition = () => {
      if (container) {
        container.style.setProperty("--fl-x", `${mouseX}px`);
        container.style.setProperty("--fl-y", `${mouseY}px`);
        if (!isVisible) {
          container.style.opacity = "1";
          isVisible = true;
        }
      }
      rafId = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!rafId) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseLeave = () => {
      if (container) container.style.opacity = "0";
      isVisible = false;
    };

    const handleMouseEnter = () => {
      if (container) container.style.opacity = "1";
      isVisible = true;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    document.documentElement.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      document.documentElement.removeEventListener("mouseenter", handleMouseEnter);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Completely disabled on touch / mobile devices */
            @media (hover: none), (pointer: coarse) {
              .fl-container {
                display: none !important;
              }
            }

            .fl-container {
              --fl-x: -1000px;
              --fl-y: -1000px;
            }

            /* Small, subtle, soft light surrounding the cursor (~120px-130px diameter) */
            /* Strictly preserves the original website colors, background, and typography */
            .fl-glow {
              mix-blend-mode: soft-light;
              background: radial-gradient(
                circle 52px at var(--fl-x) var(--fl-y),
                rgba(0, 0, 0, 0.18) 0%,
                rgba(0, 0, 0, 0.08) 25px,
                rgba(0, 0, 0, 0.015) 42px,
                transparent 52px
              );
            }

            /* Dark mode: gentle, subtle soft illumination around the cursor */
            .dark .fl-glow {
              mix-blend-mode: screen;
              background: radial-gradient(
                circle 65px at var(--fl-x) var(--fl-y),
                rgba(255, 255, 255, 0.16) 0%,
                rgba(255, 255, 255, 0.07) 30px,
                rgba(255, 255, 255, 0.015) 50px,
                transparent 65px
              );
            }
          `,
        }}
      />

      <div
        ref={containerRef}
        aria-hidden="true"
        className="fl-container pointer-events-none fixed inset-0 z-40 opacity-0 transition-opacity duration-300 ease-out"
      >
        {/* Soft, focused cursor light (no page darkening filter, 100% natural appearance) */}
        <div className="fl-glow pointer-events-none fixed inset-0" />
      </div>
    </>
  );
}
