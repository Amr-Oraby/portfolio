import HeroTopBar from "./HeroTopBar";
import LeftSideLabel from "./LeftSideLabel";
import RightSideLabel from "./RightSideLabel";
import HeroContent from "./HeroContent";
import HeroBottomBar from "./HeroBottomBar";
import Navbar from "@/components/Navbar";
import HeroCTA from "./HeroCTA";

function Hero() {
  return (
    <>
      <Navbar />
      <main className="pb-[100px]  pt-[50px] w-full font-sans text-gray-900   min-h-[539px] mx-auto ">
        <div className=" relative">
          <HeroTopBar />
          <LeftSideLabel />
          <RightSideLabel />
          <HeroContent />
          <HeroBottomBar />
          <HeroCTA />
        </div>
      </main>
    </>
  );
}

export default Hero;
