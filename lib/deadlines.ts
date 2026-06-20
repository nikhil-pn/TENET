// Deadline logic — a hard "due by" day, parallel to (and independent of) the
// Eisenhower quadrant. Pure, framework-agnostic, no React/DOM.
//
// Correctness: a DateKey is zero-padded "YYYY-MM-DD", so lexicographic string
// comparison == chronological comparison. All status logic compares DateKey
// strings; the only Date touched is `shiftKey`, which routes through the local
// `dateToKey` (same path the calendar and parseWhen use) → timezone/DST-proof.

import type { DateKey, Todo } from "./types";
import { dateToKey } from "./persist";

/** "Due soon" horizon: today < deadline <= today + this many days ⇒ "soon". */
export const DEADLINE_SOON_DAYS = 3;

export type DeadlineStatus = "overdue" | "today" | "soon" | "later";

export interface DeadlineMeta {
  label: string;
  color: string;
}

/** Colors reuse the quadrant palette (become CSS tokens in the dark-mode pass). */
export const DEADLINE_META: Record<DeadlineStatus, DeadlineMeta> = {
  overdue: { label: "Overdue", color: "#f44336" }, // red
  today: { label: "Due today", color: "#ff9800" }, // orange
  soon: { label: "Due soon", color: "#ff9800" }, // orange
  later: { label: "Upcoming", color: "#9e9e9e" }, // gray
};

/** Calm, planning-oriented copy — replan rather than panic; nudge toward Q2 scheduling. */
export const DEADLINE_COPY = {
  overdue: "Slipped past — replan, don't cram.",
  today: "Due today.",
  upcoming: "Block time this week so it stays calm.",
} as const;

/** Local "YYYY-MM-DD" key `days` from `today`. The only place a Date is used. */
function shiftKey(days: number, today: Date = new Date()): DateKey {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return dateToKey(d);
}

/** Status of a bare date key relative to today (pure string comparison). */
export function deadlineStatusForKey(
  key: DateKey,
  today: Date = new Date()
): DeadlineStatus {
  const todayKey = dateToKey(today);
  if (key < todayKey) return "overdue";
  if (key === todayKey) return "today";
  if (key <= shiftKey(DEADLINE_SOON_DAYS, today)) return "soon";
  return "later";
}

/** Status of a task's deadline, or null when it has none. */
export function deadlineStatus(
  t: Pick<Todo, "deadline">,
  today: Date = new Date()
): DeadlineStatus | null {
  if (!t.deadline) return null;
  return deadlineStatusForKey(t.deadline, today);
}

/** A task whose deadline still matters: set, and not done/delegated/dropped. */
function hasLiveDeadline(t: Todo): t is Todo & { deadline: DateKey } {
  return t.deadline !== undefined && !t.done && !t.delegated && !t.dropped;
}

export interface DeadlineGroups {
  overdue: Todo[];
  today: Todo[];
  /** "soon" + "later" merged, soonest-first; the pill color still distinguishes them. */
  upcoming: Todo[];
  total: number;
}

/** Live deadlines grouped for the dashboard, each sorted soonest-first. */
export function upcomingDeadlines(
  todos: Todo[],
  today: Date = new Date()
): DeadlineGroups {
  const overdue: Todo[] = [];
  const todayList: Todo[] = [];
  const upcoming: Todo[] = [];
  for (const t of todos) {
    if (!hasLiveDeadline(t)) continue;
    const status = deadlineStatusForKey(t.deadline, today);
    if (status === "overdue") overdue.push(t);
    else if (status === "today") todayList.push(t);
    else upcoming.push(t);
  }
  // All items here have a deadline; the `?? ""` only satisfies the optional type.
  const byDeadline = (a: Todo, b: Todo): number => {
    const da = a.deadline ?? "";
    const db = b.deadline ?? "";
    if (da !== db) return da < db ? -1 : 1;
    return a.order - b.order;
  };
  overdue.sort(byDeadline);
  todayList.sort(byDeadline);
  upcoming.sort(byDeadline);
  return {
    overdue,
    today: todayList,
    upcoming,
    total: overdue.length + todayList.length + upcoming.length,
  };
}

/** Count of live deadlines per day, for calendar markers (keyed by deadline). */
export function deadlinesByDate(todos: Todo[]): Record<DateKey, number> {
  return todos.reduce<Record<DateKey, number>>((acc, t) => {
    if (hasLiveDeadline(t)) {
      acc[t.deadline] = (acc[t.deadline] ?? 0) + 1;
    }
    return acc;
  }, {});
}

/**
 * Important tasks that are overdue or due within the soon window — the only
 * deadlines worth a quiet home-screen reminder. Sorted soonest-first.
 */
export function importantReminders(todos: Todo[], today: Date = new Date()): Todo[] {
  return todos
    .filter(hasLiveDeadline)
    .filter(
      (t) => t.important === true && deadlineStatusForKey(t.deadline, today) !== "later"
    )
    .sort((a, b) =>
      a.deadline !== b.deadline ? (a.deadline < b.deadline ? -1 : 1) : a.order - b.order
    );
}

/** Compact pill label: Today / Tomorrow / weekday (this week) / "Jun 22". */
export function formatDeadline(key: DateKey, today: Date = new Date()): string {
  const todayKey = dateToKey(today);
  if (key === todayKey) return "Today";
  if (key === shiftKey(1, today)) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (key > todayKey && key <= shiftKey(6, today)) {
    return date.toLocaleDateString(undefined, { weekday: "short" }); // e.g. "Mon"
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // e.g. "Jun 22"
}
