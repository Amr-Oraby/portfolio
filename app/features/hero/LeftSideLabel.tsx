function LeftSideLabel({ sectionNum }: { sectionNum: number }) {
  return (
    <>
      <div className="hidden md:block absolute left-[26px] top-[152px] -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center">
        <span className="text-[9px] tracking-[0.25em] text-gray-500 uppercase whitespace-nowrap">
          Portfolio · 2026
        </span>
      </div>
      <div className="hidden md:block absolute left-[26px] top-[231px] w-px h-[78px] bg-gray-400"></div>
      <div className="hidden md:block absolute left-[26px] top-[371px] -translate-x-1/2 -translate-y-1/2 -rotate-90 origin-center">
        <span className="text-[9px] tracking-[0.25em] text-gray-500 uppercase whitespace-nowrap">
          Section 0{sectionNum} / 04
        </span>
      </div>
    </>
  );
}

export default LeftSideLabel;
