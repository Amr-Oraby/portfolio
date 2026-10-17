"use client";

import { useEffect, useRef, useState } from "react";
import { fraunces } from "@/public/fonts/Fraunces";
import styles from "./footer.module.css";

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const year = new Date().getFullYear();

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;

    const checkImmediate = () => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 30 && rect.bottom > 0) {
        setInView(true);
        return true;
      }
      return false;
    };

    if (checkImmediate()) return;

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
        rootMargin: "0px 0px -20px 0px",
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className={`w-full py-10 mt-10 border-t border-border flex flex-col sm:flex-row items-center justify-between px-5 sm:px-15 ${styles.footerContainer} ${inView ? styles.inView : ""}`}
    >
      <p className="text-[11px] text-main-gray tracking-[0.2em] uppercase">
        © {year} All rights reserved.
      </p>

      <p className="text-[11px] text-main-gray tracking-[0.2em] uppercase mt-4 sm:mt-0">
        Designed & Built by <span className={`${fraunces.className} italic font-medium text-foreground tracking-normal text-[14px]`}>Amr Oraby</span>
      </p>
    </footer>
  );
}
