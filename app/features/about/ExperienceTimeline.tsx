// components/experience-timeline.tsx

type ExperienceItem = {
  id: string;
  title: string;
  company: string;
  period: string;
};

interface ExperienceTimelineProps {
  items: ExperienceItem[];
}

export default function ExperienceTimeline({ items }: ExperienceTimelineProps) {
  return (
    <ol>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="flex gap-3">
            {/* rail: bullet + connecting line */}
            <div className="flex flex-col items-center" aria-hidden="true">
              <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-black" />
              {!isLast && <span className="w-px flex-1 bg-gray-300" />}
            </div>

            {/* content */}
            <div className={isLast ? "" : "pb-6"}>
              <h3 className="text-xs font-semibold text-black">{item.title}</h3>
              <p className="text-[11px] leading-relaxed text-gray-600">
                {item.company}
              </p>
              <p className="text-[11px] leading-relaxed text-gray-400">
                {item.period}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
