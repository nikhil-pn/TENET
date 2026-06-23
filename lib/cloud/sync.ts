// Local-first cloud sync. The app always reads/writes localStorage instantly
// (offline-safe); this layer mirrors those changes to Supabase in the
// background and merges remote changes in on login.
//
// Merge model — per-record last-write-wins, single user across their devices:
//  * Each synced record carries `updatedAt` (epoch ms), stamped by the PUSH
//    path when it detects a content change (domain code stays oblivious).
//  * A per-table "snapshot" (the content of every record as this device last
//    saw it on the server) is kept in localStorage. PUSH diffs current state
//    against the snapshot to find changes/creates/deletes. PULL uses the
//    snapshot to tell a remote deletion (was in snapshot, now gone from remote
//    ⇒ drop locally) from a local create (never in snapshot ⇒ keep & push up).
//
// Known v1 limitations (documented, acceptable for one user): no realtime push
// between devices (sync is on login + on local change); and a record edited
// offline on two devices at once resolves by whichever syncs later. The
// immutable pomodoro_sessions ledger is handled separately (lib/pomodoroLog.ts)
// and never flows through this merge.

import type { DateKey, DayLog, Habit, Note, Timestamp, Todo } from "../types";
import { readJSON, subscribeWrites, writeJSON } from "../persist";
import { getSupabase } from "../supabase";

const TODOS_KEY = "tenet.todos.v1";
const HABITS_KEY = "tenet.habits.v1";
const DAYLOG_KEY = "tenet.daylog.v1";
const NOTES_KEY = "tenet.notes.v1";

type Row = Record<string, unknown>;
interface Syncable {
  id?: string;
  date?: DateKey;
  updatedAt?: Timestamp;
}

/** Per-table adapter: how a local record maps to/from a Supabase row. */
interface TableSpec {
  table: string;
  /** Record identity within a user (the upsert/delete key, besides user_id). */
  idField: "id" | "date";
  /** PK columns for the upsert onConflict clause. */
  conflict: string;
  toRow: (rec: Syncable, userId: string) => Row;
  fromRow: (row: Row) => Syncable;
}

// timestamptz → epoch ms (0 when absent, so it loses every comparison).
const tsMs = (v: unknown): number => (typeof v === "string" ? Date.parse(v) : 0);
const num = (v: unknown): number | undefined =>
  typeof v === "number" ? v : undefined;
const bool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

