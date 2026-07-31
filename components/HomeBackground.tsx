export function HomeBackground({ children }: { children: React.ReactNode }) {
  const darkMode = true;
  const theme = darkMode
    ? "bg-[#FDFDFD] bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]"
    : "bg-[#0A0A0A] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]";
  return (
    <div
      className={`
        relative
        min-h-screen
        bg-size-[96px_96px]
        ${theme}
      `}
    >
      {children}
    </div>
  );
}
