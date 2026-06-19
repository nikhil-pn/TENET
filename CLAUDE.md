# TENET — Project Guide

A minimalist, **local-first personal productivity web app**. Started as a Pomodoro timer; now
a Pomodoro + to-do + day-planner/calendar + habit-streaks + **Eisenhower (Warikoo) prioritization
& time-audit** app. This file is the source of truth for how to work on it — read it first.

> **More context:** `docs/warikoo-time-management-spec.md` (the prioritization principles + how
> they're implemented) and `docs/roadmap-and-research.md` (current status, the prioritized
> backlog, and the UX / storage / integration research with sources). Read those before building
> a related feature.

## What this is (and isn't)

- A **standalone, local-first** web app. **For the web v1: no backend, no network calls, no
  AI/agent calls in the app, no live Obsidian/vault coupling.** The app stays a dumb, fast
  frontend that owns its own data.
- The "intelligence" (any future AI/agent help) lives **outside** the app — in the terminal via
  Claude Code / MCP — never the app calling an AI API.
- **Future (don't build now, just don't block it):** a native macOS **Electron "pro" edition**
  is the north-star. There, data becomes files (ideally inside an **Obsidian vault** folder) that
  **Claude Code / an MCP server** and optionally Obsidian can read/write, plus GitHub backup.
  This is consistent with "intelligence outside the app." So: keep business logic in plain
  framework-agnostic TS, keep data portable JSON, and keep ALL persistence behind one seam.

## Stack

- Next.js 15.3.2 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4
- **Static export** (`output: "export"` in next.config.js) — keep this; no server.
- Styling: **CSS Modules** (`*.module.css` next to each component). Match this style.
- PWA: service worker + manifest (installable). Keep working.
- Persistence: **localStorage** (see the `lib/` data layer below).

## The `lib/` data layer (portable, framework-agnostic — reuse it)

- `lib/persist.ts` — the **single storage seam**: `readJSON`/`writeJSON` (the ONLY code that
  touches localStorage), plus `dateToKey()` and `createId()`. **Swapping this for filesystem/IPC
  is how the Electron edition migrates — don't scatter `localStorage` calls elsewhere.**
- `lib/types.ts` — `Todo`, `Habit`, `DayLog`, and the versioned `TenetData` snapshot (the
  export/backup/vault-file shape). New `Todo` fields are optional & back-compatible.
- `lib/storage.ts` — pure `Todo[]` ops (CRUD, date scheduling, classification, `creditPomodoro`).
- `lib/prioritization.ts` — pure Eisenhower logic: `getQuadrant`, `quadrantBreakdown`,
  `taskHints`, `nudges`, `QUADRANT_META` (the quadrant colors), and all tunable thresholds as
  named constants. See `docs/warikoo-time-management-spec.md`.
- `lib/habits.ts`, `lib/daylog.ts` — habit streaks and the day satisfaction log.
- `lib/dates.ts` — dependency-free natural-language date parser (`parseWhen`).
- `lib/session.ts` — which task the current Pomodoro is focused on (Pomodoro↔task link).

## Architecture decisions (locked)

1. TypeScript, strict mode, no `any` without a justifying comment.
2. Static export stays — the web app needs no backend.
3. Persistence funnels through `lib/persist.ts`. Data is portable JSON (`TenetData`).
4. Core logic stays in plain `lib/` TS modules, UI-agnostic, so the future native shell reuses it.
5. **Fragile DOM contract — do not break:** `Clock.tsx` starts/stops the timer by reaching the
   `ToggleButton` via `getElementById("main-toggle")` and the selector `#main-toggle ~ .button`,
   toggling a literal global class `button-red`. **Never rename the `main-toggle` id, the
   ToggleButton `.button` class, or drop the `button-red` style.**

## Status — what's built

- [x] Foundation (TS strict, single next.config, ESLint, Next 15) — `tsc`/`build` clean.
- [x] **To-do checklist** — typed `lib/` data layer; add/check/delete; undated backlog + due-today.
- [x] **Habit & gym streaks** — daily check-off, streak, 7-day strip.
- [x] **Unified calendar / day planner** — month grid (focus-minutes + task dots per day), click a
      day to plan, natural-language quick-add. Opened from the dock's Calendar.
- [x] **Eisenhower (Warikoo) prioritization + time-audit** — classify-on-add; Tasks panel tabs
      **List / Matrix / Insights**; tap+drag reclassify; time-mix chart + 75% reference gauge;
      satisfaction slider + 10-day strip; **Pomodoro↔task focus link**. See the spec doc.
- [x] **Bottom nav dock** (Calendar · Tasks · Habits) — replaced the floating buttons.

**Next up (see `docs/roadmap-and-research.md` for the full prioritized backlog):**
dark mode + design tokens → data safety (`storage.persist()` + JSON export/import) → a persistent
"Today" home → swipe gestures + completion delight → settings → opt-in GitHub backup. Reminders
are foreground-only by design (no backend).

## Conventions

- Components: `app/components/<Name>.tsx` + `<Name>.module.css`. PascalCase. `"use client"`.
- Keep the minimalist visual style. Quadrant colors come from `QUADRANT_META` (q1 `#f44336`,
  q2 `#4caf50`, q3 `#ff9800`, q4 `#9e9e9e`) — these should become CSS tokens in the dark-mode pass.
- Type props with explicit interfaces; type `useState`/`useRef`/event handlers precisely.
- Don't refactor working logic when adding features unless asked. Small, reviewable diffs.
- Panels are centered modal overlays toggled from `page.tsx` (`activePanel`), mutually exclusive.
  They **reload from storage on open** (`if (isVisible) setX(loadX())`) and gate the save effect on
  a `hydrated` flag so the empty initial state can't clobber data — keep this pattern.

## Run

```bash
npm install
npm run dev      # http://localhost:3000 (Turbopack)
npm run build    # static export to ./out
npx tsc --noEmit # type check
npm run lint
```

## Known minor debt

- 3 `react-hooks/exhaustive-deps` warnings in `Clock.tsx` (pre-existing, non-blocking). Fixing
  them changes dependency arrays = behavior change — only touch deliberately.
