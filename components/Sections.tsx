const navItems = [
  { label: "About", href: "#about" },
  { label: "Works", href: "#works" },
  { label: "Services", href: "#services" },
  { label: "Contact", href: "#contact" },
];

function Sections() {
  return (
    <ul className="hidden gap-10 sm:flex">
      {navItems.map((item) => (
        <li key={item.label}>
          <a
            href={item.href}
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
