import { fraunces } from "@/public/fonts/Fraunces";
function HeroContent() {
  return (
    <div className=" p-3 flex justify-center md:justify-between sm:px-20 pl-10 sm:pr-25 ">
      {/* Headline */}
      <div
        className={`${fraunces.className} relative z-10 w-fit  font-serif text-[50px] sm:text-[80px] lg:text-[100px] xl:text-[130px] 2xl:text-[170px] ml-10 sm:ml-40 md:ml-0 leading-[0.92] text-gray-900 tracking-[-0.03em]`}
      >
        <div className="pl-1 font-light">Building</div>
        <div className="italic -skew-x-6 pr-8 font-light">digital</div>
        <div className="relative inline-block font-light">experiences.</div>
      </div>

      {/* Portrait Section */}
      <div className="relative z-1 p-2 sm:p-3 w-fit -left-[85px] md:left-0 sm:ml-0   ">
        {/* Top Left Crop Mark */}
        <div className="absolute -top-[0px] -left-[0px] w-[52px] h-[52px] border-t border-l border-gray-400"></div>

        {/* Bottom Right Crop Mark */}
        <div className="absolute -bottom-[0] -right-[0] w-[52px] h-[52px] border-b border-r border-gray-400"></div>

        {/* Portrait Placeholder */}
        <div className="w-[130px] h-[160px] sm:w-[200px] sm:h-[260px]  md:w-[230px] md:h-[300px] lg:w-[320px] lg:h-[440px]  relative z-10">
          <img src="images/portrait.png" className="w-full h-full" alt="" />
        </div>

        {/* Caption Row */}
        <div className="hidden sm:block absolute bottom-[-20px] w-full pr-5 flex justify-between items-center text-[9px] tracking-[0.25em] text-gray-600 uppercase mt-1">
          <span>Fig. 001</span>
          <span className="w-3 h-px bg-gray-400"></span>
          <span>Portrait</span>
        </div>
      </div>
    </div>
  );
}

export default HeroContent;
