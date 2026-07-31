function HeroTopBar() {
  return (
    <>
      <div className="px-5 sm:px-15 py-10 flex  justify-between items-center  text-[10px] tracking-[0.25em] uppercase text-gray-700">
        <div className="flex items-center">
          <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
          <span>Frontend Developer — Est. 2018</span>
        </div>
        <span className="hidden sm:block">Issue Nº 07 / MMXXVI</span>
      </div>
      <div className=" mx-5 sm:mx-12 w-[66px] h-px bg-gray-300"></div>
    </>
  );
}

export default HeroTopBar;
