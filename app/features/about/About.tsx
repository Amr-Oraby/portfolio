"use client";

import { useEffect, useRef, useState } from "react";
import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import AboutCarousel from "./AboutCarousel";
import styles from "./about.module.css";

function About() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Check if section is already in or near viewport on mount
    const checkImmediateVisibility = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 50 && rect.bottom > 0) {
        setInView(true);
        return true;
      }
      return false;
    };

    if (checkImmediateVisibility()) return;

    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      id="about"
      className={`min-h-[760px] sm:min-h-[680px] xl:min-h-[720px] relative overflow-x-hidden py-4 sm:py-10 xl:py-12 ${inView ? styles.inView : ""}`}
    >
      <div className={` -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray ${styles.sectionBadge}`}>
        <span className="w-2 h-2 bg-foreground rounded-full mr-3 "></span>
        <span>ABOUT</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(270px,0.58fr)_minmax(460px,1.42fr)] gap-8 lg:gap-10 xl:gap-12 2xl:gap-16 items-start px-5 sm:px-10 md:px-15">
        <LeftSideLabel sectionNum={2} />
        <RightSideLabel />
        <div className="text relative w-full lg:w-auto">
          <div
            className={`${fraunces.className} pt-10 sm:ml-6 -space-y-5 font-light text-foreground`}
          >
            <div className={styles.lineMask}>
              <h1 className={`text-[50px] xl:text-[60px] ${styles.headingLine1}`}>More about</h1>
            </div>
            <div className={styles.lineMask}>
              <h1 className={`text-[50px] xl:text-[60px] ${styles.headingLine2}`}>the developer.</h1>
            </div>
          </div>

          <div className="mt-7 space-y-7 sm:mt-8 sm:space-y-8">
            <div className={`w-11.5 h-px bg-main-gray/30 ${styles.hairline1}`}></div>
            <p className={`text-main-gray text-sm max-w-[270px] ${styles.manifestoText}`}>
              i build fast,accessible and beautiful digital experiences that
              solve real problems and create impact.
            </p>
            <div className={`flex gap-3 items-center ${styles.focusTagline}`}>
              <div className="w-11.5 h-px bg-main-gray/30"></div>
              <div className="text-main-gray font-bold text-xs">
                FOCUSING ON QUALITY & IMPACT
              </div>
            </div>
          </div>

        </div>
        <AboutCarousel className="relative z-10 w-full max-w-[680px] justify-self-center sm:justify-self-end" />
      </div>
    </div>
  );
}

export default About;
