// The Coach review builder. Orchestrates: build the local digest → (if AI is on
// and there's enough data) have the model NARRATE it → otherwise fall back to a
// deterministic templated review built from the same numbers. The result is
// cached (per ISO week) so opening the panel doesn't re-call the model.
//
// Compute-first / narrate-second: every number originates in snapshot.ts; the
// model never invents data, and the templated path proves the feature is useful
// with no provider at all.

import { readJSON, writeJSON } from "../persist";
import {
  type Quadrant,
  QUADRANT_META,
  REFERENCE_IMPORTANT_SHARE,
} from "../prioritization";
import { aiMode, coachEnabled } from "./config";
import { chat, invokeFunction } from "./provider";
import { COACH_SCHEMA, COACH_SYSTEM_PROMPT, buildCoachUserMessage } from "./prompts";
import { type CoachDigest, buildCoachDigest, dataSufficiency } from "./snapshot";

const REVIEW_KEY = "tenet.coach.review.v1";

export interface CoachReview {
  headline: string;
  wins: string[];
  focusAreas: { observation: string; why: string; oneAction: string }[];
  keystoneChange: string;
}

export type ReviewSource = "ai" | "fallback";

export interface CoachResult {
  review: CoachReview;
  source: ReviewSource;
  generatedAt: number;
}

interface CachedReview extends CoachResult {
  weekKey: string;
}

// ── ISO week key ("YYYY-Www") — the regeneration cadence ───────────────────────

function isoWeekKey(d: Date): string {
  // Copy to a UTC-normalized date at the ISO week's Thursday.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── Validation of model output (defensive — schema should already enforce it) ──

function isCoachReview(v: unknown): v is CoachReview {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.headline === "string" &&
    Array.isArray(r.wins) &&
    r.wins.every((w) => typeof w === "string") &&
    Array.isArray(r.focusAreas) &&
    r.focusAreas.every(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof (f as Record<string, unknown>).observation === "string" &&
        typeof (f as Record<string, unknown>).why === "string" &&
        typeof (f as Record<string, unknown>).oneAction === "string"
    ) &&
    typeof r.keystoneChange === "string"
  );
}

// ── Deterministic templated fallback (no LLM) ──────────────────────────────────

function qName(q: Quadrant): string {
  return QUADRANT_META[q].name;
}

/**
 * Build a review from the digest numbers alone. Mirrors the AI tone (win-led,
 * no guilt) so the feature degrades gracefully when AI is off or unreachable.
 */
