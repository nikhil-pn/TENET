// The opt-in gate for the in-app AI layer — the `lib/supabase.ts` analogue.
//
// In-app AI is OFF by default. Mirroring the cloud layer's local-first contract,
// nothing here calls a model until the user explicitly enables AI and supplies
// their OWN provider key (BYOK). When disabled or unconfigured, `getAiConfig()`
// returns null and every `lib/ai/` caller no-ops, so the app behaves exactly
// like the pure-local PWA — zero network. The key lives in localStorage via the
// persist seam, NEVER as a `NEXT_PUBLIC_*` env var (those bake into the static
// export bundle and would leak to every browser).

import { readJSON, writeJSON } from "../persist";

const AI_CONFIG_KEY = "tenet.ai.config.v1";

/** Default OpenRouter model — DeepSeek-the-model, routed for privacy (see provider). */
export const DEFAULT_AI_MODEL = "deepseek/deepseek-chat";

/** How model calls are delivered. Phase 1 ships BYOK; proxy/local are reserved. */
export type AiMode = "byok";

export interface AiConfig {
  /** Master switch. false ⇒ the whole AI layer is inert (no network). */
  enabled: boolean;
  /** Delivery transport. Phase 1 supports BYOK only. */
  mode: AiMode;
  /** The user's own OpenRouter API key (BYOK). Stored locally; never bundled. */
  openRouterKey?: string;
  /** Model id passed to OpenRouter. Defaults to {@link DEFAULT_AI_MODEL}. */
  model: string;
  /** Per-feature toggle for the weekly Coach. */
  coachEnabled: boolean;
  /**
   * Whether free-text satisfaction notes may be included in the coach digest.
   * Off by default — the most sensitive data stays on-device unless opted in.
   */
  includeNotes: boolean;
}

/** The shape a fresh, untouched config takes — everything off but the defaults. */
export const DEFAULT_AI_CONFIG: AiConfig = {
  enabled: false,
  mode: "byok",
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

/**
 * True when the AI layer is fully usable: enabled by the user AND a BYOK key is
 * present. The single gate every `lib/ai/` entry point checks — the
 * `cloudEnabled` analogue. When false, callers MUST fall back to deterministic
 * logic and make ZERO network calls.
 */
export function aiEnabled(): boolean {
  const c = getAiConfig();
  return Boolean(c?.enabled && c.mode === "byok" && c.openRouterKey);
}

/** True when the Coach feature specifically is enabled and usable. */
export function coachEnabled(): boolean {
  const c = getAiConfig();
  return aiEnabled() && Boolean(c?.coachEnabled);
}
