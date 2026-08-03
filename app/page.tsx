import { HomeBackground } from "@/components/HomeBackground";
import Hero from "./features/hero/Hero";
import About from "./features/about/About";

export default function Page() {
  return (
    <HomeBackground>
      <Hero />
      <About />
    </HomeBackground>
  );
}
