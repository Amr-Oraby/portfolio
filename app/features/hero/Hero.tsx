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
      <main className="pb-25  pt-12.5 w-full font-sans text-gray-900   min-h-134.75 mx-auto ">
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
