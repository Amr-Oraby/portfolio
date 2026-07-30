export function HomeBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        relative
        min-h-screen
        bg-[#FDFDFD]
        bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]
        bg-size-[96px_96px]
      "
    >
      {children}
    </div>
  );
}
