import { jetbrainsMono } from "@/public/fonts/JetBrains";
function Logo() {
  return (
    <div className={` ${jetbrainsMono.className} flex gap-2 items-center`}>
      <span className="  border border-[#01010166] w-6 h-6 text-xs flex items-center justify-center">
        A
      </span>
      <span className="text-xs tracking-[2px]">AMR ORABY</span>
    </div>
  );
}

export default Logo;
