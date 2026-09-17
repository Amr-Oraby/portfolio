import { HomeBackground } from "@/components/HomeBackground";
import Hero from "./features/hero/Hero";
import Marquee from "@/components/Marquee";
import TechMarquee from "@/components/TechMarquee";
import dynamic from "next/dynamic";

const About = dynamic(() => import("./features/about/About"));
const Works = dynamic(() => import("./features/works/Works"));
const Services = dynamic(() => import("./features/services/Services"));
const Contact = dynamic(() => import("./features/contact/Contact"));
const Footer = dynamic(() => import("@/components/Footer"));
export default function Page() {
  return (
    <HomeBackground>
      <Hero />
      <Marquee />
      <About />
      <TechMarquee />
      <Works />
      <Services />
      <Contact />
      <Footer />
    </HomeBackground>
  );
}
