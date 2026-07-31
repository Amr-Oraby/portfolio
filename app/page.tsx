import { HomeBackground } from "@/components/HomeBackground";
import Navbar from "@/components/Navbar";

import Hero from "./features/hero/Hero";

export default function Page() {
  return (
    <HomeBackground>
      <Navbar />
      <Hero />
    </HomeBackground>
  );
}
