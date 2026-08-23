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
    header: "Scalable Web Architecture",
    icon: <MdOutlineWebStories />,
    text: "Building robust, maintainable web architectures designed to scale seamlessly.",
  },
  {
    index: "02",
    header: "UI Engineering",
    icon: <RiBrushAiLine />,
    text: "Architecting reusable component libraries for pixel-perfect, consistent user interfaces.",
  },
  {
    index: "03",
    header: "Complex Interfaces",
    icon: <BsWindowPlus />,
    text: "Engineering data-rich dashboards and dynamic portals with advanced state management.",
  },
  {
    index: "04",
    header: "Performance & Optimization",
    icon: <MdOutlineRocketLaunch />,
    text: "Refactoring architectures for lightning-fast speeds and strict accessibility standards.",
  },
];

function Services() {
  return (
    <div id="services" className=" min-h-[600px] relative py-4 sm:py-15">
      <div className=" -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray">
        <span className="w-2 h-2 bg-foreground rounded-full mr-3 "></span>
        <span>SERVICES</span>
      </div>

      <div className="px-5 sm:px-10 md:px-15  pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={4} />
        <RightSideLabel />
        <div className="flex flex-col lg:flex-row gap-10 lg:justify-between items-baseline lg:items-end">
          <div
            className={`${fraunces.className} pt-10 sm:ml-6 -space-y-5 font-light text-foreground`}
          >
            <h1 className="text-[50px] xl:text-[60px]">What i can</h1>
            <h1 className="text-[50px] xl:text-[60px]">
              help you <span className="italic -skew-x-6">build</span>.
            </h1>
          </div>
          <div className="max-w-[300px] text-main-gray">
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
