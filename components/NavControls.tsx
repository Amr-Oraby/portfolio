"use client";

import { Button } from "@/components/ui/button";
import { jetbrainsMono } from "@/public/fonts/JetBrains";
import { MdArrowOutward } from "react-icons/md";

function NavControls() {
  return (
    <div className="flex gap-5 items-center">
      <Button variant="ghost" size="sm">
        dark
      </Button>
      <Button
        className={`${jetbrainsMono.className} text-[#060606] border-[#01010126] text-sm py-4.5 px-5 sm:flex gap-3 items-center justify-center hidden  rounded-full hover:bg-black hover:text-white transition-all duration-300 cursor-pointer`}
        variant="outline"
        size="sm"
      >
        SAY HELLO
        <MdArrowOutward />
      </Button>
    </div>
  );
}

export default NavControls;
