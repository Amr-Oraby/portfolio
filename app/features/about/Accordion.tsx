"use client";
import { ReactNode, useState } from "react";
type AccordionItem = {
  index: string;
  hidden: string;
  icon: ReactNode;
  header: string;
  content: ReactNode;
};
function Accordion({ data }: { data: AccordionItem }) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <div
      onClick={() => setIsOpen((o) => !o)}
      className={` ${data.hidden} border  border-gray-200 bg-[#FDFDFD] rounded-md ${isOpen ? "h-[320px] py-10" : "h-[65px] py-5"}   px-5 hover:-translate-y-[5px] transition-transform duration-300`}
    >
      <div className="flex items-center justify-between mb-6 cursor-pointer">
        <div className="flex text-xs font-bold items-center gap-3 ">
          <span>{data.icon}</span>
          {!isOpen && <span>{data.header}</span>}
        </div>
        <div className="flex gap-3 items-center">
          <span className="text-xs text-gray-600 font-bold">{data.index}</span>
          <button className="cursor-pointer flex items-center justify-center p-1">
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${
                isOpen ? "rotate-180" : "rotate-0"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>
      {isOpen && (
        <>
          <div className="mb-6">
            <h2 className="text-sm text-gray-600 font-bold mb-6 tracking-widest">
              {data.header}
            </h2>
            <div className="w-5 h-px bg-gray-500 "></div>
          </div>
          <div className="content">{data.content}</div>
        </>
      )}
    </div>
  );
}

export default Accordion;
