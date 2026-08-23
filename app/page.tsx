import { HomeBackground } from "@/components/HomeBackground";
import Hero from "./features/hero/Hero";
import About from "./features/about/About";
import Works from "./features/works/Works";
import Services from "./features/services/Services";
import Contact from "./features/contact/Contact";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <HomeBackground>
      <Hero />
      <About />
      <Works />
      <Services />
      <Contact />
      <Footer />
    </HomeBackground>
  );
}
