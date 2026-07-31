import HeroTopBar from "./HeroTopBar";
import LeftSideLabel from "./LeftSideLabel";
import RightSideLabel from "./RightSideLabel";
import HeroContent from "./HeroContent";
import HeroBottomBar from "./HeroBottomBar";

function Hero() {
  return (
    <main className="pb-[100px]  pt-[110px] w-full font-sans text-gray-900   min-h-[539px] mx-auto ">
      <div className=" relative">
        <HeroTopBar />
        <LeftSideLabel />
        <RightSideLabel />
        <HeroContent />
        <HeroBottomBar />
      </div>
    </main>
  );
}

export default Hero;
