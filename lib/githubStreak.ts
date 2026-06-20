// GitHub accountability streak. When a focus session completes, append a line
// to a log file in the user's `tenet-log` repo so their public contribution
// graph lights up that day — a real, visible streak.
//
// Honest caveat: a contribution square follows the commit's author-date, which
// can be backdated, so the graph is MOTIVATION, not proof. The tamper-proof
// record is the insert-only pomodoro_sessions ledger (lib/pomodoroLog.ts).
//
// Runs entirely in the browser: api.github.com sends CORS headers, and the
// GitHub OAuth provider_token (captured in lib/cloud/auth.ts) authorizes it —
// no server of ours. Dedupes to ONE commit per active day (one green square).

import type { DateKey } from "./types";
import { dateToKey, readJSON, writeJSON } from "./persist";
import { getGitHubToken } from "./cloud/auth";

const STREAK_KEY = "tenet.cloud.streak.v1";
const DEFAULT_REPO = "tenet-log";
const API = "https://api.github.com";

interface StreakState {
  /** The last local day we successfully committed for (per-day dedupe). */
  lastCommittedDate?: DateKey;
}

function readState(): StreakState {
  return readJSON<StreakState>(STREAK_KEY, {});
}

interface GhUser {
  login: string;
}

async function gh(
  token: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
}

/** UTF-8-safe base64 (GitHub Contents API wants base64-encoded file bytes). */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function ensureRepo(token: string, owner: string, repo: string): Promise<boolean> {
  const head = await gh(token, `/repos/${owner}/${repo}`);
  if (head.ok) return true;
  if (head.status !== 404) return false;
  // Create it, auto-initialised so it has a default branch + a tree to commit on.
  const created = await gh(token, `/user/repos`, {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      private: false,
      auto_init: true,
      description: "TENET focus streak — auto-logged Pomodoro sessions.",
    }),
  });
  return created.ok;
}

interface ContentsGet {
  content?: string;
  sha?: string;
}

/**
 * Append a line to `log/<YYYY>.md` and commit it. Reads the file sha for
 * optimistic concurrency; retries once on a 409 (sha race).
 */
async function appendLine(
  token: string,
  owner: string,
  repo: string,
  line: string,
  year: string
): Promise<boolean> {
  const path = `log/${year}.md`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const getRes = await gh(token, `/repos/${owner}/${repo}/contents/${path}`);
    let sha: string | undefined;
    let existing = "";
    if (getRes.ok) {
      const json = (await getRes.json()) as ContentsGet;
      sha = json.sha;
      if (json.content) existing = fromBase64(json.content);
    } else if (getRes.status !== 404) {
      return false;
    }
    const header = existing ? "" : `# Focus log ${year}\n\n`;
    const next = `${existing}${header}${line}\n`;
    const putRes = await gh(token, `/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: line,
        content: toBase64(next),
        ...(sha ? { sha } : {}),
      }),
    });
    if (putRes.ok) return true;
    if (putRes.status !== 409) return false; // non-race failure
    // 409 ⇒ sha moved under us; loop re-reads and retries once.
  }
  return false;
}

export interface StreakResult {
  committed: boolean;
  /** Why it didn't commit, when committed is false (for UI/debug). */
  reason?: "no-token" | "already-today" | "repo" | "commit-failed" | "no-user";
}

/**
 * Record today's focus on GitHub. Best-effort and idempotent per day.
 * @param summary  short text appended to the log line (e.g. "25m focus").
 * @param repo     target repo name (defaults to "tenet-log").
 */
export async function recordFocusDay(
  summary: string,
  repo: string = DEFAULT_REPO,
  today: Date = new Date()
): Promise<StreakResult> {
  const token = getGitHubToken();
  if (!token) return { committed: false, reason: "no-token" };

  const todayKey = dateToKey(today);
  if (readState().lastCommittedDate === todayKey) {
    return { committed: false, reason: "already-today" };
  }

  const userRes = await gh(token, `/user`);
  if (!userRes.ok) return { committed: false, reason: "no-user" };
  const owner = ((await userRes.json()) as GhUser).login;

  if (!(await ensureRepo(token, owner, repo))) {
    return { committed: false, reason: "repo" };
  }

  const time = today.toTimeString().slice(0, 5); // "HH:MM"
  const line = `- ${todayKey} ${time} — ${summary}`;
  const ok = await appendLine(token, owner, repo, line, String(today.getFullYear()));
  if (!ok) return { committed: false, reason: "commit-failed" };

  writeJSON(STREAK_KEY, { lastCommittedDate: todayKey });
  return { committed: true };
}
