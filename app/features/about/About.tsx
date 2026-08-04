import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import Accordion from "./Accordion";

import { Briefcase, GraduationCap, Send, MapPin } from "lucide-react";
import { SlTarget } from "react-icons/sl";
import { AiOutlineCode } from "react-icons/ai";
import SkillsList from "./SkillList";
import Focus from "./Focus";
import Location from "./Location";
import ExperienceTimeline from "./ExperienceTimeline";
import Education from "./Education";
import Availability from "./Availability";

const accordionData = [
  {
    index: "01",
    hidden: "",
    icon: <SlTarget className="w-6 h-6 stroke-[1.5]" />,
    header: "CURRENT FOCUS",
    content: <Focus />,
  },
  {
    index: "02",
    hidden: "",
    icon: <AiOutlineCode className="w-6 h-6 stroke-[1.5]" />,
    header: "TECH STACK",
    content: <SkillsList />,
  },
  {
    index: "03",
    hidden: "",
    icon: <Briefcase className="w-6 h-6 stroke-[1.5]" />,
    header: "EXPERIENCE",
    content: (
      <ExperienceTimeline
        items={[
          {
            id: "1",
            title: "Frontend Developer",
            company: "Nova Solutions",
            period: "2021 — Present",
          },
          {
            id: "2",
            title: "Junior Developer",
            company: "Quantum Digital",
            period: "2019 — 2021",
          },
        ]}
      />
    ),
  },
  {
    index: "04",
    hidden: "hidden md:block",
    icon: <GraduationCap className="w-6 h-6 stroke-[1.5]" />,
    header: "EDUCATION",
    content: <Education />,
  },
  {
    index: "05",
    hidden: "hidden md:block",
    icon: <Send className="w-6 h-6 stroke-[1.5]" />,
    header: "AVAILABILITY",
    content: <Availability />,
  },
  {
    index: "06",
    hidden: "hidden md:block",
    icon: <MapPin className="w-6 h-6 stroke-[1.5]" />,
    header: "LOCATION",
    content: <Location />,
  },
];

function About() {
  return (
    <div className="min-h-[600px] relative py-5 sm:py-15">
      <div className=" -mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] ">
        <span className="w-2 h-2 bg-black rounded-full mr-3 "></span>
        <span>ABOUT</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 md:gap-8 xl:gap-20 2xl:gap-30  justify-between items-center sm:items-start px-5 sm:px-10 md:px-15  pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={2} />
        <RightSideLabel />
        <div className="text ">
          <div
            className={`${fraunces.className} pt-10 sm:ml-5 -space-y-5 font-light `}
          >
            <h1 className="text-[50px] xl:text-[60px]">More about</h1>
            <h1 className="text-[50px] xl:text-[60px]">the developer.</h1>
          </div>

          <div className="mt-10 space-y-10">
            <div className="w-11.5 h-px bg-gray-400 "></div>
            <p className="text-gray-600 text-sm max-w-[270px]">
              i build fast,accessible and beautiful digital experiences that
              solve real problems and create impact.
            </p>
            <div className="flex gap-3 items-center">
              <div className="w-11.5 h-px bg-gray-400"></div>
              <div className="text-gray-600 font-bold text-xs">
                FOCUSING ON QUALITY & IMPACT
              </div>
            </div>
          </div>
        </div>

        <div className="accordion grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5 flex-1 w-full">
          {accordionData.map((acc) => (
            <Accordion key={acc.index} data={acc} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default About;
