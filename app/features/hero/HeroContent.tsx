import { fraunces } from "@/public/fonts/Fraunces";
import TypingSkeleton from "@/components/animations/TypingSkeleton";
import styles from "./hero.module.css";

function HeroContent() {
  return (
    <div className="p-3 px-5 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-4 sm:pl-20 sm:pr-10 lg:pr-16 xl:pr-20">
      {/* Headline */}
      <div
        className={`${fraunces.className} relative z-10 w-fit  m-0  font-serif text-[50px] sm:text-[80px] lg:text-[100px] xl:text-[130px] 2xl:text-[170px]  leading-[0.92] text-foreground tracking-[-0.03em]`}
      >
        <div className={`pl-1 font-light ${styles.headlineLine1}`}>
          Building
        </div>
        <div
          className={`italic -skew-x-6 pr-8 font-light ${styles.headlineLine2}`}
        >
          digital
        </div>
        <div
          className={`relative inline-block font-light ${styles.headlineLine3}`}
        >
          experiences.
        </div>
      </div>

      {/* Hero Coding Skeleton */}
      <div
        className={`relative z-1 self-center md:self-auto shrink-0 w-fit 2xl:pr-6 ${styles.imageEntrance}`}
      >
        <div className="w-[210px] sm:w-[270px] md:w-[270px] lg:w-[370px] xl:w-[430px] 2xl:w-[470px] aspect-[220/274] relative z-10">
          <TypingSkeleton />
        </div>
      </div>
    </div>
  );
}

export default HeroContent;
