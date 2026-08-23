"use client";

const navItems = [
  { label: "About", href: "#about" },
  { label: "Works", href: "#works" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

function Sections() {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace(/.*#/, "");
    const elem = document.getElementById(targetId);
    if (!elem) return;
    
    const targetPosition = elem.getBoundingClientRect().top + window.scrollY;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    const duration = 600; // 0.6 seconds
    let start: number | null = null;

    // Easing function for smooth acceleration and deceleration
    const easeInOutCubic = (t: number) => 
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const percent = Math.min(progress / duration, 1);
      
      window.scrollTo(0, startPosition + distance * easeInOutCubic(percent));
      
      if (progress < duration) {
        window.requestAnimationFrame(step);
      } else {
        window.history.pushState(null, "", href);
      }
    };
    
    window.requestAnimationFrame(step);
  };

  return (
    <ul className="hidden gap-10 sm:flex">
      {navItems.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
            onClick={(e) => handleScroll(e, item.href)}
            className="
              relative
              text-sm
              after:absolute
              after:left-0
              after:-bottom-1
              after:h-[1.5px]
              after:w-full
              after:origin-left
              after:scale-x-0
              after:bg-current
              after:transition-transform
              after:duration-400
              hover:after:scale-x-100
            "
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default Sections;
