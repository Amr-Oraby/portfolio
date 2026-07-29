# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 portfolio website using the App Router architecture with React 19 and Tailwind CSS 4.

## Development Commands

```bash
npm run dev    # Start development server at http://localhost:3000
npm run build  # Build production-ready application
npm run start  # Start production server (after build)
npm run lint   # Run ESLint to check for issues
```

## Architecture

### Project Structure

- `app/` - Next.js App Router directory (React Server Components by default)
  - `layout.tsx` - Root layout component (wraps all pages)
  - `page.tsx` - Home page
  - `globals.css` - Global styles (Tailwind CSS 4 with CSS variables for theming)
- `public/` - Static assets (currently empty)

### Key Technologies

- **Next.js 16** - App Router (file-system based routing)
- **React 19** - With React Server Components and Actions
- **Tailwind CSS 4** - CSS-in-JS approach with `@tailwindcss/postcss`
- **TypeScript** - Strict mode enabled, path aliases configured (`@/*`)
- **ESLint 9** - Flat config format

### Styling

Uses Tailwind CSS 4 with CSS variables for theming. The `@theme inline` directive in `globals.css` enables theme-aware styling. Dark mode is supported via `prefers-color-scheme`.

## Important Notes

### Next.js 16 Breaking Changes

**This is NOT the Next.js you may be familiar with.** APIs, conventions, and file structure have breaking changes in Next.js 16. Always check `node_modules/next/dist/docs/` for the most current documentation and heed any deprecation notices.

### No Tests Configured

This project does not have a test framework configured. Consider adding vi, Vitest, or Playwright when tests are needed.

### File Naming

- Route files: `page.tsx` for pages, `layout.tsx` for layouts
- No `pages/` directory - uses App Router exclusively
- No `getServerSideProps` or `getStaticProps` - use Server Components or RSC streaming instead

## MCP Usage Policy

### General Rule

- Prefer your built-in knowledge before using any MCP server.
- Do not call MCP tools unless they provide clear additional value.
- Keep tool calls and returned context to a minimum to reduce token usage.

### Context7

Only use Context7 when:

- I explicitly ask for the latest documentation.
- You are uncertain about a library API.
- You need to verify information that may have changed recently.
- You need official documentation for a library, framework, SDK, or API.

Do NOT use Context7 for:

- React fundamentals
- Next.js concepts you already know
- TypeScript
- JavaScript
- CSS or Tailwind basics
- Common frontend patterns
- General programming questions

### Playwright

Only use Playwright when I explicitly request browser automation or testing, such as:

- End-to-end testing
- UI verification
- Screenshots
- Browser debugging
- Accessibility checks
- Responsive layout testing

Do NOT use Playwright for:

- Reading source code
- Reviewing React components
- Explaining code
- Static analysis
- Refactoring

### Decision Process

Before using any MCP server, ask yourself:

1. Can I answer accurately from my existing knowledge?
2. Is the MCP result likely to improve the answer significantly?
3. Did the user explicitly request documentation or browser interaction?

If the answer is **No**, do not use the MCP tool.

Always optimize for low token usage while maintaining high-quality answers.
