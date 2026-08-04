import { HomeBackground } from "@/components/HomeBackground";
import Hero from "./features/hero/Hero";
import About from "./features/about/About";
import Services from "./features/services/Services";

export default function Page() {
  return (
    <HomeBackground>
      <Hero />
      <About />
      <Services />
    </HomeBackground>
  );
}
