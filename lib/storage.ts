import type { DateKey, Todo } from "./types";
import { createId, readJSON, writeJSON } from "./persist";

/** localStorage key for the to-do list. Versioned so the shape can evolve safely. */
const TODOS_KEY = "tenet.todos.v1";

// ── Validation ───────────────────────────────────────────────────────────────

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  const optBool = (v: unknown) => v === undefined || typeof v === "boolean";
  const optNum = (v: unknown) => v === undefined || typeof v === "number";
  const optStr = (v: unknown) => v === undefined || typeof v === "string";
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.done === "boolean" &&
    typeof t.createdAt === "number" &&
    typeof t.order === "number" &&
    optBool(t.important) &&
    optBool(t.urgent) &&
    optNum(t.estimatedMinutes) &&
    optBool(t.delegated) &&
    optBool(t.dropped) &&
    optNum(t.pomodoroCount) &&
    optNum(t.actualMinutes) &&
    optStr(t.deadline)
  );
}

// ── To-do persistence (through the seam) ──────────────────────────────────────

export function loadTodos(): Todo[] {
  const stored = readJSON<unknown[]>(TODOS_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isTodo);
}

export function saveTodos(todos: Todo[]): void {
  writeJSON(TODOS_KEY, todos);
}

// ── Pure list operations (no I/O — testable and portable) ──────────────────────

/** Optional classification seeded at creation time (Eisenhower). */
export interface TaskInit {
  important?: boolean;
  urgent?: boolean;
  estimatedMinutes?: number;
  deadline?: DateKey;
}

function applyInit(init?: TaskInit): Partial<Todo> {
  if (!init) return {};
  const out: Partial<Todo> = {};
  if (init.important !== undefined) out.important = init.important;
  if (init.urgent !== undefined) out.urgent = init.urgent;
  if (init.estimatedMinutes !== undefined) out.estimatedMinutes = init.estimatedMinutes;
  if (init.deadline !== undefined) out.deadline = init.deadline;
  return out;
}

export function addTodo(todos: Todo[], title: string, init?: TaskInit): Todo[] {
  const trimmed = title.trim();
  if (trimmed === "") return todos;
  const maxOrder = todos.reduce((max, t) => Math.max(max, t.order), 0);
  const todo: Todo = {
    id: createId(),
    title: trimmed,
    done: false,
    createdAt: Date.now(),
    order: maxOrder + 1,
    ...applyInit(init),
  };
  return [...todos, todo];
}

export function toggleTodo(todos: Todo[], id: string): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const nowDone = !t.done;
    const next: Todo = { ...t, done: nowDone };
    if (nowDone) {
      next.completedAt = Date.now();
      delete next.delegated;
      delete next.dropped;
    } else {
      delete next.completedAt;
    }
    return next;
  });
}

export function deleteTodo(todos: Todo[], id: string): Todo[] {
  return todos.filter((t) => t.id !== id);
}

// ── Planner ops (scheduling todos onto calendar dates) ─────────────────────────

/** Tasks scheduled to a specific local date, sorted by manual order. */
export function todosForDate(todos: Todo[], dateKey: DateKey): Todo[] {
  return todos
    .filter((t) => t.date === dateKey)
    .sort((a, b) => a.order - b.order);
}

/** Add a new task already pinned to a date. */
export function addTodoForDate(
  todos: Todo[],
  title: string,
  dateKey: DateKey,
  init?: TaskInit
): Todo[] {
  const trimmed = title.trim();
  if (trimmed === "") return todos;
  const maxOrder = todos.reduce((max, t) => Math.max(max, t.order), 0);
  const todo: Todo = {
    id: createId(),
    title: trimmed,
    done: false,
    createdAt: Date.now(),
    order: maxOrder + 1,
    date: dateKey,
    ...applyInit(init),
  };
  return [...todos, todo];
}

/** Schedule/reschedule (pass a key) or unschedule (pass undefined) a task. */
export function setTodoDate(
  todos: Todo[],
  id: string,
  dateKey: DateKey | undefined
): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t };
    if (dateKey === undefined) {
      delete next.date;
    } else {
      next.date = dateKey;
    }
    return next;
  });
}

/** Count of tasks per scheduled date, for calendar badges. */
export function countsByDate(todos: Todo[]): Record<DateKey, number> {
  return todos.reduce<Record<DateKey, number>>((acc, t) => {
    if (t.date) {
      acc[t.date] = (acc[t.date] ?? 0) + 1;
    }
    return acc;
  }, {});
}

// ── Classification + lifecycle ops (Eisenhower) ────────────────────────────────

/** Set important and/or urgent (only the provided axes change). */
export function setTodoFlags(
  todos: Todo[],
  id: string,
  flags: { important?: boolean; urgent?: boolean }
): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t };
    if (flags.important !== undefined) next.important = flags.important;
    if (flags.urgent !== undefined) next.urgent = flags.urgent;
    return next;
  });
}

/** Set or clear the estimated duration (minutes). */
export function setEstimate(todos: Todo[], id: string, minutes: number | undefined): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t };
    if (minutes === undefined) delete next.estimatedMinutes;
    else next.estimatedMinutes = minutes;
    return next;
  });
}

/** Set or clear the hard deadline (local "YYYY-MM-DD"). */
export function setDeadline(todos: Todo[], id: string, deadline: DateKey | undefined): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t };
    if (deadline === undefined) delete next.deadline;
    else next.deadline = deadline;
    return next;
  });
}

export function setDelegated(todos: Todo[], id: string, value: boolean): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t, delegated: value };
    if (value) next.dropped = false;
    return next;
  });
}

export function setDropped(todos: Todo[], id: string, value: boolean): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    const next: Todo = { ...t, dropped: value };
    if (value) next.delegated = false;
    return next;
  });
}

/** Credit one completed focus session to a task (Pomodoro link). */
export function creditPomodoro(todos: Todo[], id: string, minutes: number = 25): Todo[] {
  return todos.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      pomodoroCount: (t.pomodoroCount ?? 0) + 1,
      actualMinutes: (t.actualMinutes ?? 0) + minutes,
    };
  });
}
