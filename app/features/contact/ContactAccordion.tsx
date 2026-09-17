"use client";
import { ReactNode, useState } from "react";

type ContactAccordionItem = {
  index: string;
  icon?: ReactNode;
  header: string;
  content: ReactNode;
  initiallyOpen?: boolean;
};

function ContactAccordion({ data }: { data: ContactAccordionItem }) {
  const [isOpen, setIsOpen] = useState(data.initiallyOpen || false);
  return (
    <div
      onClick={() => setIsOpen((o) => !o)}
      className={`border border-border bg-card text-card-foreground rounded-none ${isOpen ? "py-6" : "h-[60px] py-5"} px-5 hover:-translate-y-[2px] transition-transform duration-300 w-full overflow-hidden cursor-pointer`}
    >
      <div className="flex items-center justify-between">
        <div className="flex text-xs font-bold items-center gap-3">
          <span>{data.icon}</span>
          {!isOpen && <span>{data.header}</span>}
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-main-gray font-bold">{data.index}</span>
          <button aria-label="Toggle contact accordion" className="cursor-pointer flex items-center justify-center p-1">
            <svg
              className={`w-4 h-4 text-main-gray transition-transform duration-300 ${
                isOpen ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="mt-6">
          <div className="mb-4">
            <h2 className="text-xs text-main-gray font-bold mb-4 tracking-widest">
              {data.header}
            </h2>
            <div className="w-5 h-px bg-main-gray/50"></div>
          </div>
          <div className="content text-sm cursor-default" onClick={(e) => e.stopPropagation()}>
            {data.content}
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactAccordion;
