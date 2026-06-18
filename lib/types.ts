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
}

/**
 * Top-level portable snapshot of all app data. This is the shape JSON
 * export/import will use, and the shape a future Electron file / Obsidian-vault
 * note will hold. Versioned so the data can be migrated safely.
 */
export interface TenetData {
  version: 1;
  todos: Todo[];
}
