// Notes & reminders — pure CRUD over Note[]. Three kinds today (a day reminder,
// a monthly reminder, and freeform custom notes); `kind` is a plain string so
// new kinds need no migration. Persisted behind the storage seam and synced by
// the cloud layer like todos/habits.

import type { DateKey, Note } from "./types";
import { createId, readJSON, writeJSON } from "./persist";

const NOTES_KEY = "tenet.notes.v1";

function isNote(value: unknown): value is Note {
  if (typeof value !== "object" || value === null) return false;
  const n = value as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    (n.kind === "daily" ||
      n.kind === "monthly" ||
      n.kind === "custom" ||
      n.kind === "event") &&
    typeof n.title === "string" &&
    typeof n.body === "string" &&
    typeof n.createdAt === "number"
  );
}

export function loadNotes(): Note[] {
  const stored = readJSON<unknown[]>(NOTES_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isNote);
}

export function saveNotes(notes: Note[]): void {
  writeJSON(NOTES_KEY, notes);
}

export interface NoteInit {
  kind: Note["kind"];
  title?: string;
  body?: string;
  /** Day "YYYY-MM-DD" for daily, month "YYYY-MM" for monthly. */
  date?: DateKey;
}

export function addNote(notes: Note[], init: NoteInit): Note[] {
  const note: Note = {
    id: createId(),
    kind: init.kind,
    title: init.title?.trim() ?? "",
    body: init.body?.trim() ?? "",
    createdAt: Date.now(),
  };
  if (init.date !== undefined) note.date = init.date;
  return [...notes, note];
}

export function updateNote(
  notes: Note[],
  id: string,
  patch: Partial<Pick<Note, "title" | "body" | "date">>
): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
}

export function deleteNote(notes: Note[], id: string): Note[] {
  return notes.filter((n) => n.id !== id);
}

/** Custom notes, newest first. */
export function customNotes(notes: Note[]): Note[] {
  return notes
    .filter((n) => n.kind === "custom")
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** The reminder for a specific day, if any. */
export function dailyNote(notes: Note[], date: DateKey): Note | undefined {
  return notes.find((n) => n.kind === "daily" && n.date === date);
}

/** Calendar events pinned to a day "YYYY-MM-DD", oldest first. */
export function eventsForDate(notes: Note[], date: DateKey): Note[] {
  return notes
    .filter((n) => n.kind === "event" && n.date === date)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** All calendar events grouped by their day key, each list oldest first. */
export function eventsByDate(notes: Note[]): Record<DateKey, Note[]> {
  const map: Record<DateKey, Note[]> = {};
  for (const n of notes) {
    if (n.kind === "event" && n.date) (map[n.date] ??= []).push(n);
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => a.createdAt - b.createdAt);
  }
  return map;
}

/** The reminder for a specific month ("YYYY-MM"), if any. */
export function monthlyNote(notes: Note[], month: string): Note | undefined {
  return notes.find((n) => n.kind === "monthly" && n.date === month);
}

/** "YYYY-MM" key for a date — the identity used by monthly reminders. */
export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}
