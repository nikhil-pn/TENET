// GitHub contribution heatmap — read-only, client-side, opt-in (no-op when off).
//
// Surfaces the signed-in user's PUBLIC contribution calendar (the green squares)
// on the monthly calendar. Private contributions are included only if the user
// has turned on "Include private contributions on my profile" in GitHub settings
// — that's their own privacy choice and no app or OAuth scope can override it, so
// the calendar shows a gentle nudge link to that setting instead.
//
// Source: the token-free third-party API github-contributions-api.jogruber.de,
// which scrapes the user's public profile graph and returns the SAME daily
// {date,count,level} data GitHub shows. Deliberately tokenless: it sidesteps the
// Supabase provider_token's ~1h staleness entirely and keeps working on a cold
// open. We cache per-year on-device and fall back to stale cache when offline.
//
// Like lib/cloud/* and lib/ai/*, this whole module no-ops (returns null) when no
// GitHub user is known — i.e. the cloud layer is unconfigured or nobody's signed
// in. The deterministic calendar (focus-minutes, events) is unaffected either way.

import type { DateKey } from "../types";
import { getGitHubUsername } from "../cloud/auth";

// Re-exported so the calendar imports its whole GitHub surface from one module.
export { getGitHubUsername };

/** GitHub's 5-step contribution intensity (0 = none … 4 = most). */
export type ContribLevel = 0 | 1 | 2 | 3 | 4;

export interface ContribDay {
  count: number;
  level: ContribLevel;
}

/** Daily contributions keyed by local "YYYY-MM-DD" (matches dateToKey/calendar). */
export type ContribMap = Record<DateKey, ContribDay>;

const API = "https://github-contributions-api.jogruber.de/v4";
const CACHE_KEY = "tenet.github.contrib.v1";
const TTL_MS = 30 * 60 * 1000; // 30 min — upstream also caches ~1h.

// Only the fields we read from the upstream JSON (it returns more).
interface ApiResponse {
  contributions?: Array<{ date?: unknown; count?: unknown; level?: unknown }>;
}

interface CacheEntry {
  at: number; // Date.now() when fetched
  map: ContribMap;
}

// On-device cache keyed by `${username}:${year}`. This is derived, device-local
// data (not portable TenetData), so — exactly like the provider token in
// lib/cloud/auth.ts — we touch localStorage directly here to stay out of the
// cloud-sync write-through seam (lib/persist.ts).
type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Cache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded / storage blocked — caching is best-effort */
  }
}

function clampLevel(n: unknown): ContribLevel {
  const v = typeof n === "number" ? Math.round(n) : 0;
  if (v <= 0) return 0;
  if (v >= 4) return 4;
  return v as ContribLevel;
}

/** Defensively map the third-party payload to a date-keyed map. */
function toMap(json: ApiResponse): ContribMap {
  const map: ContribMap = {};
  const rows = Array.isArray(json.contributions) ? json.contributions : [];
  for (const row of rows) {
    const date = typeof row.date === "string" ? row.date : null;
    if (!date) continue;
    const count = typeof row.count === "number" ? row.count : 0;
    map[date] = { count, level: clampLevel(row.level) };
  }
  return map;
}

/**
 * Load one year's contribution calendar, keyed by date. Returns null when no
 * GitHub user is known or the fetch fails with no cache to fall back to. Never
 * throws — callers render the heatmap only when this resolves to a map.
 */
export async function loadContributions(
  year: number
): Promise<ContribMap | null> {
  const username = getGitHubUsername();
  if (!username) return null;

  const cacheKey = `${username}:${year}`;
  const cache = readCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;

  try {
    const res = await fetch(
      `${API}/${encodeURIComponent(username)}?y=${year}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return cached?.map ?? null; // serve stale on a bad response
    const json = (await res.json()) as ApiResponse;
    const map = toMap(json);
    cache[cacheKey] = { at: Date.now(), map };
    writeCache(cache);
    return map;
  } catch {
    // Offline / API down — serve stale cache if we have it, else null.
    return cached?.map ?? null;
  }
}
