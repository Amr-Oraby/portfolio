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
    <div aria-hidden="true" className="relative flex overflow-hidden bg-background border-y border-border py-4 sm:py-6 my-12">
      <div className="animate-marquee whitespace-nowrap flex items-center">
        {renderItem(1)}
        {renderItem(2)}
        {renderItem(3)}
        {renderItem(4)}
      </div>
    </div>
  );
}
