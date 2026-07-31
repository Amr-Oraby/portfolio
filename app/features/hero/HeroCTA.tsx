import { Button } from "@/components/ui/button"; // Standard shadcn button import
import { ArrowRight, ArrowUpRight } from "lucide-react";

export default function HeroCTA() {
  return (
    <section className="mt-14 mx-5 sm:mx-20 flex justify-between">
      {/* Left Content: Typography */}
      <div className="max-w-[620px] hidden md:block">
        <p className="text-[1.125rem] font-medium leading-[1.65] text-zinc-900 md:text-[1.1875rem]">
          Independent developer crafting quiet, considered
          <br className="hidden sm:block" />
          interfaces for ambitious teams. Emphasis on
          <br className="hidden sm:block" />
          typography, motion, and detail.
        </p>
      </div>

      {/* Right Content: Buttons */}
      <div className="flex flex-col  lg:flex-row items-start gap-4">
        <Button
          className="cursor-pointer group relative overflow-hidden flex py-6 sm:py-0 sm:h-[58px] items-center rounded-full bg-black pl-6 sm:pl-8 pr-2.5 transition-all hover:bg-black/90 
  before:absolute before:inset-0 before:content-[''] before:-translate-x-[150%] before:skew-x-[30deg] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent before:transition-transform before:duration-500 before:ease-out hover:before:translate-x-[150%]"
        >
          <span className="relative z-10 mr-4 sm:mr-8 text-[11px] font-bold uppercase tracking-[0.25em] text-white">
            View Projects
          </span>
          <div className="relative z-10 flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#1e1e1e] transition-transform duration-300 group-hover:translate-x-0.5">
            <ArrowRight
              className="h-3 w-3 sm:h-4 sm:w-4 text-white"
              strokeWidth={2}
            />
          </div>
        </Button>

        <Button
          variant="outline"
          className="cursor-pointer group flex py-6 sm:py-0 sm:h-[58px] items-center rounded-full border-[#e4e4e7] hover:border-black bg-white pl-6 sm:pl-8 pr-2.5 transition-all hover:bg-zinc-50"
        >
          <span className="mr-8 text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-900">
            Contact
          </span>
          <div className="flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-[#e4e4e7] bg-white transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <ArrowUpRight
              className="h-3 w-3 sm:h-4 sm:w-4 text-zinc-900"
              strokeWidth={2.5}
            />
          </div>
        </Button>
      </div>
    </section>
  );
}
