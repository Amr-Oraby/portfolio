import { fraunces } from "@/public/fonts/Fraunces";

export default function Marquee() {
  const text = "SCALABLE WEB ARCHITECTURE — PIXEL-PERFECT UI — HIGH PERFORMANCE — ";
  
  return (
    <div className="relative flex overflow-hidden bg-background border-y border-border py-4 sm:py-6">
      <div className="animate-marquee whitespace-nowrap flex items-center">
        <span className={`${fraunces.className} text-4xl sm:text-6xl mx-4 font-bold text-transparent`} style={{ WebkitTextStroke: "1px var(--foreground)", color: "transparent" }}>
          {text}
        </span>
        <span className={`${fraunces.className} text-4xl sm:text-6xl mx-4 font-bold text-transparent`} style={{ WebkitTextStroke: "1px var(--foreground)", color: "transparent" }}>
          {text}
        </span>
        <span className={`${fraunces.className} text-4xl sm:text-6xl mx-4 font-bold text-transparent`} style={{ WebkitTextStroke: "1px var(--foreground)", color: "transparent" }}>
          {text}
        </span>
        <span className={`${fraunces.className} text-4xl sm:text-6xl mx-4 font-bold text-transparent`} style={{ WebkitTextStroke: "1px var(--foreground)", color: "transparent" }}>
          {text}
        </span>
      </div>
    </div>
  );
}
