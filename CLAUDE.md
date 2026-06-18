# TENET — Project Guide

A minimalist personal productivity web app. Started as a Pomodoro timer; growing into a
local-first **to-do + day planner + calendar** app. This file is the source of truth for
how to work on it — read it first.

## What this is (and isn't)

- A **standalone, local-first** web app. No backend, no network calls, no AI/agent
  integration, no Obsidian/vault coupling. All of that is explicitly **out of scope** for v1.
- The "intelligence" (any future AI/agent help) will live **outside** this app — in the
  terminal via Claude Code / MCP — not in the app calling an API. So the app stays a dumb,
  fast frontend that owns its own data.
- Future (do NOT build for it now, just don't block it): Android / iOS / Mac apps may reuse
  the core logic, so keep business logic in plain framework-agnostic TS modules and data as
  portable JSON.

## Stack

- Next.js 15.3.2 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4
- **Static export** (`output: "export"` in next.config.js) — keep this; no server.
- Styling: **CSS Modules** (`*.module.css` next to each component). Match this style.
- PWA: service worker + manifest (installable). Keep working.
- Persistence: **localStorage** for v1 (to-dos, planner blocks, pomodoro history).

## Architecture decisions (locked)

1. TypeScript, strict mode, no `any` without a justifying comment.
2. Static export stays — the app never needs a backend in v1.
3. No Obsidian / vault integration in this app. They are separate worlds.
4. Data is owned by the app, entered by the user in-app, stored in the browser.
5. Keep core logic (types, storage, scheduling) in plain TS modules, UI-agnostic, so a
   future native shell can reuse it.

## v1 scope

**In:** Pomodoro (exists) · To-do list · Day planner (time-blocked) · Calendar view ·
"Today" view (today's planned blocks + current/next).
**Out (later phases):** AI/agent, Chrome integration, backend, multi-device sync, vault.

## Build order & status

- [x] Foundation: TS migration (strict), single next.config, ESLint re-enabled, Next 15
      viewport/metadata deprecation fixed. `tsc --noEmit` clean, `npm run build` passes.
- [ ] **To-do list** (next) — establishes the typed localStorage data layer that the rest
      builds on. Add/check/delete tasks.
- [ ] Day planner — time-blocked day; drop tasks into slots.
- [ ] "Today" view — today's blocks + current/next highlight.
- [ ] Calendar view — week/month overview.

## Conventions

- Components: `app/components/<Name>.tsx` + `<Name>.module.css`. PascalCase.
- Keep the existing minimalist visual style — don't restyle existing components.
- Type props with explicit interfaces; type `useState`/`useRef`/event handlers precisely.
- Don't refactor working logic when adding features unless asked. Small, reviewable diffs.
- Put reusable non-UI logic under a `lib/` folder as plain TS (e.g. `lib/storage.ts`,
  `lib/types.ts`) so it stays portable.

## Run

```bash
npm install
npm run dev      # http://localhost:3000 (Turbopack)
npm run build    # static export to ./out
npx tsc --noEmit # type check
npm run lint
```

## Known minor debt

- 4 `react-hooks/exhaustive-deps` warnings in Clock/MonthlyChart (pre-existing,
  non-blocking). Fixing them changes dependency arrays = behavior change — only touch
  deliberately.
