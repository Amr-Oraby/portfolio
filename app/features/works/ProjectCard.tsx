import { fraunces } from "@/public/fonts/Fraunces";
import { ArrowUpRight } from "lucide-react";

export type Project = {
  index: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
};

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="flex flex-col group h-full bg-card overflow-hidden">
      {/* Top Image Placeholder */}
      <div className="relative w-full h-[250px] sm:h-[350px] bg-foreground/5 flex items-center justify-center transition-colors duration-500 group-hover:bg-foreground/10">
        {/* Placeholder for future images */}
        <span className="text-main-gray/40 font-medium tracking-[0.3em] text-xs uppercase">Project Media</span>
        
        {/* Category Label */}
        <div className="absolute top-4 left-4 bg-card text-foreground px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-bold">
          {project.category}
        </div>
        
        {/* Index Label */}
        <div className="absolute top-4 right-4 bg-card text-foreground px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-bold">
          {project.index}
        </div>
      </div>

      {/* Bottom Content */}
      <div className="p-8 sm:p-10 flex flex-col justify-between flex-1 gap-8">
        <div>
          <div className="flex justify-between items-start gap-4 mb-6">
            <h3 className={`${fraunces.className} text-3xl sm:text-4xl font-medium text-foreground tracking-tight leading-tight max-w-[80%]`}>
              {project.title}
            </h3>
            
            {/* Arrow Button */}
            <div className="flex-shrink-0 w-12 h-12 border border-border flex items-center justify-center group-hover:bg-foreground transition-colors duration-300 cursor-pointer">
              <ArrowUpRight className="w-5 h-5 text-foreground group-hover:text-background transition-colors duration-300" />
            </div>
          </div>
          
          <p className="text-sm text-main-gray leading-relaxed max-w-[90%]">
            {project.description}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-3 mt-4">
          {project.tags.map((tag) => (
            <span key={tag} className="px-4 py-2 border border-border text-[10px] text-main-gray font-medium tracking-wider">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
