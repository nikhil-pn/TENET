# Warikoo Eisenhower Prioritization + Time Audit — principles & implementation

This is the source of truth for TENET's prioritization feature: the **method/principles** it's
based on, the **formulas/constants**, and **how it maps to the code**. Read this before changing
anything in `lib/prioritization.ts` or the Tasks panel.

> Implemented 2026-06. The feature is live on the `Tasks` panel (the dock's "Tasks" → tabs
> **List / Matrix / Insights**).

---

## 1. The method (Ankur Warikoo's tracked Eisenhower)

A practical, **tracked** version of the Eisenhower Matrix. Two independent axes per task:

- **Important** — it matters to *your* long-term goals (exercise, learning, calling family,
  deep work). Importance ≠ urgency.
- **Urgent** — it is **time-bound** (a window/deadline), but not necessarily important.

The four quadrants and their actions:

| Quadrant | Important? | Urgent? | Action | Example |
|---|---|---|---|---|
| **Q1** | Yes | Yes | **Do now** | A deadline today |
| **Q2** | Yes | No  | **Schedule** (the sweet spot) | Exercise, learning |
| **Q3** | No  | Yes | **Delegate** | An errand, a repair |
| **Q4** | No  | No  | **Drop / minimize** | Mindless scrolling |

**Warikoo's additions (the differentiators — all implemented):**
1. **A "dimension of time" on every task** — after classifying, ask *"how long will this take?"*
   This drives the two rules below and lets us measure *time*, not just count tasks.
2. **Two-minute rule** — if a task is Important and takes ≤ ~2 min, **do it now**, don't schedule.
3. **Long-task rule** — if an Important task takes hours, schedule a short **planning block** first
   and break it into chunks.
4. **"Time is energy"** — do Q1 at peak energy (mornings), then Q2, then Q3; leave Q4 for low-energy
   times. (Surfaced as the suggested ordering Q1→Q2→Q3→Q4.)
5. **Time-blocking** — protect long single-task focus blocks instead of fragmenting the day. In
   TENET this maps onto **runs of Pomodoro sessions** (the planner is date-level, not a 30-min grid).
6. **The time-mix is the feedback** — track where time actually goes across quadrants and compare
   to a healthy reference.

**The reference mix (read carefully):** Warikoo's *own measured* distribution was
**Q2 ≈ 52%, Q1 ≈ 23%, Q3 ≈ 12%, Q4 ≈ 13%** → ~**75% of time on Important things**. He explicitly
calls this **"a derivation, not a target."** So the UI shows ~75% important-share as a **healthy
reference to compare against — never a goal, score, or pass/fail.** Keep that framing.

---

## 2. Formulas & constants (in `lib/prioritization.ts`)

All thresholds are **named constants** (never inline magic numbers):

```
TWO_MIN_MAX = 2            // important & ≤2 min  → "just do it" quick-win hint
LONG_TASK_MIN = 120        // important & ≥120 min → "plan / break it" hint
REFERENCE_IMPORTANT_SHARE = 75   // the reference, NOT a target
TRACKING_WINDOW_DAYS = 10  // the 10-day audit
TIME_BLOCK_MIN = 90        // suggested protected focus block
POMODORO_MIN = 25          // matches Clock.tsx
REFERENCE_MIX = { q1:23, q2:52, q3:12, q4:13 }
```

- `getQuadrant(t)` → `"q1"|"q2"|"q3"|"q4"` or **`null`** when either axis is unset (unclassified).
  **Quadrant is derived, never stored.**
- `quadrantBreakdown(tasks)` → the time-mix. **Time-weighted** by `actualMinutes ?? estimatedMinutes`,
  with a **count fallback** when no active task has minutes. **Excludes** unclassified +
  done/delegated/dropped tasks (so the percentages describe the live workload, not guesses). Rounds
  to sum 100. Returns `q1..q4`, `importantSharePct` (=q1+q2), `urgentSharePct` (=q1+q3), `mode`,
  and `classifiedCount`/`unclassifiedCount`.
- `taskHints(t)` → `quickWin` / `needsPlan` / `delegate` / `minimize` (drives capture-time hints).
- `nudges(breakdown)` → gentle, dismissible suggestions (importantShare<50, q1>40, q4>20, q3>25).
- `QUADRANT_META[q]` → `{ name, action, short, color }` (the single source of quadrant colors).

---

## 3. Data model (in `lib/types.ts`)

`Todo` gained these **optional, back-compatible** fields:
`important?`, `urgent?`, `estimatedMinutes?`, `delegated?`, `dropped?`, `pomodoroCount?`,
`actualMinutes?`. A task with no `important`/`urgent` is **"unclassified"** → shown in a triage
bucket, excluded from the mix. `DayLog { date; satisfactionScore (0–100); satisfactionNote?;
loggedAt }` backs the satisfaction check; `TenetData.dayLogs?` persists it.

---

## 4. How it's wired in the UI

- **Capture (List tab, `TodoPanel.tsx`)** — the add row has Important/Urgent toggles + estimate
  chips (2/15/30/60/120) + a **live quadrant badge** and quick-win/long-task hints. Defaults to
  Important=on/Urgent=off (Q2) so classification is never skipped. Rows show a quadrant color dot.
- **Matrix tab (`EisenhowerMatrix.tsx`)** — 2×2 (stacks on mobile) with per-quadrant **% of time**,
  color-coded cards, **tap toggles AND drag** to reclassify, an **Unclassified** triage bucket, and
  a **"▶ Focus"** button on Q1/Q2 cards.
- **Insights tab (`Insights.tsx` + `Reflect.tsx`)** — a 100% time-mix stacked bar (+ legend +
  time/count mode note), the **important-share gauge with the 75% reference marker** ("a healthy
  reference, not a target"), nudges, then the **end-of-day satisfaction slider + 10-day strip**.
- **Pomodoro link** — "▶ Focus" calls `setActiveSessionTask(id)` (`lib/session.ts`), closes the
  panel, and starts the existing timer; on completion `Clock.tsx` calls `creditPomodoro()` to add
  `pomodoroCount` + `actualMinutes` to the task (shifting the mix from estimated → actual).
- **Calendar** — day-cell dots are colored by quadrant.

---

## 5. Resources / source fidelity

- The quadrants, the "dimension of time," the two-minute & long-task rules, time-blocking,
  "time is energy," the 10-day audit, and the daily satisfaction check are from Ankur Warikoo's
  own content (his time-management video/newsletter and corroborated course reviews).
- The **52/23/12/13 (~75% important) split is Warikoo's measured outcome**, which he explicitly
  says is **a derivation, not a target** — present it as a reference only.
- Sample percentages in his screenshots (e.g. 20/40/20/20) are illustrative placeholders, not
  recommendations.
- Underlying frameworks worth knowing when extending: the **Eisenhower Matrix** (Covey, *7 Habits*),
  the **two-minute rule** (GTD, David Allen), and **time-blocking / deep work** (Cal Newport).
