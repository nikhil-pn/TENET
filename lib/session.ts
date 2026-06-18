// Tracks which task (if any) the current Pomodoro session is focused on, so the
// Clock can credit the completed session back to that task. A single localStorage
// key — the lightweight cross-component channel the app already uses for timer state.

const ACTIVE_KEY = "tenet.session.active.v1";

/** Mark a task as the focus of the current/next Pomodoro session. */
export function setActiveSessionTask(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // storage unavailable (private mode/quota) — ignore
  }
}

export function getActiveSessionTask(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function clearActiveSessionTask(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}
