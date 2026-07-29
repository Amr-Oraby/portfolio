import { FaGithub, FaLinkedin, FaEnvelope } from "react-icons/fa";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center">
        {/* Name / Title */}
        <h1 className="text-4xl font-bold mb-4">
          <span className="text-foreground">Hello, I&apos;m </span>
          <span className="text-blue-600 dark:text-blue-400">Oraby</span>
        </h1>

        {/* Introduction */}
        <p className="text-lg text-muted-foreground mb-8">
          I&apos;m a passionate developer building beautiful and functional web
          applications. I love turning ideas into reality through code.
        </p>

        {/* Social Links */}
        <div className="flex justify-center gap-6">
          <a
            href="https://github.com/oraby"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="GitHub"
          >
            <FaGithub className="h-6 w-6" />
          </a>
          <a
            href="mailto:hello@oraby.dev"
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Email"
          >
            <FaEnvelope className="h-6 w-6" />
          </a>
          <a
            href="https://linkedin.com/in/oraby"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            aria-label="LinkedIn"
          >
            <FaLinkedin className="h-6 w-6" />
          </a>
        </div>

        {/* Divider */}
        <div className="my-12 h-px bg-linear-to-r from-transparent via-muted to-transparent" />

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              5+
            </div>
            <div className="text-sm text-muted-foreground">Years</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              20+
            </div>
            <div className="text-sm text-muted-foreground">Projects</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              1k+
            </div>
            <div className="text-sm text-muted-foreground">Users</div>
          </div>
        </div>
      </div>
    </div>
  );
}
