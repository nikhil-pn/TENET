// The single LLM client seam — the `lib/persist.ts` analogue for model calls.
//
// EVERY model request in the app goes through `chat()`; no component or domain
// module talks to a provider directly (mirroring how nothing outside lib/cloud
// touches Supabase). Provider/host choice lives here ONLY, so swapping OpenRouter
// for a Supabase Edge Function proxy or an on-device model later is a change to
// this one file.
//
// Phase 1 transport: BYOK → OpenRouter, called client-side. OpenRouter supports
// browser CORS (which is what keeps the app a pure static export with no server),
// is OpenAI-compatible, and logs nothing by default. `zdr: true` forces
// zero-data-retention routing so personal data is never retained or trained on —
// the privacy reason we route DeepSeek-the-model through OpenRouter rather than
// calling `api.deepseek.com` (China storage, trains on inputs, no browser CORS).

import { getAiConfig } from "./config";
import { getSupabase } from "../supabase";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** A named JSON Schema the model must satisfy (strict structured output). */
export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatOptions {
  schema?: JsonSchemaSpec;
  /** Abort signal so callers can cancel or time out the request. */
  signal?: AbortSignal;
  /** Sampling temperature. Low by default for stable, grounded output. */
  temperature?: number;
}

/**
 * Send a chat completion and return the parsed JSON content as `T`, or `null` on
 * ANY failure (AI disabled, no key, network error, non-OK status, or an
 * unparseable body). Callers MUST treat `null` as "fall back to deterministic
 * logic" — the AI layer is always strictly additive and never blocks the app.
 */
export async function chat<T>(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<T | null> {
  const config = getAiConfig();
  if (!config?.enabled || !config.openRouterKey) return null;

  // `unknown`-valued bag: OpenRouter's request body mixes strings, numbers, and
  // nested objects, so a precise literal type here would add no real safety.
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: options.temperature ?? 0.4,
    // Force zero-data-retention routing (privacy: no retention, no training).
    zdr: true,
  };
  if (options.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: options.schema.name, strict: true, schema: options.schema.schema },
    };
  }

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterKey}`,
        "Content-Type": "application/json",
        // OpenRouter attribution headers (optional, recommended).
        "HTTP-Referer": "https://tenet.app",
        "X-Title": "TENET",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch {
    // Network error, abort, or invalid JSON — degrade to the deterministic path.
    return null;
  }
}

/**
 * Proxy transport: invoke a Supabase Edge Function that holds the owner's key
 * server-side. supabase-js auto-attaches the signed-in user's token; the
 * function rejects non-authenticated callers. Returns the function's JSON body as
 * `T`, or `null` on any failure (not signed in, function error, network) so
 * callers fall back to deterministic logic.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>
): Promise<T | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.functions.invoke(name, { body });
    if (error || data == null) return null;
    return data as T;
  } catch {
    return null;
  }
}
