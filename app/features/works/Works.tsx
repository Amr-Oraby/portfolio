import { fraunces } from "@/public/fonts/Fraunces";
import LeftSideLabel from "../hero/LeftSideLabel";
import RightSideLabel from "../hero/RightSideLabel";
import ProjectCard, { Project } from "./ProjectCard";

const projects: Project[] = [
  {
    index: "01",
    category: "E-COMMERCE",
    title: "Golden Beauty House",
    description: "E-commerce frontend architecture with custom cart drawers and address management interfaces.",
    tags: ["Next.js", "Tailwind CSS"],
  },
  {
    index: "02",
    category: "CONCEPT",
    title: "The Greek & SliceRush",
    description: "Conceptual landing page designs for a modern fitness center and a high-energy pizza delivery brand.",
    tags: ["UI / UX", "Landing Pages"],
  },
  {
    index: "03",
    category: "TOOL",
    title: "Gaussian Elimination Solver",
    description: "Interactive web-based mathematical tool featuring step-by-step calculation logs.",
    tags: ["JavaScript", "Streamlit"],
  },
  {
    index: "04",
    category: "APPLICATION",
    title: "Travel List",
    description: "React application engineered for tracking shared expenses and splitting bills efficiently.",
    tags: ["React"],
  },
];

export default function Works() {
  return (
    <div id="works" className="min-h-[600px] relative py-4 sm:py-15">
      <div className="-mb-5 sm:m-0 px-5 sm:px-15 flex items-center text-[12px] text-main-gray">
        <span className="w-2 h-2 bg-foreground rounded-full mr-3"></span>
        <span>PROJECTS</span>
      </div>

      <div className="flex flex-col gap-10 sm:gap-20 px-5 sm:px-10 md:px-15 pr-5 sm:pr-14 md:pr-24">
        <LeftSideLabel sectionNum={3} />
        <RightSideLabel />
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row gap-6 md:gap-8 xl:gap-20 justify-between items-center sm:items-start">
          
          <div className="w-full flex flex-col lg:flex-row lg:items-end justify-between gap-10 lg:gap-20">
            <div className={`${fraunces.className} pt-10 sm:ml-6 -space-y-4 font-light text-foreground`}>
              <h1 className="text-[60px] xl:text-[80px] tracking-tight leading-none">Selected</h1>
              <h1 className="text-[60px] xl:text-[80px] tracking-tight leading-none italic -skew-x-6">works.</h1>
            </div>

            <div className="flex flex-col gap-6 max-w-[450px] lg:mb-4">
              <p className="text-sm text-main-gray leading-relaxed">
                A curated collection of products I've architected and designed — from e-commerce frontends to interactive mathematical tools.
              </p>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-px bg-border"></div>
                <span className="text-[10px] text-main-gray tracking-[0.2em] font-bold uppercase">
                  RECENTLY SHIPPED — 2024 / 2025
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-px bg-border sm:ml-6 mt-10 border border-border">
          {projects.map((project) => (
            <div key={project.index} className="bg-card">
               <ProjectCard project={project} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
