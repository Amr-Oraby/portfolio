"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Menu, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jetbrainsMono } from "@/public/fonts/JetBrains";

const navItems = [
  { label: "About", href: "#about" },
  { label: "Works", href: "#works" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setOpen(false);
    
    // Slight delay to allow drawer to start closing before scroll
    setTimeout(() => {
      const targetId = href.replace(/.*#/, "");
      const elem = document.getElementById(targetId);
      if (!elem) return;
      
      const targetPosition = elem.getBoundingClientRect().top + window.scrollY;
      const startPosition = window.scrollY;
      const distance = targetPosition - startPosition;
      const duration = 600;
      let start: number | null = null;

      const easeInOutCubic = (t: number) => 
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      const step = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const percent = Math.min(progress / duration, 1);
        
        window.scrollTo(0, startPosition + distance * easeInOutCubic(percent));
        
        if (progress < duration) {
          window.requestAnimationFrame(step);
        } else {
          window.history.pushState(null, "", href);
        }
      };
      
      window.requestAnimationFrame(step);
    }, 300);
  };

  return (
    <div className="sm:hidden flex items-center">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger aria-label="Open mobile menu" className="text-foreground p-2 rounded-full hover:bg-foreground/5 transition-colors cursor-pointer">
          <Menu className="w-5 h-5 text-foreground" />
        </DrawerTrigger>
        <DrawerContent className="bg-background border-t border-border focus:outline-none">
          <DrawerHeader className="text-left border-b border-border/50 pb-4">
            <DrawerTitle className="text-main-gray text-xs tracking-[0.25em] uppercase">Navigation</DrawerTitle>
            <DrawerClose className="absolute right-4 top-4 text-foreground opacity-70 hover:opacity-100 p-2 cursor-pointer">
              <X className="w-5 h-5" />
            </DrawerClose>
          </DrawerHeader>
          <div className="flex flex-col p-6 gap-8">
            <ul className="flex flex-col gap-6 text-foreground text-3xl font-light">
              {navItems.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleScroll(e, item.href)}
                    className="hover:text-main-gray transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            
            <div className="w-full h-px bg-border/50"></div>
            
            <Button
              className={`${jetbrainsMono.className} bg-foreground text-background hover:bg-foreground/90 border-none text-sm py-6 w-full flex gap-2 items-center justify-center rounded-full transition-all duration-300 cursor-pointer group`}
            >
              DOWNLOAD CV
              <Download className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
