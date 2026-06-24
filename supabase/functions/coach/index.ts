// Supabase Edge Function: "coach" — the managed-key LLM proxy for TENET's Coach.
//
// Why this exists: end users should NOT need their own API key. The app owner
// holds ONE OpenRouter key as a Supabase secret (OPENROUTER_API_KEY); this
// function uses it on the user's behalf so the AI Coach is free for them. Runs on
// Supabase's managed infra, so the app stays a static export ("no server of ours"
// in spirit, same as the database).
//
// Cost/abuse protection:
//   - Requires a REAL signed-in user (a bare anon key is rejected) — only real
//     accounts can spend the owner's credits.
//   - The PROMPT + MODEL are fixed here, server-side, so a client can never
//     request an arbitrary/expensive completion.
//   - The incoming digest is size-capped and max_tokens is bounded.
//   - Pair this with a spend limit set on the OpenRouter key itself.
//
// Deploy: see supabase/functions/coach/README.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = Deno.env.get("COACH_MODEL") ?? "deepseek/deepseek-chat";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

/** Reject oversized digests (the digest is normally a few hundred bytes). */
const MAX_DIGEST_BYTES = 8_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Kept in sync with lib/ai/prompts.ts (different runtime, so it can't be imported).
const COACH_SYSTEM_PROMPT = `You are a warm, concise productivity coach inside TENET, a local-first app that uses the Eisenhower/Warikoo method:
- Q1 Important+Urgent = do now
- Q2 Important+Not-Urgent = schedule (the sweet spot)
- Q3 Urgent+Not-Important = delegate
- Q4 Neither = drop/minimize

You are given ONLY pre-computed numbers about ONE user's recent weeks, inside <digest> tags. Write a short weekly review.

RULES:
1. Use ONLY the numbers in the digest. NEVER invent tasks, counts, dates, streaks, or trends. If a field is null or absent, do not mention it.
2. Tone: encouraging, specific, non-judgmental, autonomy-supportive (motivational interviewing). Lead with a genuine win. Frame gaps as observations the user can choose to act on — never as failure. Banned words: "failed", "should", "lazy", "behind", "guilt". No streak-loss or red-alert framing.
3. The reference mix (Q1 23, Q2 52, Q3 12, Q4 13; ~75% important) is a REFERENCE, not a target. Describe the gap; never score, grade, or pass/fail the user.
4. At most 3 focus areas. Each needs a concrete, doable oneAction. Where a scheduled task slipped, phrase the action as an if-then implementation intention, e.g. "When it's 9am Wednesday at your desk, start <task> for one 25-minute block."
5. Name exactly ONE keystoneChange — the single highest-leverage shift.
6. No medical, financial, legal, or mental-health advice.
7. Output ONLY valid JSON matching the schema. No markdown, no prose outside the JSON.`;

const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    wins: { type: "array", items: { type: "string" } },
    focusAreas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          observation: { type: "string" },
          why: { type: "string" },
          oneAction: { type: "string" },
        },
        required: ["observation", "why", "oneAction"],
      },
    },
    keystoneChange: { type: "string" },
  },
  required: ["headline", "wins", "focusAreas", "keystoneChange"],
};

function buildUserMessage(digestStr: string, windowDays: number): string {
  return [
    `Here is the user's pre-computed productivity digest for the last ${windowDays} days.`,
    "Use ONLY these numbers. Write the review as JSON matching the schema.",
    "",
    "<digest>",
    digestStr,
    "</digest>",
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!OPENROUTER_API_KEY) return json({ error: "not_configured" }, 503);

  // Require a real authenticated user — a valid anon JWT alone is not enough.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: { digest?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const digest = payload?.digest;
  if (!digest || typeof digest !== "object") return json({ error: "bad_request" }, 400);

  const digestStr = JSON.stringify(digest);
  if (digestStr.length > MAX_DIGEST_BYTES) return json({ error: "payload_too_large" }, 413);
  const wd = (digest as Record<string, unknown>).windowDays;
  const windowDays = typeof wd === "number" ? wd : 14;

  let orRes: Response;
  try {
    orRes = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://tenet.app",
        "X-Title": "TENET",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.5,
        max_tokens: 700,
        zdr: true,
        messages: [
          { role: "system", content: COACH_SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(digestStr, windowDays) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "coach_review", strict: true, schema: COACH_SCHEMA },
        },
      }),
    });
  } catch {
    return json({ error: "provider_unreachable" }, 502);
  }
  if (!orRes.ok) return json({ error: "provider_error", status: orRes.status }, 502);

  const data = await orRes.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return json({ error: "empty_response" }, 502);

  let review: unknown;
  try {
    review = JSON.parse(content);
  } catch {
    return json({ error: "parse_error" }, 502);
  }
  // Return the review object directly — the client validates the shape.
  return json(review);
});
