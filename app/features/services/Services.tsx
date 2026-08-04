import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import ServiceCard from "./ServiceCard";
import { BsWindowPlus } from "react-icons/bs";
import { MdOutlineRocketLaunch, MdOutlineWebStories } from "react-icons/md";
import { RiBrushAiLine } from "react-icons/ri";

const services = [
  {
    index: "01",
    header: "Landing Pages",
    icon: <BsWindowPlus />,
    text: "High-converting, responsive landing pages designed to stand out and drive action.",
  },
  {
    index: "02",
    header: "Web Applications",
    icon: <MdOutlineWebStories />,
    text: "Scalable, modern web apps with clean architecture and smooth user experience.",
  },
  {
    index: "03",
    header: "UI Development",
    icon: <RiBrushAiLine />,
    text: "Pixel-perfect UI implementation from concept to production.",
  },
  {
    index: "04",
    header: "Performance & Accessibility",
    icon: <MdOutlineRocketLaunch />,
    text: "Optimized for speed, SEO, and accessible for everyone, everywhere.",
  },
];

function Services() {
  return (
    <div className=" min-h-[600px] relative py-4 sm:py-15">
      <div className=" -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] ">
        <span className="w-2 h-2 bg-black rounded-full mr-3 "></span>
        <span>SERVICES</span>
      </div>

      <div className="px-5 sm:px-10 md:px-15  pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={2} />
        <RightSideLabel />
        <div className="flex flex-col sm:flex-row gap-10 sm:gap-[300px] items-baseline ">
          <div
            className={`${fraunces.className} pt-10 sm:ml-6 -space-y-5 font-light `}
          >
            <h1 className="text-[50px] xl:text-[60px]">What i can</h1>
            <h1 className="text-[50px] xl:text-[60px]">
              help you <span className="italic -skew-x-6">build</span>.
            </h1>
          </div>
          <div className="max-w-[300px]">
            I design and build digital products that are fast, pixel-perfect,
            and crafted with purpose.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(450px,1fr))] gap-10 mt-10">
          {services.map((service) => (
            <ServiceCard key={service.index} service={service} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Services;
