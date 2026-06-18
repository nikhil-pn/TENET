import type { DateKey, Todo } from "./types";

// ── Config: every threshold is a named constant (single source of truth) ───────
export const TWO_MIN_MAX = 2; // important & ≤ this ⇒ "just do it now"
export const LONG_TASK_MIN = 120; // important & ≥ this ⇒ "plan / break it down"
export const REFERENCE_IMPORTANT_SHARE = 75; // Warikoo's MEASURED outcome — a reference, NOT a target
export const TRACKING_WINDOW_DAYS = 10; // the 10-day audit cycle
export const TIME_BLOCK_MIN = 90; // suggested protected focus block
export const POMODORO_MIN = 25; // matches the Clock focus length

/** Warikoo's own measured mix. Shown beside the user's mix as a reference, never scored. */
export const REFERENCE_MIX = { q1: 23, q2: 52, q3: 12, q4: 13 } as const;

export type Quadrant = "q1" | "q2" | "q3" | "q4";

export interface QuadrantMeta {
  name: string;
  action: string;
  short: string; // badge text
  color: string; // matches the --q-* tokens
}
export const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  q1: { name: "Important & Urgent", action: "Do it now", short: "Do now", color: "#f44336" },
  q2: { name: "Important, Not Urgent", action: "Schedule it", short: "Schedule", color: "#4caf50" },
  q3: { name: "Urgent, Not Important", action: "Delegate it", short: "Delegate", color: "#ff9800" },
  q4: { name: "Neither", action: "Drop / minimize", short: "Drop", color: "#9e9e9e" },
};

/** Derived quadrant, or null when EITHER axis is unset (unclassified). Never stored. */
export function getQuadrant(t: Pick<Todo, "important" | "urgent">): Quadrant | null {
  if (t.important === undefined || t.urgent === undefined) return null;
  if (t.important && t.urgent) return "q1";
  if (t.important && !t.urgent) return "q2";
  if (!t.important && t.urgent) return "q3";
  return "q4";
}

export type TaskState = "open" | "done" | "delegated" | "dropped";
export function taskState(t: Todo): TaskState {
  if (t.done) return "done";
  if (t.delegated) return "delegated";
  if (t.dropped) return "dropped";
  return "open";
}

/** A task that still counts toward the live workload mix (open + fully classified). */
function isActiveClassified(t: Todo): boolean {
  return taskState(t) === "open" && getQuadrant(t) !== null;
}

export interface QuadrantBreakdown {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  importantSharePct: number; // q1 + q2
  urgentSharePct: number; // q1 + q3
  mode: "time" | "count";
  classifiedCount: number;
  unclassifiedCount: number; // open tasks still needing triage
}

/** Round raw percentages to integers that sum to exactly 100 (largest-remainder). */
function roundTo100(raw: number[]): number[] {
  const floors = raw.map((r) => Math.floor(r));
  let remainder = 100 - floors.reduce((s, n) => s + n, 0);
  const byFrac = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < byFrac.length && remainder > 0; k++) {
    out[byFrac[k].i] += 1;
    remainder -= 1;
  }
  return out;
}

/**
 * Time-weighted distribution (by actual or estimated minutes), with a count
 * fallback when no active task has minutes. Excludes unclassified and
 * done/delegated/dropped tasks so the percentages describe the live workload.
 */
export function quadrantBreakdown(tasks: Todo[]): QuadrantBreakdown {
  const active = tasks.filter(isActiveClassified);
  const unclassifiedCount = tasks.filter(
    (t) => taskState(t) === "open" && getQuadrant(t) === null
  ).length;
  const useTime = active.some((t) => (t.actualMinutes ?? t.estimatedMinutes ?? 0) > 0);
  const weight = (t: Todo) => (useTime ? t.actualMinutes ?? t.estimatedMinutes ?? 0 : 1);

  const totals: Record<Quadrant, number> = { q1: 0, q2: 0, q3: 0, q4: 0 };
  let total = 0;
  for (const t of active) {
    const q = getQuadrant(t);
    if (!q) continue;
    const w = weight(t);
    totals[q] += w;
    total += w;
  }

  const empty = {
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    importantSharePct: 0,
    urgentSharePct: 0,
    mode: useTime ? ("time" as const) : ("count" as const),
    classifiedCount: active.length,
    unclassifiedCount,
  };
  if (total <= 0) return empty;

  const raw = (["q1", "q2", "q3", "q4"] as const).map((q) => (100 * totals[q]) / total);
  const [q1, q2, q3, q4] = roundTo100(raw);
  return {
    q1,
    q2,
    q3,
    q4,
    importantSharePct: q1 + q2,
    urgentSharePct: q1 + q3,
    mode: useTime ? "time" : "count",
    classifiedCount: active.length,
    unclassifiedCount,
  };
}

