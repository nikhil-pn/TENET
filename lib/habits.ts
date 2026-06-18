import type { DateKey, Habit } from "./types";
import { createId, dateToKey, readJSON, writeJSON } from "./persist";

/** localStorage key for habits. Versioned so the shape can evolve safely. */
const HABITS_KEY = "tenet.habits.v1";

// ── Validation ───────────────────────────────────────────────────────────────

function isHabit(value: unknown): value is Habit {
  if (typeof value !== "object" || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    typeof h.name === "string" &&
    typeof h.createdAt === "number" &&
    typeof h.order === "number" &&
    typeof h.checkins === "object" &&
    h.checkins !== null
  );
}

// ── Persistence (through the shared seam) ──────────────────────────────────────

export function loadHabits(): Habit[] {
  const stored = readJSON<unknown[]>(HABITS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isHabit);
}

export function saveHabits(habits: Habit[]): void {
  writeJSON(HABITS_KEY, habits);
}

// ── Pure operations (no I/O — testable and portable) ───────────────────────────

export function addHabit(habits: Habit[], name: string): Habit[] {
  const trimmed = name.trim();
  if (trimmed === "") return habits;
  const maxOrder = habits.reduce((max, h) => Math.max(max, h.order), 0);
  const habit: Habit = {
    id: createId(),
    name: trimmed,
    createdAt: Date.now(),
    order: maxOrder + 1,
    checkins: {},
  };
  return [...habits, habit];
}

export function deleteHabit(habits: Habit[], id: string): Habit[] {
  return habits.filter((h) => h.id !== id);
}

/** Whether the habit met its target on the given day. */
export function isDoneOn(habit: Habit, dateKey: DateKey): boolean {
  const amount = habit.checkins[dateKey] ?? 0;
  const target = habit.targetPerDay ?? 1;
  return amount >= target;
}

/** Toggle a simple check-in for the given day (sets the amount to the target, or clears it). */
export function toggleCheckin(
  habits: Habit[],
  id: string,
  dateKey: DateKey
): Habit[] {
  return habits.map((h) => {
    if (h.id !== id) return h;
    const checkins = { ...h.checkins };
    if (isDoneOn(h, dateKey)) {
      delete checkins[dateKey];
    } else {
      checkins[dateKey] = h.targetPerDay ?? 1;
    }
    return { ...h, checkins };
  });
}

/**
 * Current streak = consecutive completed days, counting back from today.
 * An unfinished *today* does NOT break the streak: if today isn't done yet we
 * count up to yesterday, so an in-progress day never costs you the chain.
 */
export function currentStreak(habit: Habit, today: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(today);
  if (!isDoneOn(habit, dateToKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (isDoneOn(habit, dateToKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface DayStatus {
  key: DateKey;
  done: boolean;
  isToday: boolean;
}

/** The last `n` days (oldest → newest), each with its done state — for the activity strip. */
export function recentDays(
  habit: Habit,
  n: number,
  today: Date = new Date()
): DayStatus[] {
  const todayKey = dateToKey(today);
  const days: DayStatus[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateToKey(d);
    days.push({ key, done: isDoneOn(habit, key), isToday: key === todayKey });
  }
  return days;
}
