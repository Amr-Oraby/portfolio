export function HomeBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`
        relative
        min-h-screen
        bg-size-[96px_96px]
        bg-background
        bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]
        dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]
      `}
    >
      {children}
    </div>
  );
}
