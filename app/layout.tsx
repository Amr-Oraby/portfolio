import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/providers/theme-provider";
import Analytics from "@/components/Analytics";
import InitialLoader from "@/components/animations/InitialLoader";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Amr Oraby",
  description: "Amr Oraby - Personal Portfolio",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <script
          id="portfolio-session-check"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.location.search.includes("loader=true")){sessionStorage.removeItem("portfolio_visited");document.documentElement.classList.remove("portfolio-visited");}else if(sessionStorage.getItem("portfolio_visited")==="true"){document.documentElement.classList.add("portfolio-visited");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="selection:bg-[#1b1a18] selection:text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <InitialLoader />
          {children}
        </ThemeProvider>
      </body>
      <Analytics />
    </html>
  );
}
