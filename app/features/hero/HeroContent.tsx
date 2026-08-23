import { fraunces } from "@/public/fonts/Fraunces";
function HeroContent() {
  return (
    <div className=" p-3 flex justify-between sm:px-20 px-5  sm:pr-25 ">
      {/* Headline */}
      <div
        className={`${fraunces.className} relative z-10 w-fit  m-0  font-serif text-[50px] sm:text-[80px] lg:text-[100px] xl:text-[130px] 2xl:text-[170px]  leading-[0.92] text-foreground tracking-[-0.03em]`}
      >
        <div className="pl-1 font-light">Building</div>
        <div className="italic -skew-x-6 pr-8 font-light">digital</div>
        <div className="relative inline-block font-light">experiences.</div>
      </div>

      {/* Portrait Section */}
      <div className="relative -left-20 z-1 p-2 sm:p-3 w-fit  md:left-0 sm:ml-0 2xl:pr-10  ">
        {/* Top Left Crop Mark */}
        <div className="absolute -top-[0px] -left-[0px] w-[52px] h-[52px] border-t border-l border-main-gray/30"></div>

        {/* Bottom Right Crop Mark */}
        <div className="absolute -bottom-[0] right-[0] 2xl:right-6.5 w-[52px] h-[52px] border-b border-r border-main-gray/30"></div>

        {/* Portrait Placeholder */}
        <div className="bg-blue-200  w-[130px] h-[160px] sm:w-[200px] sm:h-[260px]  md:w-[230px] md:h-[300px] lg:w-[330px] lg:h-[460px]  relative z-10">
          <img src="images/portrait.png" className="w-full h-full" alt="" />
        </div>

        {/* Caption Row */}
        <div className="hidden sm:flex 2xl:pr-12 absolute bottom-[-20px] w-full pr-5 flex justify-between items-center text-[9px] tracking-[0.25em] text-main-gray uppercase mt-1">
          <span>Fig. 001</span>
          <span className="w-3 h-px bg-main-gray/30"></span>
          <span>Portrait</span>
        </div>
      </div>
    </div>
  );
}

export default HeroContent;
