import { fraunces } from "@/public/fonts/Fraunces";
import React from "react";
import { RxArrowTopRight } from "react-icons/rx";

// 1. Define the exact shape of your service object
export interface Service {
  index: string;
  header: string;
  icon: React.ReactNode;
  text: string;
}

interface ServiceCardProps {
  service: Service;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  // Retrieve the correct icon component, fallback to a default if not found

  return (
    <div className="group relative flex flex-col justify-between min-h-[280px] p-10 bg-card border border-border hover:border-foreground/30 transition-colors duration-300">
      {/* Top Row: Index & Icon */}
      <div className="flex justify-between items-start mb-12">
        <span
          className={`${fraunces.className} text-4xl font-serif text-foreground tracking-tight`}
        >
          {service.index}
        </span>
        <div className="text-4xl text-foreground font-light stroke-[0.5]">
          {service.icon}
        </div>
      </div>

      {/* Bottom Row: Header, Text & Arrow */}
      <div>
        <h3
          className={`${fraunces.className} text-3xl font-serif text-foreground mb-3 tracking-tight`}
        >
          {service.header}
        </h3>

        <div className="flex justify-between items-end gap-6">
          <p className="text-sm text-main-gray max-w-[280px] leading-relaxed">
            {service.text}
          </p>

          <RxArrowTopRight className="text-2xl text-main-gray/50 group-hover:text-foreground group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-300" />
        </div>
      </div>
    </div>
  );
}
