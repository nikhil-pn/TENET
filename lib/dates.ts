import type { DateKey } from "./types";
import { dateToKey } from "./persist";

export interface ParsedWhen {
  /** The input with the recognized date phrase removed and trimmed. */
  title: string;
  /** The resolved local date, or undefined when nothing was recognized. */
  date?: DateKey;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sept: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

// Listed longest-first so the alternation prefers full names over abbreviations.
const WEEKDAY_ALT =
  "sunday|saturday|thursday|wednesday|tuesday|monday|friday|thurs|tues|sun|sat|thur|thu|wed|tue|mon|fri";
const MONTH_ALT =
  "january|february|september|october|november|december|august|march|april|june|july|jan|feb|sept|sep|mar|apr|may|jun|jul|aug|oct|nov|dec";

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** Days until the next occurrence of `weekday`, strictly after `from` (1..7). */
function daysUntilWeekday(from: Date, weekday: number): number {
  const diff = (weekday - from.getDay() + 7) % 7;
  return diff === 0 ? 7 : diff;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

/** Pick the year so that month/day is upcoming (roll to next year if already past). */
function inferYear(month: number, day: number, today: Date): number {
  const year = today.getFullYear();
  const candidate = new Date(year, month, day);
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return candidate < todayMidnight ? year + 1 : year;
}

interface Rule {
  re: RegExp;
  resolve: (m: RegExpMatchArray) => Date | null;
}

/**
 * Parse a short task string that may contain a natural-language date.
 * Recognizes (case-insensitive, first/most-specific match wins): today,
 * tomorrow/tmrw/tom, yesterday, "in N days", "next <weekday>", a bare weekday
 * (the upcoming one), "<month> <day>" / "<day> <month>", DD/MM(/YYYY) day-first,
 * and ISO YYYY-MM-DD. All targets are computed in local time via dateToKey.
 * Unrecognized input returns the trimmed input as the title with no date.
 */
export function parseWhen(input: string, today: Date = new Date()): ParsedWhen {
  const raw = input.trim();
  if (raw === "") return { title: "" };

  const rules: Rule[] = [
    // ISO: 2026-06-25
    {
      re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
      resolve: (m) =>
        new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    },
    // in N days
    {
      re: /\bin (\d{1,3}) days?\b/i,
      resolve: (m) => addDays(today, Number(m[1])),
    },
    { re: /\btoday\b/i, resolve: () => today },
    { re: /\b(?:tomorrow|tmrw|tmw|tom)\b/i, resolve: () => addDays(today, 1) },
    { re: /\byesterday\b/i, resolve: () => addDays(today, -1) },
    // "next <weekday>" — treated as the upcoming occurrence (Google-quick-add
    // style), same as a bare weekday; the "next " just gets stripped from the title.
    {
      re: new RegExp(`\\bnext (${WEEKDAY_ALT})\\b`, "i"),
      resolve: (m) =>
        addDays(today, daysUntilWeekday(today, WEEKDAYS[m[1].toLowerCase()])),
    },
    // bare weekday → upcoming occurrence
    {
      re: new RegExp(`\\b(${WEEKDAY_ALT})\\b`, "i"),
      resolve: (m) =>
        addDays(today, daysUntilWeekday(today, WEEKDAYS[m[1].toLowerCase()])),
    },
    // month day: jun 25 / june 25
    {
      re: new RegExp(`\\b(${MONTH_ALT})\\.? (\\d{1,2})\\b`, "i"),
      resolve: (m) => {
        const month = MONTHS[m[1].toLowerCase()];
        const day = Number(m[2]);
        return new Date(inferYear(month, day, today), month, day);
      },
    },
    // day month: 25 jun / 25 june
    {
      re: new RegExp(`\\b(\\d{1,2}) (${MONTH_ALT})\\b`, "i"),
      resolve: (m) => {
        const month = MONTHS[m[2].toLowerCase()];
        const day = Number(m[1]);
        return new Date(inferYear(month, day, today), month, day);
      },
    },
    // DD/MM or DD/MM/YYYY (day-first)
    {
      re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
      resolve: (m) => {
        const day = Number(m[1]);
        const month = Number(m[2]) - 1;
        const year = m[3] ? normalizeYear(Number(m[3])) : inferYear(month, day, today);
        return new Date(year, month, day);
      },
    },
  ];

  for (const rule of rules) {
    const m = raw.match(rule.re);
    if (!m || m.index === undefined) continue;
    const d = rule.resolve(m);
    if (!d || isNaN(d.getTime())) continue;
    const title = (raw.slice(0, m.index) + raw.slice(m.index + m[0].length))
      .replace(/\s+/g, " ")
      .trim();
    return { title, date: dateToKey(d) };
  }

  return { title: raw };
}
