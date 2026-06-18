import type { DateKey, Todo } from "./types";
import { createId, readJSON, writeJSON } from "./persist";

/** localStorage key for the to-do list. Versioned so the shape can evolve safely. */
const TODOS_KEY = "tenet.todos.v1";

// ── Validation ───────────────────────────────────────────────────────────────

function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.title === "string" &&
    typeof t.done === "boolean" &&
    typeof t.createdAt === "number" &&
    typeof t.order === "number"
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

export function addTodo(todos: Todo[], title: string): Todo[] {
  const trimmed = title.trim();
  if (trimmed === "") return todos;
  const maxOrder = todos.reduce((max, t) => Math.max(max, t.order), 0);
  const todo: Todo = {
    id: createId(),
    title: trimmed,
    done: false,
    createdAt: Date.now(),
    order: maxOrder + 1,
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
  dateKey: DateKey
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
