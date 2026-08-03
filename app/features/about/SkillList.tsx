import React from "react";

const skills: string[] = [
  "React",
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "React Query",
  "Redux",
  "RTL",
  "Git",
];

interface SkillBadgeProps {
  skill: string;
}

function SkillBadge({ skill }: SkillBadgeProps) {
  return (
    <span className="px-3 py-1 text-xs font-medium text-gray-800 border border-gray-200 rounded-full">
      {skill}
    </span>
  );
}

function SkillsList() {
  return (
    <div className="flex flex-wrap w-[215px] sm:w-full gap-2 ">
      {skills.map((skill, index) => (
        <div key={index}>
          <SkillBadge skill={skill} />
        </div>
      ))}
    </div>
  );
}

export default SkillsList;
