import { fraunces } from "@/public/fonts/Fraunces";

export default function Footer() {
  const year = new Date().getFullYear();
  
  return (
    <footer className="w-full py-10 mt-10 border-t border-border flex flex-col sm:flex-row items-center justify-between px-5 sm:px-15">
      <p className="text-[11px] text-main-gray tracking-[0.2em] uppercase">
        © {year} All rights reserved.
      </p>
      
      <p className="text-[11px] text-main-gray tracking-[0.2em] uppercase mt-4 sm:mt-0">
        Designed & Built by <span className={`${fraunces.className} italic font-medium text-foreground tracking-normal text-[14px]`}>Amr Oraby</span>
      </p>
    </footer>
  );
}
