import Image from "next/image";
import { jetbrainsMono } from "@/public/fonts/JetBrains";

function Logo() {
  return (
    <div className={`${jetbrainsMono.className} flex gap-2.5 items-center text-foreground`}>
      <span className="w-7 h-7 flex items-center justify-center shrink-0">
        <Image
          src="/images/skull-logo.png"
          alt="Amr Oraby skull logo"
          width={28}
          height={28}
          loading="eager"
          className="w-full h-full object-contain dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.65)]"
        />
      </span>
      <span className="text-xs tracking-[2px]">AMR ORABY</span>
    </div>
  );
}

export default Logo;
