import { fraunces } from "@/public/fonts/Fraunces";
import MarqueeTrack from "@/components/animations/MarqueeTrack";
import RidingSkeleton from "@/components/animations/RidingSkeleton";

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
      className="relative overflow-x-clip mt-24 sm:mt-32 md:mt-36 lg:mt-44 mb-12"
    >
      <div className="relative z-0 flex overflow-hidden [contain:layout_style_paint] bg-background border-y border-border py-4 sm:py-6">
        <MarqueeTrack>
          {renderItem(1)}
          {renderItem(2)}
        </MarqueeTrack>
      </div>

      <RidingSkeleton direction="right" />
    </div>
  );
}
