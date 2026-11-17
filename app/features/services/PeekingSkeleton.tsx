"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";

export interface PeekingSkeletonProps {
  active: boolean;
}

export default function PeekingSkeleton({ active }: PeekingSkeletonProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const skullRef = useRef<HTMLDivElement>(null);
  const leftHandRef = useRef<HTMLDivElement>(null);
  const rightHandRef = useRef<HTMLDivElement>(null);

  const activeRef = useRef(active);
  const isVisibleRef = useRef(false);
  const loaderDoneRef = useRef(false);
  const hasEnteredRef = useRef(false);
  const syncFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    activeRef.current = active;
    syncFnRef.current?.();
  }, [active]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const anchorEl = anchorRef.current;
    const skullEl = skullRef.current;
    const leftHandEl = leftHandRef.current;
    const rightHandEl = rightHandRef.current;
    if (!anchorEl || !skullEl || !leftHandEl || !rightHandEl) return;

    let entranceDelay: gsap.core.Tween | null = null;
    let bodyObserver: MutationObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let tl: gsap.core.Timeline | null = null;

    const syncPlayback = () => {
      if (!tl) return;

      const shouldPlay =
        activeRef.current &&
        loaderDoneRef.current &&
        hasEnteredRef.current &&
        isVisibleRef.current &&
        !document.hidden;

      if (shouldPlay) {
        if (tl.paused()) {
          tl.play(0);
        }
      } else if (!tl.paused() || tl.progress() > 0) {
        tl.pause(0);
      }
    };

    const scheduleEntranceSettled = () => {
      if (hasEnteredRef.current || entranceDelay) return;
      // Short 0.55s settle so Card 02 is upright in view before first peek
      entranceDelay = gsap.delayedCall(0.55, () => {
        entranceDelay = null;
        hasEnteredRef.current = true;
        syncPlayback();
      });
    };

    const checkLoaderAndArm = () => {
      if (!activeRef.current) return;

      const loaderEl = document.getElementById("initial-loader-overlay");
      if (!loaderEl) {
        loaderDoneRef.current = true;
        scheduleEntranceSettled();
        return;
      }

      if (!bodyObserver) {
        bodyObserver = new MutationObserver(() => {
          if (!document.getElementById("initial-loader-overlay")) {
            bodyObserver?.disconnect();
            bodyObserver = null;
            loaderDoneRef.current = true;
            if (activeRef.current) {
              scheduleEntranceSettled();
            }
          }
        });
        bodyObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    };

    const syncAndArm = () => {
      if (activeRef.current && !hasEnteredRef.current) {
        checkLoaderAndArm();
      }
      syncPlayback();
    };

    syncFnRef.current = syncAndArm;

    const ctx = gsap.context(() => {
      // Always start in true null hidden state
      gsap.set(skullEl, {
        yPercent: 100,
        autoAlpha: 0,
        rotation: 0,
        transformOrigin: "center bottom",
      });
      gsap.set([leftHandEl, rightHandEl], {
        y: 8,
        scaleY: 0.45,
        scaleX: 0.85,
        autoAlpha: 0,
        transformOrigin: "center bottom",
      });

      const timeline = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.65,
        paused: true,
      });

      // 1. Skull emerges from behind Card 02's top border
      timeline
        .to(skullEl, {
          autoAlpha: 1,
          duration: 0.04,
          ease: "none",
        })
        .to(
          skullEl,
          {
            yPercent: 12,
            duration: 0.48,
            ease: "back.out(1.35)",
          },
          "<"
        )
        // 2. Hands appear & clamp onto the top border strictly after skull settles
        .to(
          [leftHandEl, rightHandEl],
          {
            autoAlpha: 1,
            duration: 0.04,
            stagger: 0.08,
            ease: "none",
          },
          ">"
        )
        .to(
          [leftHandEl, rightHandEl],
          {
            y: 0,
            scaleY: 1,
            scaleX: 1,
            duration: 0.28,
            stagger: 0.08,
            ease: "back.out(1.6)",
          },
          "<"
        )
        // 3. Brief curious idle tilt/bob returning cleanly to baseline
        .to(skullEl, {
          yPercent: 7,
          rotation: -1.5,
          duration: 0.35,
          ease: "sine.inOut",
        })
        .to(skullEl, {
          yPercent: 10,
          rotation: 1.5,
          duration: 0.35,
          ease: "sine.inOut",
        })
        .to(skullEl, {
          yPercent: 12,
          rotation: 0,
          duration: 0.3,
          ease: "sine.inOut",
        })
        // 4. Hands release and vanish back to exact initial state
        .to([leftHandEl, rightHandEl], {
          y: 8,
          scaleY: 0.45,
          scaleX: 0.85,
          duration: 0.24,
          ease: "power2.in",
        })
        .to(
          [leftHandEl, rightHandEl],
          {
            autoAlpha: 0,
            duration: 0.05,
            ease: "none",
          },
          ">-0.05"
        )
        // 5. Skull ducks behind the card border back to null
        .to(
          skullEl,
          {
            yPercent: 100,
            duration: 0.42,
            ease: "power2.in",
          },
          ">"
        )
        .to(
          skullEl,
          {
            autoAlpha: 0,
            duration: 0.05,
            ease: "none",
          },
          ">-0.05"
        );

      tl = timeline;
    }, anchorRef);

    const observeTarget = anchorEl.parentElement ?? anchorEl;

    if (typeof IntersectionObserver !== "undefined") {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          isVisibleRef.current = entries.some((entry) => entry.isIntersecting);
          syncAndArm();
        },
        { threshold: 0.05, rootMargin: "80px 0px" }
      );
      intersectionObserver.observe(observeTarget);
    } else {
      isVisibleRef.current = true;
    }

    document.addEventListener("visibilitychange", syncAndArm);
    syncAndArm();

    return () => {
      syncFnRef.current = null;
      entranceDelay?.kill();
      bodyObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", syncAndArm);
      ctx.revert();
      tl = null;
    };
  }, []);

  return (
    <div
      ref={anchorRef}
      aria-hidden="true"
      className="pointer-events-none select-none absolute bottom-[calc(100%+1px)] left-[16%] lg:left-[14%] xl:left-[18%] w-[84px] xl:w-[106px] z-20"
    >
      {/* Clipped Skull Chamber: emerges upward from behind Card 02's outer top border */}
      <div className="w-full h-[38px] xl:h-[52px] overflow-hidden px-1 pt-1 xl:pt-1.5 flex items-end justify-center">
        <div ref={skullRef} className="opacity-0 invisible will-change-transform">
          <Image
            src="/images/skull-peek.png"
            alt=""
            width={294}
            height={216}
            loading="eager"
            sizes="(max-width: 1280px) 46px, 64px"
            className="block w-[46px] h-[34px] xl:w-[64px] xl:h-[47px] object-contain dark:drop-shadow-[0_0_1.5px_rgba(253,253,253,0.5)]"
          />
        </div>
      </div>

      {/* Gripping Skeletal Hands Layer: straddles the outer 1px border in front of skull edges */}
      <div className="absolute inset-x-0 -bottom-[9px] flex justify-between px-0.5 z-20">
        <div ref={leftHandRef} className="opacity-0 invisible will-change-transform">
          <svg
            viewBox="0 0 28 22"
            className="block w-[22px] h-[17px] xl:w-[26px] xl:h-[20px] dark:drop-shadow-[0_0_1.5px_rgba(253,253,253,0.5)]"
            fill="none"
          >
            <rect
              x="2.5"
              y="3"
              width="5.5"
              height="15.5"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="8.2"
              y="1.8"
              width="5.5"
              height="17"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="13.9"
              y="2.2"
              width="5.5"
              height="16.5"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="19.6"
              y="4"
              width="5.4"
              height="14"
              rx="2.7"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
          </svg>
        </div>

        <div ref={rightHandRef} className="opacity-0 invisible will-change-transform">
          <svg
            viewBox="0 0 28 22"
            className="block w-[22px] h-[17px] xl:w-[26px] xl:h-[20px] dark:drop-shadow-[0_0_1.5px_rgba(253,253,253,0.5)]"
            fill="none"
          >
            <rect
              x="3"
              y="4"
              width="5.4"
              height="14"
              rx="2.7"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="8.6"
              y="2.2"
              width="5.5"
              height="16.5"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="14.3"
              y="1.8"
              width="5.5"
              height="17"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
            <rect
              x="20"
              y="3"
              width="5.5"
              height="15.5"
              rx="2.75"
              fill="#FFFFFF"
              stroke="#0A0A0A"
              strokeWidth="2.6"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
