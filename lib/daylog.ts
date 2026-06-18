import type { DateKey, DayLog } from "./types";
import { dateToKey, readJSON, writeJSON } from "./persist";

const DAYLOG_KEY = "tenet.daylog.v1";

function isDayLog(value: unknown): value is DayLog {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.date === "string" &&
    typeof d.satisfactionScore === "number" &&
    typeof d.loggedAt === "number"
  );
}

export function loadDayLogs(): DayLog[] {
  const stored = readJSON<unknown[]>(DAYLOG_KEY, []);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isDayLog);
}

export function saveDayLogs(logs: DayLog[]): void {
  writeJSON(DAYLOG_KEY, logs);
}

export function getDayLog(logs: DayLog[], dateKey: DateKey): DayLog | undefined {
  return logs.find((l) => l.date === dateKey);
}

/** Insert or replace the log for a given day (one entry per date). */
export function upsertDayLog(
  logs: DayLog[],
  dateKey: DateKey,
  score: number,
  note?: string
): DayLog[] {
  const entry: DayLog = {
    date: dateKey,
    satisfactionScore: score,
    loggedAt: Date.now(),
  };
  if (note !== undefined && note.trim() !== "") {
    entry.satisfactionNote = note.trim();
  }
  return [...logs.filter((l) => l.date !== dateKey), entry];
}

export interface DayCell {
  key: DateKey;
  score: number | null;
  isToday: boolean;
}

/** The last `n` days (oldest → newest), each with its satisfaction score or null. */
export function recentDayLogs(
  logs: DayLog[],
  n: number,
  today: Date = new Date()
): DayCell[] {
  const byDate = new Map(logs.map((l) => [l.date, l.satisfactionScore]));
  const todayKey = dateToKey(today);
  const out: DayCell[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateToKey(d);
    const score = byDate.get(key);
    out.push({ key, score: score ?? null, isToday: key === todayKey });
  }
  return out;
}
