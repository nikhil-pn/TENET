import type { DateKey } from "./types";

// ── Persistence seam ─────────────────────────────────────────────────────────
// The ONLY code that knows WHERE bytes live. The web app uses localStorage; a
// future Electron edition swaps just these two functions for the filesystem/IPC,
// leaving every domain module (storage.ts, habits.ts, …) and the UI untouched.

export function readJSON<T>(key: string, fallback: T): T {
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

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked — drop silently so the UI never crashes.
  }
  notifyWrite(key, value);
}

// ── Write-through subscription (the cloud-sync hook) ─────────────────────────
// The cloud layer subscribes here to push local changes up. This keeps ALL
// persistence flowing through this one seam — domain modules and the UI never
// know the cloud exists. No subscriber ⇒ pure local-first behaviour.

type WriteListener = (key: string, value: unknown) => void;
const writeListeners = new Set<WriteListener>();

/** Subscribe to every writeJSON. Returns an unsubscribe function. */
export function subscribeWrites(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

function notifyWrite(key: string, value: unknown): void {
  for (const listener of writeListeners) {
    try {
      listener(key, value);
    } catch {
      // A misbehaving listener must never break a local save.
    }
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
  // single user entering data by hand.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
