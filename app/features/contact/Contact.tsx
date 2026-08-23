import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import ContactAccordion from "./ContactAccordion";
import { Mail, Clock, MapPin, Share2, ArrowUpRight } from "lucide-react";

const contactData = [
  {
    index: "01",
    header: "EMAIL",
    icon: <Mail className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: true,
    content: (
      <a href="mailto:hello@amroraby.com" className="text-foreground hover:opacity-70 transition-opacity">
        hello@amroraby.com
      </a>
    ),
  },
  {
    index: "02",
    header: "AVAILABILITY",
    icon: <Clock className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-foreground">Open for new projects</span>
        </div>
        <p className="text-[11px] text-main-gray">Response time: &lt; 24 hours</p>
      </div>
    ),
  },
  {
    index: "03",
    header: "LOCATION",
    icon: <MapPin className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <div>
        <div className="text-foreground mb-2">Mansoura, Egypt</div>
        <p className="text-[11px] text-main-gray">Working remotely worldwide</p>
      </div>
    ),
  },
  {
    index: "04",
    header: "SOCIALS",
    icon: <Share2 className="w-5 h-5 stroke-[1.5]" />,
    initiallyOpen: false,
    content: (
      <div className="flex gap-6">
        {["GitHub", "LinkedIn", "X"].map((social) => (
          <a key={social} href="#" className="text-foreground font-medium hover:opacity-70 transition-opacity">
            {social}
          </a>
        ))}
      </div>
    ),
  },
];

function Contact() {
  return (
    <div id="contact" className=" min-h-[600px] relative py-4 sm:py-15 mb-20">
      <div className=" -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray">
        <span className="w-2 h-2 bg-foreground rounded-full mr-3 "></span>
        <span>CONTACT</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 md:gap-8 xl:gap-20 2xl:gap-30 justify-between items-center sm:items-start px-5 sm:px-10 md:px-15 pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={5} />
        <RightSideLabel />
        
        {/* Left Side: Header & Text */}
        <div className="text w-full sm:max-w-[400px]">
          <div
            className={`${fraunces.className} pt-10 sm:ml-6 -space-y-5 font-light text-foreground`}
          >
            <h1 className="text-[50px] xl:text-[60px]">Let's work</h1>
            <h1 className="text-[50px] xl:text-[60px]">
              <span className="italic -skew-x-6">together</span>.
            </h1>
          </div>
          
          <div className="mt-10 space-y-10 sm:ml-6 hidden sm:block">
            <div className="w-11.5 h-px bg-main-gray/30 "></div>
            <p className="text-main-gray text-sm max-w-[270px]">
              I am currently available for freelance work. If you have a project in mind or just want to say hi, feel free to reach out.
            </p>
            <div className="flex gap-3 items-center">
              <div className="w-11.5 h-px bg-main-gray/30"></div>
              <div className="text-main-gray font-bold text-xs">
                GET IN TOUCH
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form + Cards */}
        <div className="flex-1 w-full flex flex-col xl:flex-row gap-10 mt-10 sm:mt-10">
          
          {/* Form */}
          <div className="flex-1 min-w-[300px]">
            <form className="flex flex-col gap-6 w-full">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your full name"
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="hello@example.com"
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <label className="text-[10px] tracking-[0.25em] uppercase text-main-gray">
                    Message
                  </label>
                  <span className="text-[10px] text-main-gray">0/500</span>
                </div>
                <textarea
                  placeholder="Tell me about your project..."
                  rows={4}
                  className="border border-border bg-transparent px-4 py-3 outline-none focus:border-foreground transition-colors text-foreground text-sm resize-none"
                ></textarea>
              </div>
              
              <button className="cursor-pointer group flex h-10 sm:h-[52px] w-fit items-center rounded-none border border-foreground/20 hover:border-foreground bg-transparent pl-5 sm:pl-6 pr-1.5 sm:pr-2 transition-all hover:bg-foreground/5 mt-2">
                <span className="mr-4 sm:mr-6 text-[10px] sm:text-[12px] font-bold text-foreground uppercase tracking-[0.25em]">
                  Send Message
                </span>
                <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-none bg-foreground/10 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  <ArrowUpRight
                    className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-foreground"
                    strokeWidth={2.5}
                  />
                </div>
              </button>
            </form>
          </div>

          {/* Right side (Info Accordions) */}
          <div className="w-full xl:w-[320px] flex flex-col gap-5">
            {contactData.map((item) => (
              <ContactAccordion key={item.index} data={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
