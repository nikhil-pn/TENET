// The Coach digest builder — DETERMINISTIC, no LLM. This is where the real
// intelligence lives: it reads the existing local stores and pre-computes every
// number the Coach reports, so the LLM only ever NARRATES facts it is handed
// (compute-first / narrate-second) and the same numbers power a templated
// offline fallback. Pure functions over the load*() readers — framework-agnostic
// and reusable by a future Electron/MCP edition.
//
// PRIVACY: the digest is counts/ratios + at most a few short task titles. Free
// text (satisfaction notes, note bodies) is NEVER included here — see coach.ts
// for the opt-in note path.

import type { DateKey, Habit, Todo } from "../types";
import { dateToKey } from "../persist";
import {
  type Quadrant,
  type QuadrantBreakdown,
  getQuadrant,
  nudges,
  quadrantBreakdown,
  REFERENCE_IMPORTANT_SHARE,
  REFERENCE_MIX,
} from "../prioritization";
import { loadTodos } from "../storage";
import { currentStreak, isDoneOn, loadHabits } from "../habits";
import { loadDayLogs } from "../daylog";
import { focusStreak, loadSessions } from "../pomodoroLog";
import { aiDevOverride } from "./config";

/** The Coach looks back over this many days (the reporting window). */
export const COACH_WINDOW_DAYS = 14;

/** Distinct active days in the last 30 needed before the Coach is offered. */
export const MIN_ACTIVE_DAYS = 10;
/** Lookback for the active-days sufficiency check. */
const ACTIVITY_LOOKBACK_DAYS = 30;
/** Max overdue tasks surfaced (the only raw titles that leave the device). */
const MAX_MISSED = 5;
/** Titles are truncated to this many chars before being sent. */
const TITLE_MAX = 60;

const QUADRANTS: readonly Quadrant[] = ["q1", "q2", "q3", "q4"];

// ── Small date helpers (local-time, dependency-free) ───────────────────────────

function parseKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDayMs(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Whole days from `key` up to `today` (positive ⇒ in the past). */
function daysAgo(key: DateKey, today: Date): number {
  return Math.round((startOfDayMs(today) - startOfDayMs(parseKey(key))) / 86_400_000);
}

/** The last `n` local day keys, oldest → newest, ending today. */
function dayKeysEndingToday(n: number, today: Date): DateKey[] {
  const out: DateKey[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(dateToKey(d));
  }
  return out;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ── Digest shape (what the Coach reasons over) ─────────────────────────────────

export interface MissedTask {
  title: string;
  quadrant: Quadrant | null;
  daysAgo: number;
}

export interface QuadrantCompletion {
  scheduled: number;
  completed: number;
}

export interface HabitStat {
  name: string;
  consistencyPct: number;
  currentStreak: number;
  missed: number;
}

export interface CoachDigest {
  windowDays: number;
  generatedFor: DateKey;
  mix: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    importantSharePct: number;
    urgentSharePct: number;
    mode: QuadrantBreakdown["mode"];
    classifiedCount: number;
    unclassifiedCount: number;
  };
  reference: { q1: number; q2: number; q3: number; q4: number; importantSharePct: number };
  completion: {
    created: number;
    completed: number;
    ratePct: number;
    byQuadrant: Record<Quadrant, QuadrantCompletion>;
  };
  missedScheduled: MissedTask[];
  /** null when no completed task has both an estimate and measured actual minutes. */
  estimateDrift: { factor: number; n: number; worstQuadrant: Quadrant | null } | null;
  habits: HabitStat[];
  focus: { totalMin: number; dailyAvg: number; streak: number; sessions: number };
  satisfaction: { avg: number | null; trend: number | null; daysLogged: number };
  /** The deterministic nudges() messages — the LLM elaborates, never contradicts. */
  priorSignals: string[];
}

export interface DataSufficiency {
  ready: boolean;
  activeDays: number;
  estimatePairs: number;
}

// ── Sufficiency gate ───────────────────────────────────────────────────────────

/**
 * Whether enough data exists for a meaningful Coach review. Gates on distinct
 * ACTIVE days (not calendar age) so a returning user isn't blocked. `estimatePairs`
 * is reported for transparency but does NOT gate the Coach — drift is simply
 * omitted when no pairs exist (not every user links Pomodoros to tasks).
 */
export function dataSufficiency(today: Date = new Date()): DataSufficiency {
  const todos = loadTodos();
  const habits = loadHabits();
  const sessions = loadSessions();
  const logs = loadDayLogs();

  const cutoffMs = startOfDayMs(today) - (ACTIVITY_LOOKBACK_DAYS - 1) * 86_400_000;
  const withinLookback = (key: DateKey) => startOfDayMs(parseKey(key)) >= cutoffMs;

  const active = new Set<DateKey>();
  for (const t of todos) {
    if (t.createdAt >= cutoffMs) active.add(dateToKey(new Date(t.createdAt)));
    if (t.completedAt && t.completedAt >= cutoffMs) active.add(dateToKey(new Date(t.completedAt)));
  }
  for (const h of habits) {
    for (const key of Object.keys(h.checkins)) if (withinLookback(key)) active.add(key);
  }
  for (const s of sessions) if (withinLookback(s.date)) active.add(s.date);
  for (const l of logs) if (withinLookback(l.date)) active.add(l.date);

  const estimatePairs = todos.filter(
    (t) => t.done && (t.estimatedMinutes ?? 0) > 0 && (t.actualMinutes ?? 0) > 0
  ).length;

  return { ready: active.size >= MIN_ACTIVE_DAYS, activeDays: active.size, estimatePairs };
}

// ── Per-section builders ───────────────────────────────────────────────────────

function buildCompletion(todos: Todo[], windowStartMs: number): CoachDigest["completion"] {
  const createdInWindow = todos.filter((t) => t.createdAt >= windowStartMs);
  const completedOfThose = createdInWindow.filter((t) => t.done);
  const byQuadrant: Record<Quadrant, QuadrantCompletion> = {
    q1: { scheduled: 0, completed: 0 },
    q2: { scheduled: 0, completed: 0 },
    q3: { scheduled: 0, completed: 0 },
    q4: { scheduled: 0, completed: 0 },
  };
  // "Scheduled" = pinned to a planner day inside the window; "completed" = done.
  for (const t of todos) {
    if (!t.date) continue;
    if (startOfDayMs(parseKey(t.date)) < windowStartMs) continue;
    const q = getQuadrant(t);
    if (!q) continue;
    byQuadrant[q].scheduled += 1;
    if (t.done) byQuadrant[q].completed += 1;
  }
  return {
    created: createdInWindow.length,
    completed: completedOfThose.length,
    ratePct:
      createdInWindow.length === 0
        ? 0
        : Math.round((100 * completedOfThose.length) / createdInWindow.length),
    byQuadrant,
  };
}

function buildMissed(todos: Todo[], today: Date): MissedTask[] {
  const todayKey = dateToKey(today);
  return todos
    .filter((t) => t.date && t.date < todayKey && !t.done && !t.delegated && !t.dropped)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")) // most overdue first
    .slice(0, MAX_MISSED)
    .map((t) => ({
      title: t.title.length > TITLE_MAX ? `${t.title.slice(0, TITLE_MAX - 1)}…` : t.title,
      quadrant: getQuadrant(t),
      daysAgo: t.date ? daysAgo(t.date, today) : 0,
    }));
}

function buildEstimateDrift(todos: Todo[]): CoachDigest["estimateDrift"] {
  const ratios: { ratio: number; quadrant: Quadrant | null }[] = [];
  for (const t of todos) {
    const est = t.estimatedMinutes ?? 0;
    const act = t.actualMinutes ?? 0;
    if (!t.done || est <= 0 || act <= 0) continue;
    ratios.push({ ratio: act / est, quadrant: getQuadrant(t) });
  }
  if (ratios.length === 0) return null;

  // Worst quadrant = the one whose work is most underestimated (highest median).
  let worstQuadrant: Quadrant | null = null;
  let worstMedian = -Infinity;
  for (const q of QUADRANTS) {
    const inQ = ratios.filter((r) => r.quadrant === q).map((r) => r.ratio);
    if (inQ.length === 0) continue;
    const m = median(inQ);
    if (m > worstMedian) {
      worstMedian = m;
      worstQuadrant = q;
    }
  }
  return {
    factor: Math.round(median(ratios.map((r) => r.ratio)) * 100) / 100,
    n: ratios.length,
    worstQuadrant,
  };
}

function buildHabits(habits: Habit[], windowKeys: DateKey[], todayKey: DateKey): HabitStat[] {
  return habits
    .filter((h) => !h.archived)
    .map((h) => {
      const createdKey = dateToKey(new Date(h.createdAt));
      // Only count window days on/after the habit existed and up to today.
      const eligible = windowKeys.filter((k) => k >= createdKey && k <= todayKey);
      const done = eligible.filter((k) => isDoneOn(h, k)).length;
      return {
        name: h.name,
        consistencyPct: eligible.length === 0 ? 0 : Math.round((100 * done) / eligible.length),
        currentStreak: currentStreak(h),
        missed: Math.max(0, eligible.length - done),
      };
    });
}

function buildSatisfaction(
  logs: { date: DateKey; satisfactionScore: number }[],
  windowKeys: DateKey[]
): CoachDigest["satisfaction"] {
  const inWindow = logs
    .filter((l) => windowKeys.includes(l.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (inWindow.length === 0) return { avg: null, trend: null, daysLogged: 0 };
  const scores = inWindow.map((l) => l.satisfactionScore);
  const avg = Math.round(mean(scores));
  let trend: number | null = null;
  if (inWindow.length >= 2) {
    const half = Math.floor(inWindow.length / 2);
    const first = mean(scores.slice(0, half));
    const second = mean(scores.slice(inWindow.length - half));
    trend = Math.round(second - first);
  }
  return { avg, trend, daysLogged: inWindow.length };
}

// ── The assembler ──────────────────────────────────────────────────────────────

/**
 * Build the full Coach digest from local data. Pure read — never writes. All
 * numbers are computed here so the LLM (and the templated fallback) only narrate.
 */
export function buildCoachDigest(today: Date = new Date()): CoachDigest {
  const todos = loadTodos();
  const habits = loadHabits();
  const sessions = loadSessions();
  const logs = loadDayLogs();

  const windowKeys = dayKeysEndingToday(COACH_WINDOW_DAYS, today);
  const windowKeySet = new Set(windowKeys);
  const windowStartMs = startOfDayMs(parseKey(windowKeys[0]));
  const todayKey = dateToKey(today);

  const b = quadrantBreakdown(todos);

  const windowSessions = sessions.filter((s) => windowKeySet.has(s.date));
  const totalMin = windowSessions.reduce((s, x) => s + x.durationMinutes, 0);

  return {
    windowDays: COACH_WINDOW_DAYS,
    generatedFor: todayKey,
    mix: {
      q1: b.q1,
      q2: b.q2,
      q3: b.q3,
      q4: b.q4,
      importantSharePct: b.importantSharePct,
      urgentSharePct: b.urgentSharePct,
      mode: b.mode,
      classifiedCount: b.classifiedCount,
      unclassifiedCount: b.unclassifiedCount,
    },
    reference: { ...REFERENCE_MIX, importantSharePct: REFERENCE_IMPORTANT_SHARE },
    completion: buildCompletion(todos, windowStartMs),
    missedScheduled: buildMissed(todos, today),
    estimateDrift: buildEstimateDrift(todos),
    habits: buildHabits(habits, windowKeys, todayKey),
    focus: {
      totalMin,
      dailyAvg: Math.round(totalMin / COACH_WINDOW_DAYS),
      streak: focusStreak(today),
      sessions: windowSessions.length,
    },
    satisfaction: buildSatisfaction(logs, windowKeys),
    priorSignals: nudges(b).map((n) => n.message),
  };
}
