"use client";

import { useEffect, useRef, useState } from "react";
import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import ProjectCard, { Project } from "./ProjectCard";
import styles from "./works.module.css";

const projects: Project[] = [
  {
    index: "01",
    category: "E-COMMERCE",
    title: "Isaria",
    description: "A modern perfume e-commerce platform built with Next.js, Shadcn UI, Tailwind CSS, and Zod. Features a seamless purchasing flow, beautiful animations, carousels, and a comprehensive dashboard.",
    tags: ["Next.js", "Shadcn", "Tailwind", "E-commerce"],
    link: "https://isaria-perfume.shop",
    image: "/images/pr1.png",
  },
  {
    index: "02",
    category: "BOOKING SYSTEM",
    title: "Almoatamer",
    description: "Umrah booking website including auth, Google & Facebook auth, online payments, order management, and a 70+ pages dashboard.",
    tags: ["Next.js", "Auth", "Payments", "Dashboard"],
    link: "https://almoatamer.vercel.app/",
    image: "/images/pr2.png",
  },
];

export default function Works() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

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
      setInView(true);
      return;
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
      id="works"
      className={`min-h-[600px] relative py-4 sm:py-15 ${inView ? styles.inView : ""}`}
    >
      <div className={`-mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray ${styles.sectionBadge}`}>
        <span className="w-2 h-2 bg-foreground rounded-full mr-3"></span>
        <span>PROJECTS</span>
      </div>

      <div className="flex flex-col gap-10 sm:gap-20 px-5 sm:px-10 md:px-15 pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={3} />
        <RightSideLabel />

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row gap-6 md:gap-8 xl:gap-20 justify-between items-center sm:items-start">
          <div className="w-full flex flex-col lg:flex-row lg:items-end justify-between gap-10 lg:gap-20">
            <div className={`${fraunces.className} pt-10 sm:ml-6 -space-y-4 font-light text-foreground`}>
              <div className={styles.lineMask}>
                <h1 className={`text-[60px] xl:text-[80px] tracking-tight leading-none ${styles.headingLine1}`}>
                  Selected
                </h1>
              </div>
              <div className={styles.lineMask}>
                <h1 className={`text-[60px] xl:text-[80px] tracking-tight leading-none italic -skew-x-6 ${styles.headingLine2}`}>
                  works.
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-6 max-w-[450px] lg:mb-4">
              <p className={`text-sm text-main-gray leading-relaxed ${styles.narrativeText}`}>
                A curated collection of products I've architected and designed — from e-commerce frontends to interactive mathematical tools.
              </p>

              <div className="flex items-center gap-4">
                <div className={`w-12 h-px bg-border ${styles.hairline}`}></div>
                <span className={`text-[10px] text-main-gray tracking-[0.2em] font-bold uppercase ${styles.tagline}`}>
                  RECENTLY SHIPPED — 2024 / 2025
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Section */}
        <div className={`grid grid-cols-1 xl:grid-cols-2 gap-px bg-border sm:ml-6 mt-10 border border-border ${styles.cardsGrid}`}>
          {projects.map((project, idx) => (
            <div
              key={project.index}
              className={`bg-card ${styles.projectCard} ${styles[`projectCard${idx + 1}`]}`}
            >
              <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