export function buildTemplatedReview(digest: CoachDigest): CoachReview {
  const wins: string[] = [];
  if (digest.focus.streak >= 2) {
    wins.push(
      `You're on a ${digest.focus.streak}-day focus streak${
        digest.focus.dailyAvg > 0 ? `, about ${digest.focus.dailyAvg} min a day` : ""
      }.`
    );
  }
  const topHabit = [...digest.habits].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  if (topHabit && topHabit.currentStreak >= 2) {
    wins.push(`${topHabit.name} is holding at a ${topHabit.currentStreak}-day streak.`);
  }
  if (digest.completion.created > 0 && digest.completion.ratePct >= 60) {
    wins.push(
      `You finished ${digest.completion.completed} of ${digest.completion.created} tasks started this window (${digest.completion.ratePct}%).`
    );
  }
  if (digest.mix.importantSharePct >= REFERENCE_IMPORTANT_SHARE) {
    wins.push(`${digest.mix.importantSharePct}% of your time went to important work — a healthy balance.`);
  }
  if (wins.length === 0) {
    wins.push("You showed up and kept your data going — that's the foundation.");
  }

  const focusAreas: CoachReview["focusAreas"] = [];

  // Q2 protection — the keystone lever when important share trails the reference.
  if (digest.mix.classifiedCount > 0 && digest.mix.importantSharePct < REFERENCE_IMPORTANT_SHARE) {
    focusAreas.push({
      observation: `${digest.mix.importantSharePct}% of your classified time was on important work (reference ~${REFERENCE_IMPORTANT_SHARE}%).`,
      why: "When Q2 (important, not urgent) gets crowded out, it tends to resurface later as urgent.",
      oneAction: "Block one 90-minute slot for a Q2 task early next week and protect it.",
    });
  }

  // A specific slipped task → an if-then plan.
  const missed = digest.missedScheduled[0];
  if (missed) {
    focusAreas.push({
      observation: `"${missed.title}" was scheduled ${missed.daysAgo} day${missed.daysAgo === 1 ? "" : "s"} ago and is still open.`,
      why: "Carrying an open loop quietly taxes attention until it has a concrete next step.",
      oneAction: `When you next sit down to focus, give "${missed.title}" one 25-minute block.`,
    });
  }

  // Estimate calibration (planning fallacy) from the user's own history.
  if (digest.estimateDrift && digest.estimateDrift.factor >= 1.25) {
    const worst = digest.estimateDrift.worstQuadrant;
    focusAreas.push({
      observation: `Your tasks ran about ${digest.estimateDrift.factor}× your estimates${
        worst ? ` (most on ${qName(worst)})` : ""
      }.`,
      why: "Underestimating makes the day feel over-scheduled, which usually lowers satisfaction.",
      oneAction: `Try budgeting ~${digest.estimateDrift.factor}× on your next estimate and see if the day feels calmer.`,
    });
  }

  if (focusAreas.length === 0) {
    focusAreas.push({
      observation: "Your week looks balanced across the matrix.",
      why: "Steady balance is exactly what the time-audit is meant to protect.",
      oneAction: "Pick one Q2 task you care about and schedule it before the urgent work lands.",
    });
  }

  const keystoneChange = focusAreas[0].oneAction;
  const headline =
    digest.focus.streak >= 3
      ? `Steady focus rhythm — a ${digest.focus.streak}-day streak.`
      : digest.completion.ratePct >= 60 && digest.completion.created > 0
        ? "Good follow-through this week."
        : `Here's your last ${digest.windowDays} days.`;

  return { headline, wins: wins.slice(0, 2), focusAreas: focusAreas.slice(0, 3), keystoneChange };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** The cached review without triggering a build (for an instant first paint). */
export function getCachedReview(): CoachResult | null {
  const cached = readJSON<CachedReview | null>(REVIEW_KEY, null);
  if (!cached || !isCoachReview(cached.review)) return null;
  return { review: cached.review, source: cached.source, generatedAt: cached.generatedAt };
}

/**
 * Get this week's review. Returns the cached one unless: forced, no cache, a new
 * ISO week, or the cache was a templated fallback and AI is now available. Falls
 * back to the deterministic templated review whenever AI is off/unready/fails.
 */
export async function getCoachReview(opts?: { force?: boolean; today?: Date }): Promise<CoachResult> {
  const today = opts?.today ?? new Date();
  const weekKey = isoWeekKey(today);
  const cached = readJSON<CachedReview | null>(REVIEW_KEY, null);
  const canAi = coachEnabled();

  const cacheUsable =
    !opts?.force &&
    cached &&
    isCoachReview(cached.review) &&
    cached.weekKey === weekKey &&
    !(canAi && cached.source === "fallback"); // upgrade a fallback once AI is on
  if (cacheUsable && cached) {
    return { review: cached.review, source: cached.source, generatedAt: cached.generatedAt };
  }

  const digest = buildCoachDigest(today);
  let review: CoachReview | null = null;
  let source: ReviewSource = "fallback";

  if (canAi && dataSufficiency(today).ready) {
    // Proxy: send only the digest; the Edge Function holds the key + prompt.
    // Byok: build the prompt here and call OpenRouter directly with the user key.
    const raw =
      aiMode() === "proxy"
        ? await invokeFunction<CoachReview>("coach", { digest })
        : await chat<CoachReview>(
            [
              { role: "system", content: COACH_SYSTEM_PROMPT },
              { role: "user", content: buildCoachUserMessage(digest) },
            ],
            { schema: COACH_SCHEMA, temperature: 0.5 }
          );
    if (raw && isCoachReview(raw)) {
      review = raw;
      source = "ai";
    }
  }
  if (!review) {
    review = buildTemplatedReview(digest);
    source = "fallback";
  }

  const result: CoachResult = { review, source, generatedAt: Date.now() };
  writeJSON<CachedReview>(REVIEW_KEY, { ...result, weekKey });
  return result;
}
