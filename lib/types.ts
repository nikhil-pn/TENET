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
  /**
   * Hard deadline — the local calendar day this task must be done BY
   * (Things-3 style "Deadline"). Distinct from `date` (the scheduled/planner
   * day) and `dueAt` (a reserved reminder timestamp). undefined ⇒ no deadline.
   */
  deadline?: DateKey;

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

  /**
   * Epoch-ms of the last local edit, stamped by the cloud-sync layer for
   * last-write-wins. Optional + back-compatible; absent ⇒ treated as oldest.
   */
  updatedAt?: Timestamp;
}

/** One per calendar day — the end-of-day satisfaction check + 10-day cycle. */
export interface DayLog {
  date: DateKey;
  /** 0–100. */
  satisfactionScore: number;
  satisfactionNote?: string;
  loggedAt: Timestamp;
  /** Last-write-wins stamp for cloud sync. See `Todo.updatedAt`. */
  updatedAt?: Timestamp;
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
  /** Last-write-wins stamp for cloud sync. See `Todo.updatedAt`. */
  updatedAt?: Timestamp;
}

/**
 * A note or reminder. `kind` distinguishes a day reminder, a monthly reminder,
 * and a freeform custom note; it's a plain string so future kinds need no
 * migration. Synced like todos/habits.
 */
export interface Note {
  id: string;
  /**
   * "daily" → a specific day · "monthly" → a month · "custom" → freeform ·
   * "event" → a calendar event/reminder pinned to a day (multiple allowed).
   */
  kind: "daily" | "monthly" | "custom" | "event";
  /**
   * For "daily"/"event" the day "YYYY-MM-DD"; for "monthly" the month "YYYY-MM".
   */
  date?: DateKey;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * One completed focus session — the immutable accountability ledger row.
 * Written once on Pomodoro completion, never edited (insert-only under RLS).
 */
export interface PomodoroSession {
  id: string;
  /** The task this session was focused on, if any (Pomodoro↔task link). */
  taskId?: string;
  startedAt: Timestamp;
  endedAt: Timestamp;
  durationMinutes: number;
  /** Local calendar day "YYYY-MM-DD" the session counts toward. */
  date: DateKey;
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
  notes?: Note[];
}
