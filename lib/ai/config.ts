// The opt-in gate for the in-app AI layer — the `lib/supabase.ts` analogue.
//
// In-app AI is OFF by default. The DEFAULT transport is "proxy": a managed
// Supabase Edge Function ("coach") that holds the app owner's single OpenRouter
// key server-side, so end users get AI free without ever pasting a key — they
// just need to be signed in. A "byok" mode (user pastes their own key) is kept
// for flexibility but is not surfaced in the default UI.
//
// When AI is disabled or its transport is unavailable, getAiConfig()-gated
// callers no-op, so the app behaves exactly like the pure-local PWA — zero AI
// network. Config (and any byok key) lives in localStorage via the persist seam,
// NEVER as a `NEXT_PUBLIC_*` env var.

import { readJSON, writeJSON } from "../persist";
import { cloudEnabled } from "../supabase";

const AI_CONFIG_KEY = "tenet.ai.config.v1";

/** Default model when running in byok mode (proxy mode pins the model server-side). */
export const DEFAULT_AI_MODEL = "deepseek/deepseek-chat";

/**
 * Transport for model calls.
 * - "proxy": call the managed Supabase Edge Function (owner's key, signed-in users, free).
 * - "byok": call OpenRouter directly with the user's own key (no UI by default).
 */
export type AiMode = "proxy" | "byok";

export interface AiConfig {
  /** Master switch. false ⇒ the whole AI layer is inert (no network). */
  enabled: boolean;
  /** Delivery transport. Defaults to the managed proxy. */
  mode: AiMode;
  /** The user's own OpenRouter API key — byok mode only. */
  openRouterKey?: string;
  /** Model id — byok mode only (proxy pins it server-side). */
  model: string;
  /** Per-feature toggle for the weekly Coach. */
  coachEnabled: boolean;
  /**
   * Whether free-text satisfaction notes may be included in the coach digest.
   * Off by default — the most sensitive data stays on-device unless opted in.
   */
  includeNotes: boolean;
}

/** A fresh, untouched config — everything off but the defaults. */
export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  mode: "proxy",
  model: DEFAULT_AI_MODEL,
  coachEnabled: true,
  includeNotes: false,
};

/** The stored AI config, or null when AI has never been configured. */
export function getAiConfig(): AiConfig | null {
  const stored = readJSON<Partial<AiConfig> | null>(AI_CONFIG_KEY, null);
  if (!stored || typeof stored !== "object") return null;
  // Merge over defaults so older/partial stored configs stay back-compatible.
  return { ...DEFAULT_AI_CONFIG, ...stored };
}

export function saveAiConfig(config: AiConfig): void {
  writeJSON(AI_CONFIG_KEY, config);
}

/** Whether the config's transport can reach a model at all (ignores the master switch). */
function transportReady(c: AiConfig): boolean {
  // proxy ⇒ Supabase must be configured (the Edge Function lives there). The
  // signed-in requirement is enforced by the function itself at call time.
  // byok ⇒ a user key must be present.
  return c.mode === "proxy" ? cloudEnabled : Boolean(c.openRouterKey);
}

/**
 * True when the AI layer is enabled by the user AND its transport is available.
 * The single gate every `lib/ai/` entry point checks. When false, callers MUST
 * fall back to deterministic logic and make ZERO model calls.
 */
export function aiEnabled(): boolean {
  const c = getAiConfig();
  return Boolean(c?.enabled) && c !== null && transportReady(c);
}

/** True when the Coach feature specifically is enabled and usable. */
export function coachEnabled(): boolean {
  const c = getAiConfig();
  return aiEnabled() && Boolean(c?.coachEnabled);
}

/** The active transport mode (for callers that branch on proxy vs byok). */
export function aiMode(): AiMode {
  return getAiConfig()?.mode ?? DEFAULT_AI_CONFIG.mode;
}
