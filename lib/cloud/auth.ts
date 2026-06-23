// Auth helpers over the Supabase client. All functions no-op (or return null)
// when the cloud is not configured, preserving the local-first default.
//
// GitHub provider_token: Supabase surfaces it on the auth event right after the
// OAuth redirect and does NOT persist it across refreshes. We stash it in
// localStorage so the streak-commit (lib/githubStreak.ts) can use it later in
// the session. It's a user-scoped GitHub token — kept only on this device.

import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "../supabase";

const PROVIDER_TOKEN_KEY = "tenet.cloud.githubToken.v1";
const GITHUB_USERNAME_KEY = "tenet.cloud.githubUser.v1";

function redirectTo(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/auth/callback`;
}

/**
 * Begin GitHub OAuth. We request `public_repo` (NOT `repo`) so the token can
 * create and commit to the PUBLIC `tenet-log` streak repo but can NEVER touch
 * the user's private repos, settings, or orgs. (OAuth Apps can't scope to a
 * single repo — `public_repo` is the narrowest the login flow allows; true
 * per-repo access would require a GitHub App or a pasted fine-grained PAT.)
 */
export async function signInWithGitHub(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: redirectTo(),
      scopes: "public_repo read:user user:email",
    },
  });
}

export async function signInWithGoogle(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo() },
  });
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  clearGitHubToken();
  clearGitHubUsername();
  await sb.auth.signOut();
}

export async function getUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

/**
 * Subscribe to auth changes. Captures the GitHub provider_token when present
 * and forwards the user (or null) to the callback. Returns an unsubscribe fn.
 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) {
    cb(null);
    return () => {};
  }
  const { data } = sb.auth.onAuthStateChange((_event, session: Session | null) => {
    if (session?.provider_token) storeGitHubToken(session.provider_token);
    // The GitHub login (e.g. "octocat") rides in user_metadata. supabase-js
    // types that loosely, so read it defensively. The contribution heatmap
    // (lib/github/contributions.ts) uses it to fetch the public commit calendar.
    const meta = session?.user?.user_metadata as
      | Record<string, unknown>
      | undefined;
    const login = meta?.user_name;
    if (typeof login === "string" && login.length > 0) storeGitHubUsername(login);
    cb(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// ── GitHub provider token (device-local) ─────────────────────────────────────

export function storeGitHubToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROVIDER_TOKEN_KEY, token);
  } catch {
    /* storage blocked — the streak just won't fire this session */
  }
}

export function getGitHubToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PROVIDER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearGitHubToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PROVIDER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ── GitHub username (device-local) ───────────────────────────────────────────
// The login captured from the OAuth session, kept on this device so the
// (tokenless) contribution heatmap can fetch the public commit calendar.

export function storeGitHubUsername(login: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GITHUB_USERNAME_KEY, login);
  } catch {
    /* storage blocked — the heatmap just won't show this session */
  }
}

export function getGitHubUsername(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(GITHUB_USERNAME_KEY);
  } catch {
    return null;
  }
}

export function clearGitHubUsername(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GITHUB_USERNAME_KEY);
  } catch {
    /* ignore */
  }
}
