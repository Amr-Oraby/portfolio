import Image from "next/image";
import { fraunces } from "@/public/fonts/Fraunces";

export default function Marquee() {
  const renderItem = (key: number) => (
    <span
      key={key}
      className={`${fraunces.className} text-4xl sm:text-6xl mx-4 font-bold text-transparent`}
      style={{ WebkitTextStroke: "1px var(--foreground)", color: "transparent" }}
    >
      <span>SCALABLE WEB ARCHITECTURE</span>
      <span> — </span>
      <span>PIXEL-PERFECT UI</span>
      <span> — </span>
      <span>HIGH PERFORMANCE</span>
      <span> — </span>
    </span>
  );

  return (
    <div
      aria-hidden="true"
      className="relative mt-24 sm:mt-32 md:mt-36 lg:mt-44 mb-12"
    >
      <div className="relative z-0 flex overflow-hidden bg-background border-y border-border py-4 sm:py-6">
        <div className="animate-marquee whitespace-nowrap flex items-center">
          {renderItem(1)}
          {renderItem(2)}
          {renderItem(3)}
          {renderItem(4)}
        </div>
      </div>

      {/* Sitting skeleton positioned on the marquee top border with legs dangling over the scrolling text */}
      <div className="pointer-events-none select-none absolute top-0 left-3 sm:left-8 md:left-12 lg:left-16 z-20 -translate-y-[63.87%]">
        <Image
          src="/images/skeleton-sitting.png"
          alt=""
          width={392}
          height={584}
          loading="eager"
          sizes="(max-width: 640px) 92px, (max-width: 768px) 116px, (max-width: 1024px) 132px, (max-width: 1280px) 146px, 160px"
          className="w-[92px] sm:w-[116px] md:w-[132px] lg:w-[146px] xl:w-[160px] h-auto dark:drop-shadow-[0_0_1.5px_rgba(255,255,255,0.65)]"
        />
      </div>
    </div>
  );
}
