import { buttonVariants } from "@/components/ui/button"; 
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function HeroCTA() {
  return (
    <section className="mt-14 mx-5 sm:mx-20 flex justify-between">
      {/* Left Content: Typography */}
      <div className="max-w-[620px] hidden md:block">
        <p className="text-[1.125rem] font-medium leading-[1.65] text-foreground md:text-[1.1875rem]">
          Independent developer crafting quiet, considered
          <br className="hidden sm:block" />
          interfaces for ambitious teams. Emphasis on
          <br className="hidden sm:block" />
          typography, motion, and detail.
        </p>
      </div>

      {/* Right Content: Buttons */}
      <div className="flex flex-row sm:flex-col  lg:flex-row items-start gap-4">
        <Link
          href="#works"
          className={cn(
            buttonVariants({ variant: "default" }),
            "cursor-pointer group relative overflow-hidden flex h-10 sm:h-[52px] items-center rounded-full bg-foreground pl-5 sm:pl-6 pr-1.5 sm:pr-2 transition-all hover:bg-foreground/90 before:absolute before:inset-0 before:content-[''] before:-translate-x-[150%] before:skew-x-[30deg] before:bg-gradient-to-r before:from-transparent before:via-background/60 before:to-transparent before:transition-transform before:duration-500 before:ease-out hover:before:translate-x-[150%]"
          )}
        >
          <span className="relative z-10 mr-4 sm:mr-6 text-[13px] sm:text-[14px] font-medium text-background">
            View Projects
          </span>
          <div className="relative z-10 flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-background/20 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
            <ArrowUpRight
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-background"
              strokeWidth={2}
            />
          </div>
        </Link>

        <Link
          href="#contact"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "cursor-pointer group flex h-10 sm:h-[52px] items-center rounded-full border border-foreground/20 hover:border-foreground bg-transparent pl-5 sm:pl-6 pr-1.5 sm:pr-2 transition-all hover:bg-foreground/5"
          )}
        >
          <span className="mr-4 sm:mr-6 text-[13px] sm:text-[14px] font-medium text-foreground">
            Contact Me
          </span>
          <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-foreground/10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
            <ArrowUpRight
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground"
              strokeWidth={2.5}
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
