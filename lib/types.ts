// Portable, framework-agnostic domain types for TENET.
// No React, no DOM — safe to reuse from a future native shell or external tooling.

/** Epoch milliseconds (Date.now()). Portable JSON, sortable, needs no Date revival. */
export type Timestamp = number;

/** A local calendar date as "YYYY-MM-DD". */
export type DateKey = string;

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  createdAt: Timestamp;
  /** Set when the task is checked off; cleared when unchecked. */
  completedAt?: Timestamp;
  /** Manual sort position. Lets us reorder later without a data migration. */
  order: number;
  /** Reserved for the Day Planner / Today view. Unused in the v1 checklist UI. */
  date?: DateKey;
  /** Reserved for foreground reminders. Unused in the v1 checklist UI. */
  dueAt?: Timestamp;

  // ── Eisenhower / time-audit (Warikoo). All optional → back-compatible. ──
  /** Matters to long-term goals. undefined ⇒ unclassified. */
  important?: boolean;
  /** Time-bound. undefined ⇒ unclassified. */
  urgent?: boolean;
  /** The "dimension of time": user's estimate in minutes. */
  estimatedMinutes?: number;
  /** Q3 action — handed off. Excluded from the active time-mix. */
  delegated?: boolean;
  /** Q4 action — consciously abandoned. Excluded from the active time-mix. */
  dropped?: boolean;
  /** Completed focus sessions logged against this task (Pomodoro link). */
  pomodoroCount?: number;
  /** Measured focus minutes from completed Pomodoros (shifts the mix estimated→actual). */
  actualMinutes?: number;
}

/** One per calendar day — the end-of-day satisfaction check + 10-day cycle. */
export interface DayLog {
  date: DateKey;
  /** 0–100. */
  satisfactionScore: number;
  satisfactionNote?: string;
  loggedAt: Timestamp;
}

export interface Habit {
  id: string;
  name: string;
  /** Optional leading glyph (e.g. "🏋️"). Reserved — not set by the v1 UI. */
  emoji?: string;
  createdAt: Timestamp;
  /** Manual sort position. Lets us reorder later without a data migration. */
  order: number;
  /**
   * Map of "YYYY-MM-DD" → amount done that day (1 for a simple check-off).
   * Stored as a count so quantified habits (e.g. glasses of water) need no migration.
   */
  checkins: Record<DateKey, number>;
  /** Reserved — required amount per day to count as done (quantified habits). Defaults to 1. */
  targetPerDay?: number;
  /** Reserved — hide without deleting history. */
  archived?: boolean;
}

/**
 * Top-level portable snapshot of all app data. This is the shape JSON
 * export/import will use, and the shape a future Electron file / Obsidian-vault
 * note will hold. Versioned so the data can be migrated safely.
 */
export interface TenetData {
  version: 1;
  todos: Todo[];
  habits: Habit[];
  dayLogs?: DayLog[];
}