export interface TaskHints {
  quickWin: boolean; // two-minute rule
  needsPlan: boolean; // long-task rule
  delegate: boolean;
  minimize: boolean;
}
export function taskHints(t: Todo): TaskHints {
  const m = t.estimatedMinutes;
  const q = getQuadrant(t);
  return {
    quickWin: t.important === true && m !== undefined && m <= TWO_MIN_MAX,
    needsPlan: t.important === true && m !== undefined && m >= LONG_TASK_MIN,
    delegate: q === "q3",
    minimize: q === "q4",
  };
}

const QUADRANT_RANK: Record<Quadrant, number> = { q1: 0, q2: 1, q3: 2, q4: 3 };
/** Energy-aware ordering: Q1 → Q2 → Q3 → Q4 → unclassified, ties by manual order. */
export function suggestedOrder(tasks: Todo[]): Todo[] {
  return [...tasks].sort((a, b) => {
    const qa = getQuadrant(a);
    const qb = getQuadrant(b);
    const ra = qa ? QUADRANT_RANK[qa] : 4;
    const rb = qb ? QUADRANT_RANK[qb] : 4;
    if (ra !== rb) return ra - rb;
    return a.order - b.order;
  });
}

export function estimatePomodoros(
  minutes: number | undefined,
  pomodoroMin: number = POMODORO_MIN
): number {
  if (!minutes || minutes <= 0) return 0;
  return Math.ceil(minutes / pomodoroMin);
}

export interface QuadrantBuckets {
  q1: Todo[];
  q2: Todo[];
  q3: Todo[];
  q4: Todo[];
  unclassified: Todo[];
}
export function todosByQuadrant(tasks: Todo[]): QuadrantBuckets {
  const buckets: QuadrantBuckets = { q1: [], q2: [], q3: [], q4: [], unclassified: [] };
  for (const t of tasks) {
    const q = getQuadrant(t);
    if (q) buckets[q].push(t);
    else buckets.unclassified.push(t);
  }
  return buckets;
}

export interface QuadrantTally {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  unclassified: number;
}
/** Per-date quadrant tally for calendar day-cell dots (dated tasks only). */
export function quadrantCountsByDate(tasks: Todo[]): Record<DateKey, QuadrantTally> {
  const out: Record<string, QuadrantTally> = {};
  for (const t of tasks) {
    if (!t.date) continue;
    const slot = out[t.date] ?? (out[t.date] = { q1: 0, q2: 0, q3: 0, q4: 0, unclassified: 0 });
    const q = getQuadrant(t);
    if (q) slot[q] += 1;
    else slot.unclassified += 1;
  }
  return out;
}

export interface Nudge {
  id: string;
  message: string;
}
/** Gentle, dismissible suggestions derived from the mix. Never guilt; all opt-out. */
export function nudges(b: QuadrantBreakdown): Nudge[] {
  const out: Nudge[] = [];
  if (b.classifiedCount === 0) return out;
  if (b.importantSharePct < 50)
    out.push({
      id: "low-important",
      message: "Most of your time is going to non-essential tasks — re-prioritize or delegate.",
    });
  if (b.q1 > 40)
    out.push({
      id: "firefighting",
      message:
        "You're in reactive mode. Schedule Q2 (important, not urgent) work earlier so it doesn't become urgent.",
    });
  if (b.q4 > 20)
    out.push({
      id: "distraction",
      message: "Distraction time is high — set a boundary or use a dedicated slot.",
    });
  if (b.q3 > 25)
    out.push({
      id: "delegate",
      message: "Lots of urgent-but-not-important work. What here could be delegated or automated?",
    });
  return out;
}
