# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

---

# Project Overview

This is a premium frontend developer portfolio built with:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui
- Framer Motion (for animations)

The project focuses on premium UI, smooth interactions, accessibility, and clean architecture.

---

# Development Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
```

---

# Project Structure

```
app/
│
├── data/          # Static portfolio data
├── features/      # Feature-based sections
│   ├── hero/
│   ├── about/
│   ├── projects/
│   ├── services/
│   ├── skills/
│   ├── timeline/
│   ├── contact/
│   └── footer/
│
├── hooks/         # Custom React hooks
├── types/         # Shared TypeScript types
│
├── favicon.ico
├── globals.css
├── layout.tsx
└── page.tsx

components/
│
├── animations/    # Reusable animation components
└── ui/            # shadcn/ui components

constants/         # Navigation, socials, configuration

lib/               # Shared utilities

providers/         # Context providers (Theme, etc.)

public/
│
├── fonts/
├── icons/
└── images/
```

---

# Architecture Rules

- Use feature-based architecture.
- Every website section belongs inside `app/features`.
- Keep shadcn components inside `components/ui`.
- Keep reusable animation components inside `components/animations`.
- Store reusable utilities inside `lib`.
- Store static content inside `app/data`.
- Store application constants inside `constants`.
- Store providers inside `providers`.
- Prefer Server Components unless interactivity requires `"use client"`.

---

# Code Style

- TypeScript only.
- Functional components only.
- Prefer Server Components.
- Keep components small and composable.
- Avoid prop drilling when unnecessary.
- Use descriptive names.
- Avoid unnecessary comments.
- Write production-ready code.

---

# UI Principles

The portfolio should feel:

- Premium
- Minimal
- Editorial
- Timeless
- Interactive
- Elegant

Avoid:

- Generic developer portfolio layouts
- Dashboard-like UI
- Unnecessary visual clutter
- Overengineering

Animations should enhance the experience, never distract from it.

---

# Performance

- Optimize images.
- Lazy load when appropriate.
- Avoid unnecessary client components.
- Minimize bundle size.
- Prefer CSS over JavaScript when possible.

---

# Important

Do NOT scan or read the entire project to answer a question.

Only inspect the files that are directly relevant to the current task.

Preserve the existing architecture and naming conventions unless explicitly asked to refactor them.

---

# MCP Usage Policy

## Context7

Use Context7 only when:

- I explicitly ask for official documentation.
- You are unsure about a library API.
- The information may have changed recently.

Do not use it for React, Next.js fundamentals, JavaScript, TypeScript, CSS, Tailwind, or common frontend concepts.

## Playwright

Use Playwright only when I explicitly request:

- Browser testing
- UI verification
- Screenshots
- Accessibility testing
- Responsive testing

Never use Playwright for reading or reviewing source code.

---

Always optimize for:

- Clean architecture
- Maintainability
- Accessibility
- Performance
- Low token usage
