// The Pomodoro accountability ledger — every completed focus session, recorded
// once and never edited. Two tiers:
//   * Local (always): an append-only array in localStorage so the in-app
//     history/heatmap works offline and before login.
//   * Cloud (when signed in): an INSERT into pomodoro_sessions, which RLS makes
//     truly immutable (no UPDATE/DELETE policy). That is the tamper-proof record.
//
// Framework-agnostic. The cloud insert is best-effort/fire-and-forget — a
// failed network call never loses the local record.

import type { DateKey, PomodoroSession, Timestamp } from "./types";
import { createId, dateToKey, readJSON, writeJSON } from "./persist";
import { getSupabase } from "./supabase";

const SESSIONS_KEY = "tenet.pomodoro.sessions.v1";

export function loadSessions(): PomodoroSession[] {
  return readJSON<PomodoroSession[]>(SESSIONS_KEY, []);
}

export interface SessionInit {
  durationMinutes: number;
  taskId?: string;
  /** Defaults to now / now − duration. */
  endedAt?: Timestamp;
}

/**
 * Record one completed session: append locally, then insert to the immutable
 * cloud ledger if signed in. Returns the created record.
 */
export function logSession(init: SessionInit): PomodoroSession {
  const endedAt = init.endedAt ?? Date.now();
  const session: PomodoroSession = {
    id: createId(),
    startedAt: endedAt - init.durationMinutes * 60_000,
    endedAt,
    durationMinutes: init.durationMinutes,
    date: dateToKey(new Date(endedAt)),
  };
  if (init.taskId) session.taskId = init.taskId;

  writeJSON(SESSIONS_KEY, [...loadSessions(), session]);
  void insertRemote(session);
  return session;
}

async function insertRemote(session: PomodoroSession): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  await sb.from("pomodoro_sessions").insert({
    user_id: userId,
    task_id: session.taskId ?? null,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    duration_minutes: session.durationMinutes,
    date: session.date,
  });
  // No error handling beyond this: the local record already stands, and the
  // insert is the immutable one — there is nothing to reconcile or retry-merge.
}

/** Most recent sessions, newest first. */
export function recentSessions(limit = 50): PomodoroSession[] {
  return [...loadSessions()].sort((a, b) => b.endedAt - a.endedAt).slice(0, limit);
}

/** Total focus minutes per local day — feeds an in-app streak heatmap. */
export function minutesByDate(sessions: PomodoroSession[] = loadSessions()): Record<DateKey, number> {
  return sessions.reduce<Record<DateKey, number>>((acc, s) => {
    acc[s.date] = (acc[s.date] ?? 0) + s.durationMinutes;
    return acc;
  }, {});
}

/** Consecutive days with at least one session, counting back from today. */
export function focusStreak(today: Date = new Date()): number {
  const byDate = minutesByDate();
  let streak = 0;
  const cursor = new Date(today);
  while ((byDate[dateToKey(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
