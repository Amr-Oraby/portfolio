"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import gsap from "gsap";
import Image from "next/image";
import { cn } from "@/lib/utils";
import styles from "./about.module.css";

type Paper = {
  number: string;
  label: string;
  title: string;
  text: string;
  details: string[];
};

const papers: Paper[] = [
  {
    number: "01",
    label: "ABOUT ME",
    title: "Frontend Developer",
    text: "Building modern web experiences.",
    details: ["01"],
  },
  {
    number: "02",
    label: "WHAT I BUILD",
    title: "Web apps & interfaces",
    text: "Responsive experiences.",
    details: ["02"],
  },
  {
    number: "03",
    label: "MY STACK",
    title: "React · Next.js",
    text: "TypeScript · Node.js",
    details: ["03"],
  },
  {
    number: "04",
    label: "HOW I WORK",
    title: "Clean code",
    text: "Performance · Detail",
    details: ["04"],
  },
];

const trackCopies = [-1, 0, 1];

interface AboutCarouselProps {
  className?: string;
}

export default function AboutCarousel({ className }: AboutCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const activeIndexRef = useRef(0);
  const trackPositionRef = useRef(0);
  const trackTweenRef = useRef<gsap.core.Tween | null>(null);
  const reduceMotionRef = useRef(false);
  const dragRef = useRef({
    active: false,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    startPosition: 0,
  });

  const getCardStep = useCallback(() => {
    const stageWidth = stageRef.current?.clientWidth ?? 640;
    const card = cardRefs.current[4] ?? cardRefs.current[0];
    const cardWidth = card?.offsetWidth ?? (stageWidth < 640 ? 190 : 230);
    return stageWidth < 640 ? cardWidth * 0.72 : cardWidth * 0.62;
  }, []);

  const updateCardVisuals = useCallback(
    (continuousIndex: number, animate: boolean) => {
      const duration = reduceMotionRef.current ? 0 : animate ? 1.18 : 0;

      cardRefs.current.forEach((card) => {
        if (!card) return;
        const slot = Number(card.dataset.carouselSlot);
        const distance = slot - continuousIndex;
        const absDistance = Math.abs(distance);

        gsap.to(card, {
          scale:
            absDistance === 0
              ? 1
              : absDistance === 1
                ? 0.88
                : 0.76,
          rotation:
            absDistance === 0
              ? 0
              : absDistance === 1
                ? distance * 1.8
                : distance * 3.2,
          y:
            absDistance === 0
              ? 0
              : absDistance === 1
                ? 3
                : 7,
          opacity:
            absDistance <= 0.85
              ? 1
              : absDistance >= 1.65
                ? 0
                : gsap.utils.clamp(
                    0,
                    1,
                    1 - (absDistance - 0.85) / 0.8
                  ),
          zIndex: 30 - Math.round(absDistance * 10),
          duration,
          ease: "power2.inOut",
        });
      });
    },
    []
  );

  const snapToIndex = useCallback(
    (nextIndex: number, animate = true) => {
      const track = trackRef.current;
      if (!track) return;

      trackTweenRef.current?.kill();
      gsap.killTweensOf(cardRefs.current.filter(Boolean));
      const step = getCardStep();
      const targetPosition =
        ((nextIndex % papers.length) + papers.length) % papers.length;
      const targetIndex = targetPosition;

      activeIndexRef.current = targetIndex;
      setActiveIndex(targetIndex);
      trackPositionRef.current = targetPosition;
      const targetX = -targetPosition * step;

      const duration = reduceMotionRef.current ? 0 : animate ? 1.18 : 0;
      trackTweenRef.current = gsap.to(track, {
        x: targetX,
        duration,
        ease: "power2.inOut",
        onComplete: () => {
          trackTweenRef.current = null;
        },
      });
      updateCardVisuals(targetPosition, animate);
    },
    [getCardStep, updateCardVisuals]
  );

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track) return;

    reduceMotionRef.current =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const step = getCardStep();

      cardRefs.current.forEach((card) => {
        if (!card) return;
        const slot = Number(card.dataset.carouselSlot) || 0;
        gsap.set(card, {
          left: "50%",
          x: slot * step,
          xPercent: -50,
          transformOrigin: "50% 50%",
          force3D: true,
        });
      });

      gsap.set(track, { x: -trackPositionRef.current * step });
      updateCardVisuals(0, false);

      if (!reduceMotionRef.current) {
        gsap.from(stage, {
          y: 24,
          opacity: 0,
          duration: 0.9,
          ease: "power2.out",
        });
      }
    }, stage);

    let observer: IntersectionObserver | null = null;
    if (!reduceMotionRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          gsap.from(stage, {
            y: 10,
            opacity: 0.92,
            duration: 0.7,
            ease: "power2.out",
            overwrite: "auto",
          });
        },
        { threshold: 0.25 }
      );
      observer.observe(stage);
    }

    const handleResize = () => {
      const step = getCardStep();
      cardRefs.current.forEach((card) => {
        if (!card) return;
        const slot = Number(card.dataset.carouselSlot) || 0;
        gsap.set(card, { x: slot * step });
      });
      gsap.set(track, { x: -trackPositionRef.current * step });
      updateCardVisuals(trackPositionRef.current, false);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
      trackTweenRef.current?.kill();
      ctx.revert();
    };
  }, [getCardStep, updateCardVisuals]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        snapToIndex(activeIndexRef.current - 1);
      }
      if (event.key === "ArrowRight") {
        snapToIndex(activeIndexRef.current + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [snapToIndex]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    trackTweenRef.current?.kill();
    const now = performance.now();
    dragRef.current = {
      active: true,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: now,
      velocity: 0,
      startPosition: trackPositionRef.current,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events may not expose pointer capture.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;

    const deltaX = event.clientX - dragRef.current.startX;
    const now = performance.now();
    const elapsed = Math.max(now - dragRef.current.lastTime, 16);
    dragRef.current.velocity =
      (event.clientX - dragRef.current.lastX) / elapsed;
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastTime = now;

    const step = getCardStep();
    const basePosition = dragRef.current.startPosition;
    const trackX =
      -basePosition * step + deltaX * 0.72;

    if (trackRef.current) {
      gsap.set(trackRef.current, { x: trackX });
    }

    const continuousIndex = basePosition - deltaX * 0.72 / step;
    updateCardVisuals(continuousIndex, false);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - dragRef.current.startX;
    const velocity = dragRef.current.velocity;
    const step = getCardStep();
    const effectiveDelta = deltaX * 0.72;
    let targetPosition =
      dragRef.current.startPosition - effectiveDelta / step;

    if (Math.abs(effectiveDelta) < 34 && Math.abs(velocity) > 0.35) {
      targetPosition =
        dragRef.current.startPosition + (velocity < 0 ? 1 : -1);
    }

    const nearestPosition = Math.round(targetPosition);
    snapToIndex(
      ((nearestPosition % papers.length) + papers.length) % papers.length,
      true
    );
  };

  return (
    <section
      className={cn("absolute min-w-0 h-[430px] w-full mt-2 sm:h-[470px] lg:mt-0 lg:h-[470px] xl:h-[500px]", className)}
      aria-label="About information carousel"
      aria-roledescription="carousel"
    >
      <div
        ref={stageRef}
        className="absolute left-1/2 top-[35px] z-50 h-[190px] w-[390px] max-w-[calc(100%-16px)] -translate-x-1/2 overflow-hidden px-3 touch-pan-y cursor-grab select-none active:cursor-grabbing sm:top-[40px] sm:h-[205px] sm:w-[510px] sm:px-4 md:top-[42px] lg:left-[calc(50%-200px)]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="group"
        aria-live="polite"
      >
        <div
          ref={trackRef}
          className="absolute inset-0"
          style={{ willChange: "transform" }}
        >
          {trackCopies.flatMap((copyIndex) =>
            papers.map((paper, paperIndex) => {
              const slot = copyIndex * papers.length + paperIndex;
              const itemIndex = (copyIndex + 1) * papers.length + paperIndex;
              return (
                <article
                  key={`${copyIndex}-${paper.number}`}
                  ref={(element) => {
                    cardRefs.current[itemIndex] = element;
                  }}
                  data-carousel-card={paperIndex}
                  data-carousel-slot={slot}
                  aria-label={`${paper.number}. ${paper.label}`}
                  aria-hidden={false}
                  className={cn(
                "absolute top-3 h-[150px] w-[150px] select-none border-[1px] border-[#171717]/55 px-3 py-3 text-[#171717]",
                "bg-white shadow-[0_5px_12px_rgba(0,0,0,0.06)]",
                "dark:border-[#5A5A5A] dark:bg-black dark:text-white",
                "sm:top-2 sm:h-[170px] sm:w-[170px] sm:px-4 sm:py-4",
                styles.paperCard
                  )}
                  style={{ borderRadius: "2px 1px 3px 1px" }}
                >
              <div className="flex items-start justify-between pb-2">
                <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-black/55 dark:text-white/65">
                  {paper.label}
                </span>
                <span className="text-[11px] font-bold tabular-nums text-black/50 dark:text-white/55">
                  {paper.number}
                </span>
              </div>

              <h2 className="mt-3 text-[16px] leading-[1] tracking-[-0.02em] sm:text-[18px]">
                {paper.title}
              </h2>

              <p className="mt-2 max-w-[130px] text-[8.5px] leading-[1.35] text-black/70 dark:text-white/75 sm:max-w-[145px] sm:text-[9.5px]">
                {paper.text}
              </p>

              <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-4">
                {paper.details.map((detail) => (
                  <span
                    key={detail}
                    className="text-[9px] font-bold uppercase tracking-[0.14em] text-black/55 dark:text-white/60"
                  >
                    {detail}
                  </span>
                ))}
              </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="absolute bottom-0 right-[-24%] z-10 h-[250px] w-[375px] sm:right-[-18%] sm:h-[300px] sm:w-[450px] md:right-[-12%] md:h-[360px] md:w-[540px] xl:right-[-8%] xl:h-[390px] xl:w-[585px]"
      >
        <Image
          src="/images/about-skeleton-suit-new.png"
          alt=""
          width={960}
          height={768}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {papers[activeIndex].label}: {papers[activeIndex].title}
      </p>
    </section>
  );
}