const SPECS: Record<string, TableSpec> = {
  [TODOS_KEY]: {
    table: "todos",
    idField: "id",
    conflict: "user_id,id",
    toRow: (r, userId) => {
      const t = r as Todo;
      return {
        user_id: userId,
        id: t.id,
        title: t.title,
        done: t.done,
        created_at: t.createdAt,
        completed_at: t.completedAt ?? null,
        order_pos: t.order,
        date: t.date ?? null,
        due_at: t.dueAt ?? null,
        deadline: t.deadline ?? null,
        important: t.important ?? null,
        urgent: t.urgent ?? null,
        estimated_minutes: t.estimatedMinutes ?? null,
        delegated: t.delegated ?? null,
        dropped: t.dropped ?? null,
        pomodoro_count: t.pomodoroCount ?? null,
        actual_minutes: t.actualMinutes ?? null,
      };
    },
    fromRow: (row): Todo => {
      const t: Todo = {
        id: String(row.id),
        title: String(row.title ?? ""),
        done: Boolean(row.done),
        createdAt: num(row.created_at) ?? 0,
        order: num(row.order_pos) ?? 0,
      };
      const completedAt = num(row.completed_at);
      if (completedAt !== undefined) t.completedAt = completedAt;
      const date = str(row.date);
      if (date !== undefined) t.date = date;
      const dueAt = num(row.due_at);
      if (dueAt !== undefined) t.dueAt = dueAt;
      const deadline = str(row.deadline);
      if (deadline !== undefined) t.deadline = deadline;
      const important = bool(row.important);
      if (important !== undefined) t.important = important;
      const urgent = bool(row.urgent);
      if (urgent !== undefined) t.urgent = urgent;
      const est = num(row.estimated_minutes);
      if (est !== undefined) t.estimatedMinutes = est;
      const delegated = bool(row.delegated);
      if (delegated !== undefined) t.delegated = delegated;
      const dropped = bool(row.dropped);
      if (dropped !== undefined) t.dropped = dropped;
      const pc = num(row.pomodoro_count);
      if (pc !== undefined) t.pomodoroCount = pc;
      const am = num(row.actual_minutes);
      if (am !== undefined) t.actualMinutes = am;
      t.updatedAt = tsMs(row.updated_at);
      return t;
    },
  },

  [HABITS_KEY]: {
    table: "habits",
    idField: "id",
    conflict: "user_id,id",
    toRow: (r, userId) => {
      const h = r as Habit;
      return {
        user_id: userId,
        id: h.id,
        name: h.name,
        emoji: h.emoji ?? null,
        created_at: h.createdAt,
        order_pos: h.order,
        checkins: h.checkins ?? {},
        target_per_day: h.targetPerDay ?? null,
        archived: h.archived ?? null,
      };
    },
    fromRow: (row): Habit => {
      const h: Habit = {
        id: String(row.id),
        name: String(row.name ?? ""),
        createdAt: num(row.created_at) ?? 0,
        order: num(row.order_pos) ?? 0,
        checkins:
          row.checkins && typeof row.checkins === "object"
            ? (row.checkins as Record<DateKey, number>)
            : {},
      };
      const emoji = str(row.emoji);
      if (emoji !== undefined) h.emoji = emoji;
      const tpd = num(row.target_per_day);
      if (tpd !== undefined) h.targetPerDay = tpd;
      const archived = bool(row.archived);
      if (archived !== undefined) h.archived = archived;
      h.updatedAt = tsMs(row.updated_at);
      return h;
    },
  },

  [DAYLOG_KEY]: {
    table: "day_logs",
    idField: "date",
    conflict: "user_id,date",
    toRow: (r, userId) => {
      const d = r as DayLog;
      return {
        user_id: userId,
        date: d.date,
        satisfaction_score: d.satisfactionScore,
        satisfaction_note: d.satisfactionNote ?? null,
        logged_at: d.loggedAt,
      };
    },
    fromRow: (row): DayLog => {
      const d: DayLog = {
        date: String(row.date),
        satisfactionScore: num(row.satisfaction_score) ?? 0,
        loggedAt: num(row.logged_at) ?? 0,
      };
      const note = str(row.satisfaction_note);
      if (note !== undefined) d.satisfactionNote = note;
      d.updatedAt = tsMs(row.updated_at);
      return d;
    },
  },

  [NOTES_KEY]: {
    table: "notes",
    idField: "id",
    conflict: "user_id,id",
    toRow: (r, userId) => {
      const n = r as Note;
      return {
        user_id: userId,
        id: n.id,
        kind: n.kind,
        date: n.date ?? null,
        title: n.title,
        body: n.body,
        created_at: n.createdAt,
      };
    },
    fromRow: (row): Note => {
      const kind = str(row.kind);
      const n: Note = {
        id: String(row.id),
        kind:
          kind === "daily" || kind === "monthly" || kind === "event"
            ? kind
            : "custom",
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        createdAt: num(row.created_at) ?? 0,
      };
      const date = str(row.date);
      if (date !== undefined) n.date = date;
      n.updatedAt = tsMs(row.updated_at);
      return n;
    },
  },
};

// ── Snapshot: last-known-server content of each record, per table ────────────
// Stored as { recordId: contentHash } where the hash omits updatedAt so a pure
// timestamp bump never reads as a content change.

const snapKey = (key: string) => `tenet.cloud.snap.${SPECS[key].table}.v1`;

function idOf(spec: TableSpec, rec: Syncable): string {
  return String(spec.idField === "date" ? rec.date : rec.id);
}

function contentHash(rec: Syncable): string {
  const clone: Record<string, unknown> = { ...rec };
  delete clone.updatedAt;
  return JSON.stringify(clone);
}

function readSnap(key: string): Record<string, string> {
  return readJSON<Record<string, string>>(snapKey(key), {});
}

// ── Internal-write guard: our own writebacks must not re-trigger a push ──────
let internalWrite = false;
function writeLocal<T>(key: string, value: T): void {
  internalWrite = true;
  try {
    writeJSON(key, value);
  } finally {
    internalWrite = false;
  }
}

// ── State ────────────────────────────────────────────────────────────────────
let currentUserId: string | null = null;
let unsubscribeWrites: (() => void) | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 1500;

