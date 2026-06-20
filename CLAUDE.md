# TENET — Project Guide

A minimalist, **local-first personal productivity web app**. Started as a Pomodoro timer; now
a Pomodoro + to-do + day-planner/calendar + habit-streaks + **Eisenhower (Warikoo) prioritization
& time-audit** app. This file is the source of truth for how to work on it — read it first.

> **More context:** `README.md` (the **cloud layer** — Supabase/GitHub setup, data flow, live
> project values), `docs/warikoo-time-management-spec.md` (the prioritization principles + how
> they're implemented) and `docs/roadmap-and-research.md` (current status, the prioritized
> backlog, and the UX / storage / integration research with sources). Read those before building
> a related feature.

## What this is (and isn't)

- A **standalone, local-first** web app. It always works offline against localStorage and owns
  its own data. **No AI/agent calls in the app, no live Obsidian/vault coupling.**
- **Cloud is an opt-in layer (added — pivots the old "no backend" rule).** When the two
  `NEXT_PUBLIC_SUPABASE_*` env vars are set, the app gains **Supabase auth (GitHub/Google) +
  cloud sync + a GitHub accountability streak**. Unset ⇒ it behaves exactly like the old
  local-only app. **Static export is preserved** — the Supabase JS client and OAuth callback run
  fully client-side; the only client secret is the public anon key (Row-Level Security guards data).
- **Accountability model:** the immutable record is the Postgres `pomodoro_sessions` table
  (server timestamp + insert-only RLS — no UPDATE/DELETE, even for the owner). The GitHub
  contribution graph rides on top as public motivation only — commits can be backdated, so the
  DB ledger is truth, the green squares are hype.
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
- Persistence: **localStorage** (see the `lib/` data layer below), with an **opt-in Supabase
  cloud-sync layer** (`@supabase/supabase-js`) gated on env vars.

## The `lib/` data layer (portable, framework-agnostic — reuse it)

- `lib/persist.ts` — the **single storage seam**: `readJSON`/`writeJSON` (the ONLY code that
  touches localStorage), plus `dateToKey()`, `createId()`, and `subscribeWrites()` (the
  write-through hook the cloud-sync layer uses). **Swapping this for filesystem/IPC is how the
  Electron edition migrates — don't scatter `localStorage` calls elsewhere.**
- `lib/types.ts` — `Todo`, `Habit`, `DayLog`, `Note`, `PomodoroSession`, and the versioned
  `TenetData` snapshot (the export/backup/vault-file shape). New fields are optional &
  back-compatible; synced records carry an optional `updatedAt` for last-write-wins.
- `lib/storage.ts` — pure `Todo[]` ops (CRUD, date scheduling, classification, `creditPomodoro`).
- `lib/notes.ts` — pure `Note[]` CRUD (daily/monthly reminders + freeform custom notes).
- `lib/deadlines.ts` — pure hard-deadline status/grouping/formatting (Things-3-style `deadline`).
- `lib/prioritization.ts` — pure Eisenhower logic: `getQuadrant`, `quadrantBreakdown`,
  `taskHints`, `nudges`, `QUADRANT_META` (the quadrant colors), and all tunable thresholds as
  named constants. See `docs/warikoo-time-management-spec.md`.
- `lib/habits.ts`, `lib/daylog.ts` — habit streaks and the day satisfaction log.
- `lib/dates.ts` — dependency-free natural-language date parser (`parseWhen`).
- `lib/session.ts` — which task the current Pomodoro is focused on (Pomodoro↔task link).
- `lib/pomodoroLog.ts` — the focus-session ledger: append-only local mirror + best-effort
  insert into the immutable cloud `pomodoro_sessions` table; streak/heatmap readers.
- **Cloud layer (opt-in, env-gated, all no-op when unconfigured):**
  - `lib/supabase.ts` — singleton client + `cloudEnabled`. Returns `null` without env vars.
  - `lib/cloud/auth.ts` — OAuth sign-in/out, auth subscription, GitHub `provider_token` capture.
  - `lib/cloud/sync.ts` — local-first sync: pull-on-login merge (per-record LWW via `updatedAt`
    + a snapshot diff) and a debounced write-through push. Hooks in only at `subscribeWrites`.
  - `lib/githubStreak.ts` — the daily accountability commit to the `tenet-log` repo (Contents
    API, CORS, deduped to one commit/active day).
  - `supabase/migrations/0001_init.sql` — schema + RLS (the source of truth for the cloud shape).

> **Live instance (provisioned 2026-06-20):** Supabase project ref `jfxbltohhirevwunyipd`
> (`https://jfxbltohhirevwunyipd.supabase.co`); GitHub OAuth enabled; schema loaded; verified
> working locally (sign-in + sync). URL + anon key are in `.env.local` (gitignored, public-safe).
> **Never commit the DB password or the GitHub OAuth client secret** — those live in the
> dashboard / a password manager only. Full details + setup steps: **`README.md`**.

## Architecture decisions (locked)

1. TypeScript, strict mode, no `any` without a justifying comment.
2. Static export stays — even the cloud layer is client-side only (no server of ours).
3. Persistence funnels through `lib/persist.ts`. Data is portable JSON (`TenetData`). The cloud
   layer attaches ONLY via `subscribeWrites()` — never scatter Supabase calls into domain/UI code.
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
- [x] **Bottom nav dock** (Calendar · Tasks · Habits · Matrix · Notes) — replaced floating buttons.
- [x] **Hard deadlines + matrix dashboard** — Things-3-style `deadline` on tasks (separate from
      quadrant & planner date); deadline pills/picker/reminder; `MatrixDashboard` panel.
- [x] **Notes & reminders** — daily reminder, monthly reminder, freeform custom notes (`NotesPanel`).
- [x] **Opt-in cloud layer — LIVE (Supabase provisioned, GitHub OAuth verified locally)** —
      Supabase auth (GitHub; Google not yet set up), local-first sync, immutable
      `pomodoro_sessions` ledger, and the GitHub contribution-graph streak commit. Gated on
      `NEXT_PUBLIC_SUPABASE_*` (in `.env.local`); unset ⇒ app stays local-only. See `README.md`.
      Remaining: Vercel deploy + production redirect URLs.

**Next up (see `docs/roadmap-and-research.md` for the full prioritized backlog):**
dark mode + design tokens → data safety (JSON export/import) → a persistent "Today" home →
swipe gestures + completion delight → settings → realtime multi-device push (Supabase Realtime).
In-app reminders stay foreground-only by design.

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
