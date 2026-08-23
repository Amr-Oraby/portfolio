"use client";

import { Button } from "@/components/ui/button";
import { jetbrainsMono } from "@/public/fonts/JetBrains";
import { Download } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

function NavControls() {
  return (
    <div className="flex gap-5 items-center">
      <ThemeToggle />
      <Button
        className={`${jetbrainsMono.className} bg-foreground text-background hover:bg-foreground/90 border-none text-sm py-4.5 px-5 sm:flex gap-2 items-center justify-center hidden rounded-full transition-all duration-300 cursor-pointer group`}
        size="sm"
      >
        DOWNLOAD CV
        <Download className="w-4 h-4 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
      </Button>
    </div>
  );
}

export default NavControls;
