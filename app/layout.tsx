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
  icons: {
    icon: [{ url: "/images/skull-logo.png", type: "image/png" }],
    apple: [{ url: "/images/skull-logo.png", type: "image/png" }],
  },
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
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
