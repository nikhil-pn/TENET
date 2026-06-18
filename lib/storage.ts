import type { DateKey, Todo } from "./types";

/** localStorage key for the to-do list. Versioned so the shape can evolve safely. */
const TODOS_KEY = "tenet.todos.v1";

// ── Persistence seam ─────────────────────────────────────────────────────────
// These two functions are the ONLY code that knows WHERE bytes live. For the web
// app that's localStorage; a future Electron edition swaps just these for the
// filesystem/IPC, leaving the domain ops and UI untouched.

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt JSON or storage unavailable (e.g. private mode) — fall back safely.
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked — drop silently so the UI never crashes.
  }
}

// ── Portable utilities ───────────────────────────────────────────────────────

/** Format a date as a local "YYYY-MM-DD" key (matches the inline pattern in Clock). */
export function dateToKey(d: Date = new Date()): DateKey {
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Generate a stable unique id. Uses crypto.randomUUID when available. */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for any context lacking crypto.randomUUID. Unique enough for a
  // single user entering tasks by hand.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