// ── PUSH ──────────────────────────────────────────────────────────────────────
async function pushKey(key: string): Promise<void> {
  const sb = getSupabase();
  const spec = SPECS[key];
  if (!sb || !spec || !currentUserId) return;

  const current = readJSON<Syncable[]>(key, []);
  const snap = readSnap(key);
  const now = Date.now();

  // Start from the last-known snapshot and advance it PER successful operation
  // below. Upsert and delete are issued (and caught) independently so one bad
  // record — e.g. a row the server's CHECK constraint rejects — can no longer
  // strand an unrelated delete in the same batch. Each kind of change retries
  // on the next push until it lands.
  const nextSnap: Record<string, string> = { ...snap };

  const changed: Syncable[] = [];
  let stampedLocally = false;

  for (const rec of current) {
    const id = idOf(spec, rec);
    const hash = contentHash(rec);
    if (snap[id] !== hash) {
      // Content changed (or brand new) → stamp updatedAt and push it up.
      rec.updatedAt = now;
      stampedLocally = true;
      changed.push(rec);
    } else {
      // Unchanged: the snapshot already reflects it.
      nextSnap[id] = hash;
    }
  }

  const currentIds = new Set(current.map((r) => idOf(spec, r)));
  const deletedIds = Object.keys(snap).filter((id) => !currentIds.has(id));

  if (changed.length > 0) {
    try {
      const rows = changed.map((r) => spec.toRow(r, currentUserId as string));
      const { error } = await sb.from(spec.table).upsert(rows, {
        onConflict: spec.conflict,
      });
      if (error) throw error;
      // Landed → advance the snapshot for exactly these records and persist the
      // stamped updatedAt locally (silently).
      for (const r of changed) nextSnap[idOf(spec, r)] = contentHash(r);
      if (stampedLocally) writeLocal(key, current);
    } catch {
      // Leave these ids' old snapshot entries untouched so they retry next push.
    }
  }

  if (deletedIds.length > 0) {
    const col = spec.idField === "date" ? "date" : "id";
    try {
      const { error } = await sb
        .from(spec.table)
        .delete()
        .eq("user_id", currentUserId)
        .in(col, deletedIds);
      if (error) throw error;
      // Gone from the server → drop them from the snapshot.
      for (const id of deletedIds) delete nextSnap[id];
    } catch {
      // Keep them in the snapshot so the delete retries on the next push.
    }
  }

  writeLocal(snapKey(key), nextSnap);
}

function schedulePush(key: string): void {
  const existing = pushTimers.get(key);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    key,
    setTimeout(() => {
      pushTimers.delete(key);
      void pushKey(key);
    }, PUSH_DEBOUNCE_MS)
  );
}

// ── PULL + MERGE ────────────────────────────────────────────────────────────
async function pullKey(key: string): Promise<void> {
  const sb = getSupabase();
  const spec = SPECS[key];
  if (!sb || !spec || !currentUserId) return;

  const { data, error } = await sb
    .from(spec.table)
    .select("*")
    .eq("user_id", currentUserId);
  if (error) return; // offline / transient — keep local as-is

  const remote = (data ?? []).map((row) => spec.fromRow(row as Row));
  const remoteById = new Map(remote.map((r) => [idOf(spec, r), r] as const));
  const local = readJSON<Syncable[]>(key, []);
  const prevSnap = readSnap(key);

  const merged: Syncable[] = [];
  const seen = new Set<string>();

  for (const rec of local) {
    const id = idOf(spec, rec);
    seen.add(id);
    const r = remoteById.get(id);
    if (r) {
      // In both: newest updatedAt wins (ties favour remote for determinism).
      merged.push((r.updatedAt ?? 0) >= (rec.updatedAt ?? 0) ? r : rec);
    } else if (prevSnap[id] !== undefined) {
      // Was on the server before, now gone ⇒ deleted on another device ⇒ drop.
    } else {
      // Never synced ⇒ a genuine local-only record ⇒ keep (push will upload it).
      merged.push(rec);
    }
  }
  for (const r of remote) {
    if (!seen.has(idOf(spec, r))) merged.push(r); // remote-only ⇒ adopt
  }

  // Write the merged result locally, then set the snapshot to REMOTE content so
  // the follow-up push uploads exactly the local-only / local-newer records.
  writeLocal(key, merged);
  const remoteSnap: Record<string, string> = {};
  for (const r of remote) remoteSnap[idOf(spec, r)] = contentHash(r);
  writeLocal(snapKey(key), remoteSnap);

  await pushKey(key);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Begin syncing for a signed-in user: pull everything, then watch for writes. */
export async function startSync(userId: string): Promise<void> {
  if (!getSupabase()) return;
  currentUserId = userId;

  if (!unsubscribeWrites) {
    unsubscribeWrites = subscribeWrites((key) => {
      if (internalWrite) return;
      if (SPECS[key]) schedulePush(key);
    });
  }

  for (const key of Object.keys(SPECS)) {
    // Sequential keeps the request burst gentle; each is independent.
    await pullKey(key);
  }
}

/** Stop syncing (sign-out). Local data stays; snapshots are cleared. */
export function stopSync(): void {
  if (unsubscribeWrites) {
    unsubscribeWrites();
    unsubscribeWrites = null;
  }
  for (const timer of pushTimers.values()) clearTimeout(timer);
  pushTimers.clear();
  for (const key of Object.keys(SPECS)) writeLocal(snapKey(key), {});
  currentUserId = null;
}
