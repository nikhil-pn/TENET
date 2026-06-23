# TENET — AI Integration Research

> Deep research (multi-agent, web-sourced) on whether and how to add an **in-app LLM** to TENET.
> Question asked: *"If I bring in DeepSeek (or another cheap-but-not-cheapest open model), what
> value can it add — a personalized **coach/insights** engine (not a chatbot), and AI-assisted
> **Eisenhower classification** at capture?"*
>
> Pairs with `CLAUDE.md` (how to work on the repo), `docs/warikoo-time-management-spec.md` (the
> prioritization feature the coach reasons over), and `docs/roadmap-and-research.md` (the backlog).
> Status: **research + recommendation only — not yet approved or built.**

---

## 0. TL;DR (the verdict)

1. **Yes, an LLM adds real value here — but as a narrow, grounded layer, not a chatbot.** The single
   highest-value use is exactly your instinct: a **periodic "Coach"** that, after ~15–20 days of
   data, tells you where you're drifting and gives **one concrete next step**. It's cheap (one
   batched call/week), safe (sends only derived numbers), and sits on the strongest behavioral
   evidence.
2. **Do NOT call DeepSeek's own API directly.** The *model* is great and cheap; the *first-party
   endpoint* stores data in China, trains on inputs by default, and rejects browser calls (no CORS).
   Reach **DeepSeek-the-model through OpenRouter with `zdr:true`** (zero-data-retention) — same
   intelligence, real privacy, drop-in OpenAI-compatible, browser-callable. Keeps static export.
3. **The "intelligence" should stay deterministic; the LLM only narrates.** TENET already computes
   the real insights (`quadrantBreakdown`, `nudges`, the 75% reference, the 10-day satisfaction
   audit). The model's job is to *phrase one prioritized finding warmly* and *pre-fill a
   classification you confirm* — **compute first, narrate second, never let it invent numbers.**
4. **Your #2 ask (AI Eisenhower classification) is the weaker of the two.** Manual classification is
   already 2 taps, and *importance* is personal context a model lacks. Ship it only as
   **suggest-and-confirm** (never silent auto-apply), lead with **batch-triaging the Unclassified
   pile** rather than per-keystroke, and ship the **time-estimate** half more confidently than the
   importance/urgency half.
5. **This is a deliberate pivot of a locked rule.** `CLAUDE.md` rule #1 says *"no AI/agent calls in
   the app."* Adding in-app AI **must be done the same way the Supabase "no backend" rule was
   pivoted**: opt-in, **off by default**, behind **one `lib/ai/` seam**, **no-op when unconfigured**,
   minimal data egress. Document it as a scoped amendment, not a silent break.

**Cost is a non-issue:** well under **$0.05/user/month** on the DeepSeek-via-OpenRouter route (a
weekly coach call + occasional classification). The deciding axes are **privacy, key-handling, and
JSON reliability — not price.**

---

## 1. The architectural tension (read this first)

`CLAUDE.md` currently locks: *"No AI/agent calls in the app... The 'intelligence' lives **outside**
the app — in the terminal via Claude Code / MCP — never the app calling an AI API."* The MEMORY
north-star echoes it ("intelligence lives outside").

Your request deliberately pivots that one rule. The good news: TENET **already pivoted a comparably
locked rule** — the old "no backend / no hosted DB" stance became the **opt-in Supabase cloud
layer** (env-gated, no-op when unset, static export preserved). The AI layer should mirror that
precedent **exactly**:

| Principle (locked) | How the AI layer honors it |
|---|---|
| Static export, "no server of ours" | All calls are **client-side `fetch`** (like `lib/githubStreak.ts` → `api.github.com`). No Next API route, no SSR. |
| Local-first, offline-safe | AI is **strictly additive**; deterministic `nudges()`/`getQuadrant()` remain the always-on floor and the offline fallback. |
| One storage seam (`lib/persist.ts`) | One **`lib/ai/` provider seam** — provider/model become config; no `fetch` scattered into components. |
| Opt-in, no-op when unset (cloud layer) | `aiEnabled` mirrors `cloudEnabled`. Unset ⇒ **zero network**, byte-identical to today's PWA. |
| Portable, framework-agnostic `lib/` | The seam is an OpenAI-compatible interface → the **Electron edition swaps to local Ollama** later, fulfilling "intelligence outside the app." |
| Privacy | Default **OFF**, explicit consent, **send derived numbers not raw notes**, no-train/ZDR provider. |

**Action:** amend `CLAUDE.md` rule #1 and MEMORY to: *"In-app AI is opt-in, off by default, behind
one `lib/ai/` seam, no-op when unset"* — recorded like the Supabase pivot, with your sign-off.

---

## 2. Provider decision

You named DeepSeek and asked for "cheap but not cheapest, with decent quality." The research is
decisive: **keep the DeepSeek model, drop the DeepSeek endpoint.**

### Why NOT `api.deepseek.com` directly
- Data stored on **servers in mainland China**, governed by PRC law.
- **Trains on inputs by default**; paid-API exemption only since a **March 2026** policy change, no
  deletion schedule, opt-out by email only. ([privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html))
- Like most first-party LLM APIs, **rejects browser CORS** — unusable from a static export anyway.
- For a **privacy-marketed, local-first app** this is a hard fail regardless of price.

### The recommendation: **DeepSeek-the-model via OpenRouter, `zdr:true`**
OpenRouter is the one major aggregator that **explicitly supports browser CORS / client-side fetch**
([docs](https://openrouter.ai/docs/api/reference/overview)), is **OpenAI-compatible** (one base-URL
swap = matches the one-seam ethos), **logs zero prompts/completions by default**, and exposes a
per-request **`zdr` flag** forcing zero-data-retention routing
([ZDR docs](https://openrouter.ai/docs/guides/features/zdr)). So one key buys cheap DeepSeek quality
**without** sending data to China and **without** a server of ours.

### Comparison (per 1M tokens unless noted; prices ≈ 2026)

| Provider / route | Price (in / out) | Privacy | Notes |
|---|---|---|---|
| **DeepSeek direct** (V4-Flash) | **$0.14 / $0.28** (~$0.003 cache-hit) | ❌ China storage, trains by default, no clean ZDR, no browser CORS | Cheapest, but wrong delivery path |
| **OpenRouter** (BYOK seam) ⭐ | underlying model + ~5% fee | ✅ no logging by default; **`zdr:true`**; pin a no-train provider | **Primary.** Browser-CORS, OpenAI-compatible, swap models w/o code change |
| **Together AI** (US) | DeepSeek V3.1 ~$0.60 / $1.70 | ✅ no-train default + **ZDR toggle** | Best "never trained / not retained" marketing claim; broad open-model menu |
| **DeepInfra** (US) | ~$0.04 / $0.19 (small) | ✅ in-memory only, no-train (open models) | Cheapest privacy-respecting host; pin open weights |
| **Groq** (US) | $0.05–$0.90 | ✅ no-train, default no-retention + ZDR | **Fastest** (coach feels instant); narrower menu |
| **Fireworks** (US) | competitive | ✅ no-log/no-train w/o opt-in; HIPAA/SOC2 | Compliance story if ever needed |
| **Mistral La Plateforme** (EU) | $0.10–$0.60 (small) | ✅✅ **EU-only residency**, GDPR-native | Best EU story; Mistral models only |
| **Google Gemini 3.1 Flash-Lite** (paid) ⭐ | ~$0.25 / $1.50 | ✅ paid tier no-train (⚠️ **free AI Studio trains**) | **Strong runner-up:** best JSON/structured output + uptime; closed-weight (no self-host) |
| OpenAI GPT-5-nano | ~$0.05 / $0.40 | ✅ no-train since 2023; 30-day abuse retention | Most reliable JSON; closed-weight |
| Anthropic Haiku 4.5 | $1.00 / $5.00 | ✅ no-train by default | Best coaching *tone*; priciest cheap-tier |

**Picks:**
- **Primary — OpenRouter** (pin a no-train/ZDR provider, `zdr:true`). Provider becomes config; A/B
  models freely; truest mirror of the env-gated cloud layer.
- **Runner-up — Gemini 3.1 Flash-Lite (paid key)** if you'd rather trust one name-brand vendor with
  best-in-class structured output. *Never the free AI Studio tier — it trains.*
- **If privacy is the headline marketing claim** — pin **Together** (US, ZDR) or **Mistral** (EU).

---

## 3. Architecture

### 3.1 Integration shape — phased
- **Phase 1 (MVP): BYOK direct-from-browser via OpenRouter.** User pastes *their own* OpenRouter key
  into a Settings → AI panel; stored via the persist seam under `tenet.ai.config.v1` (**never** a
  `NEXT_PUBLIC_*` var — those bake into `/out` at build time and leak to every browser). Browser
  calls `https://openrouter.ai/api/v1/chat/completions` with `zdr:true`. **Zero new infra; the user
  owns the key and the (tiny) bill; the truest mirror of the existing opt-in cloud layer.**
- **Phase 2 (optional, hides the key): Supabase Edge Function proxy.** `supabase/functions/coach/`
  holds the key as a **Supabase secret**, validates the caller's existing Supabase JWT, redacts +
  rate-limits server-side, calls the provider. Invoked via `supabase.functions.invoke('coach', …)`.
  Runs on **managed Supabase infra** → "no server of ours" holds in spirit (same pivot as the DB).
  ([Edge Function limits](https://supabase.com/docs/guides/functions/limits); alt:
  [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/reference/pricing/) — free,
  adds caching/rate-limit/fallback.)
- **Phase 3 (zero egress): on-device WebLLM** (Qwen2.5-1.5B / Llama-3.2-1B, Q4, WebGPU) behind the
  same interface — and the path the **Electron edition** takes to local Ollama.

All three sit behind the same `lib/ai/` seam and are selectable in config. **Static export is
preserved in every phase.**

### 3.2 Module sketch (`lib/ai/`, UI-agnostic, mirrors `lib/cloud/`)
```
lib/ai/
  config.ts     # THE GATE (lib/supabase.ts analogue): typed AiConfig from persist seam.
                #   aiEnabled, getAiConfig()->null when unset. Every other module early-returns when null.
  provider.ts   # THE SINGLE CLIENT SEAM (the LLM analogue of lib/persist.ts):
                #   chat(messages,{schema,signal}) -> structured JSON. Branches byok|proxy|local.
                #   Provider/host swap lives here ONLY. Returns null on failure -> callers fall back.
  snapshot.ts   # THE DIGEST BUILDER (deterministic, NO LLM) — where the real intelligence lives:
                #   scheduledButSkipped, estimate-vs-actual calibration factor, completionRateByQuadrant,
                #   satisfactionTrend, focusMinutesByDate. Reuses load*() + lib/prioritization.ts.
  coach.ts      # buildInsights(): deterministic templated insight if AI off / data < threshold;
                #   else provider.chat() with strict json_schema -> same Insight[] the UI renders.
  classify.ts   # classifyTask(title, fewShotFromHistory?) -> suggestion | null (confidence<0.6 => null).
                #   NEVER writes; returns a SUGGESTION the caller pre-fills. parseWhen() does dates locally.
  prompts.ts    # system prompts + few-shot as plain string constants (MI tone rules; classify examples).
```
**UI wiring is additive only:** add `"coach"` to `NavDock`'s `DockPanel` union + icon/label/order;
render `<CoachPanel>` in `page.tsx`; **resurrect the orphaned `Insights.tsx` + `Reflect.tsx`** as the
panel's deterministic floor. `TodoPanel` gets a small "✨ Suggest" affordance that sets its existing
`cImportant/cUrgent/cEstimate` state. **No component ever speaks HTTP** — exactly like today.

### 3.3 Privacy posture (first-class)
- **Default OFF + explicit consent.** Settings → AI panel: master toggle, **separate** Coach vs
  Classification toggles, a plain "what is sent and to whom" disclosure, a one-tap OFF that wipes the
  key. Treated like cloud sign-in, not an ambient default.
- **Data minimization is the stance.** Coach sends a **compact derived digest** (ratios, counts, a
  few truncated task titles), **not** raw localStorage, **not** full note bodies. `satisfactionNote`
  and `Note` bodies are **withheld by default**, included only behind explicit per-feature consent
  (best candidate for the on-device path).
- **No-train/ZDR provider mandatory.** OpenRouter `zdr:true` or a pinned US/EU no-train host.
  **Never `api.deepseek.com`.**
- **Treat all task/note text as untrusted** (OWASP LLM01 indirect prompt injection): wrap user text
  in unique delimiters, keep it **out of the system slot**, render output as **inert plain text that
  never auto-mutates data** (coach is advisory; classify is confirm-only).

### 3.4 Cost envelope
DeepSeek-via-OpenRouter (~$0.14/$0.28 per 1M, ~98% cache discount on the stable prompt prefix):
- **Weekly coach call:** ~3k in / ~500 out ⇒ **~$0.0006/week ⇒ ~$0.002–0.003/user/month.**
- **Classification:** ~300–600 tokens/tap; even 100/month ⇒ **< $0.02/month.**
- **Total: < ~$0.05/user/month.** With BYOK the *user* pays it directly. On-device = $0/token.

---

## 4. Feature catalog (scored)

Score = value-for-effort, privacy-respecting, for a solo dev. **Build-now / Maybe-later / Skip.**

| # | Feature | Verdict | Score | Why |
|---|---|---|---|---|
| 1 | **Estimate-Calibration Coach** (planning-fallacy fix) | **build-now** | 92 | Highest value/effort. Math is **pure local TS, no LLM**; reference-class forecasting on *your own* estimate-vs-actual; differentiated; improves with use. |
| 2 | **Weekly Coach Digest** (insights engine) | **build-now** | 90 | **Your #1 want.** Cheap weekly batched call over *derived aggregates only*; strongest evidence; reuses orphaned `Insights`/`Reflect`. |
| 3 | **Loose-Ends / Zeigarnik Closure** ("which scheduled tasks I didn't finish") | **build-now** | 80 | Mostly local logic; well-evidenced; **best merged as the digest's "open loops" section.** |
| 4 | **Natural-Language Quick Capture** ("deck by Fri ~2h urgent" → structured task) | **build-now** | 82 | Biggest add-flow friction reducer; table-stakes; keep `parseWhen()` as offline fallback. |
| 5 | **AI Eisenhower Suggest-and-Confirm** (your #2) | **maybe-later** | 64 | Ship **auto-estimate** confidently; importance/urgency only as a one-tap confirmable pre-fill. Never silent. |
| 6 | Smart Task Breakdown (long Q2 → 25-min steps) | maybe-later | 60 | Real procrastination lever, but needs a sub-task schema the app lacks. |
| 7 | Habit-Relapse Early-Warning | maybe-later | 62 | Detection is free local logic; constrained by foreground-only reminders. |
| 8 | Reflective Satisfaction-Note Synthesizer | maybe-later | 48 | High value but **most sensitive data** — local-only/WebLLM or explicit consent. |
| 9 | "Plan My Day" Auto-Prioritizer | maybe-later | 50 | Popular, but `suggestedOrder()` already does ordering locally; full auto-scheduling fights the minimalist/autonomy ethos. |
| 10 | On-device WebLLM (zero-egress) | maybe-later | 46 | Max privacy + north-star fit; heavy download, weaker reasoning. |
| — | **Generic in-app chatbot** | **skip** | 8 | You explicitly don't want it; ungrounded gimmick; unbounded injection/privacy surface. |
| — | **Silent auto-apply of important/urgent** | **skip** | 12 | LLM confidence is overconfident + importance is personal → confidently-wrong quadrants would **corrupt the time-audit** and destroy trust. |
| — | **Gamified points/streak-score** | **skip** | 6 | Research links points/streaks to behavior **distortion** + guilt — violates the documented "never guilt" stance. |
| — | **DeepSeek first-party direct API** | **skip** | 14 | Model fine; endpoint = China storage + trains + no CORS. Route through OpenRouter instead. |

---

## 5. Feature A — "The Coach" (deep design)

A new **4th dock panel "Coach"** mounted like the existing three. **The LLM narrates locally-computed
numbers; it never invents facts.**

- **Trigger / data gate (the exact "~15–20 days" answer):** offer the AI card only when
  **`activeDays ≥ 10`** (distinct days in last 30 with a completed/created todo, habit check-in,
  Pomodoro session, or day log) **AND `completedTasksWithBothEstimates ≥ 5`**. Below that, a calm
  *"Still learning your patterns — check back after ~10 active days"* state + deterministic insights
  only. **Generation:** once per ISO week, fired on a **fresh-start landmark** (first open of a new
  week, Monday/1st) — never per-open, never on a timer, never background. Plus a rate-limited manual
  **Regenerate**.
- **Input (computed entirely locally in `lib/ai/snapshot.ts`):** `quadrantBreakdown` ratios +
  `REFERENCE_MIX`; completion rate + **per-quadrant scheduled-vs-completed**; up to **5**
  missed-scheduled tasks as `{title(≤60 chars), quadrant, daysAgo}` (the *only* raw text sent, and
  only by default); **estimate-vs-actual** median drift + worst quadrant; habit consistency/streaks;
  focus minutes/streak; satisfaction avg + trend. `satisfactionNote` bodies **NOT sent** unless the
  user opts in. `nudges()` passed as `priorSignals` so the LLM elaborates rather than contradicts.
- **Prompt:** fixed cache-friendly system prompt encoding **Motivational-Interviewing** rules — lead
  with a genuine win; reflect gaps as choosable observations, never failure; **banned words**
  `failed/should/lazy/behind/guilt`; no streak-loss/red framing; `REFERENCE_MIX` is a *reference not
  a target*; ≤3 focus areas each with a concrete **if-then implementation-intention** next step;
  exactly **one** keystone change; no medical/financial/legal advice; **output only valid JSON**.
  User digest wrapped in `<digest>…</digest>` delimiters. `response_format: json_schema, strict`.
- **Output shape:**
  ```ts
  interface CoachReview {
    generatedAt: number; windowDays: number; headline: string;
    wins: string[];
    focusAreas: { observation: string; why: string; oneAction: string }[];
    keystoneChange: string;
  }
  ```
  Cached under `tenet.coach.review.v1` with `{digestHash, generatedAt}`; **never regenerates on
  open** — regenerates only on the weekly landmark, manual Regenerate, or a material digest change.
- **UX:** cached review card on top (headline, wins, focus areas, keystone, satisfaction sparkline
  reusing `Reflect.tsx`'s 10-day strip), with the **deterministic `Insights.tsx` floor below** so the
  panel is useful even with AI off. Privacy one-liner: *"Computed on your device; only anonymized
  numbers are sent to generate the wording."*
- **Fallback:** AI off / offline / bad JSON ⇒ render the deterministic floor; headline degrades to a
  templated sentence from the digest. Never blocks.
- **Example (16 active days):** digest → importantShare 61% (ref 75); Q1 38 / Q2 19 / Q3 28 / Q4 15;
  4 Q2 scheduled, 1 done; missed `Outline Q3 strategy doc` (Q2, 3d ago); estimate drift 1.7× (worst
  Q2); Gym 43%, Read streak 12; focus 65 min/day, streak 9; satisfaction 58, trend −6.
  → **headline** *"Solid focus rhythm this week — a 9-day focus streak and Reading on a 12-day roll."*
  **focusArea** *"~38% of classified time went to Q1 firefighting… Q2 keeps getting crowded out, then
  becomes urgent."* **oneAction** *"When it's 9am Wednesday at your desk, start 'Outline Q3 strategy
  doc' for one 25-min block."* **keystone** *"Protect one 90-min Q2 block early in the week."*
- **Effort:** ~2–3 days (new `lib/ai/{config,provider,snapshot,coach,prompts}.ts`, `CoachPanel`,
  3-line `NavDock`/`page.tsx` edits, resurrect `Insights`/`Reflect`).

---

## 6. Feature B — AI Eisenhower classification (deep design + honest verdict)

**Honest verdict:** this is the **weaker** of your two asks. Manual classification is already 2 taps,
*importance is personal context the model lacks*, and silent automation would corrupt the time-audit
and erode trust. So:
- **Do NOT** build debounced per-keystroke auto-classification.
- **Lead with BATCH-TRIAGE** of the Unclassified bucket (the genuine friction): one call classifies
  the whole backlog → a review list with per-row **Accept / Edit / Skip** + "Accept all." Off the
  hot add-path, never blocks typing.
- **Add an optional on-demand "✨ Suggest"** pill in `TodoPanel`'s existing `classifyRow` for power
  users: on tap it pre-fills the existing `cImportant/cUrgent/cEstimate` (+ `cDeadline` if Q1) as a
  visibly-marked, one-tap-editable **suggestion**. Commits via the **unchanged** `addTodo` contract.
- **Ship the time-estimate half more confidently** than importance/urgency — estimates are
  higher-accuracy and feed Feature A's drift metric. Prefer **reference-class forecasting from the
  user's own history** over the model where possible.

- **Prompt:** few-shot, strict-JSON, one task per call (array for batch). System: triage *from the
  user's perspective*; when unsure prefer `important:true, urgent:false` (the safe Q2 default) with
  lower confidence. 3–5 few-shot examples seeded to TENET semantics (and the user's own recent
  labels). **`parseWhen()` runs locally first for dates — the model never parses dates.**
- **Output:**
  ```ts
  interface TaskSuggestion {
    important: boolean; urgent: boolean;
    estimatedMinutes: number; // snapped to existing chips 2/15/30/60/120
    confidence: number;       // 0..1
    reason: string;           // <=120 chars, shown as tooltip
  }
  ```
- **Guardrails:** suggest-and-confirm only; **`confidence < 0.6` ⇒ don't pre-fill** (keep manual Q2
  default); on-demand only (no per-keystroke), rate-limited; offline ⇒ existing manual flow +
  `parseWhen`; titles delimited, output inert, never auto-committed; estimate snapped to existing
  chips, deadline pre-fill restricted to Q1 (matching the current rule).
- **Effort:** ~0.5–1 day on top of Feature A's provider seam.

---

## 7. Recommended phased plan

- **Phase 0 — Decision + deterministic scaffold (no user-facing AI):** amend `CLAUDE.md` rule #1 +
  MEMORY (opt-in AI pivot). Add `lib/ai/{config,provider}.ts` (no-op gate + client seam) **and the
  pure `lib/ai/snapshot.ts` helpers** (`scheduledButSkipped`, estimate-vs-actual factor,
  `completionRateByQuadrant`, `satisfactionTrend`). *These already deliver real insight value with
  zero LLM and are the offline floor.*
- **Phase 1 (MVP) — BYOK Coach** (#2 + #1 + #3 in the catalog): Settings → AI panel (default OFF),
  `lib/ai/{coach,prompts}.ts` on the OpenRouter+`zdr` path, `CoachPanel` resurrecting
  `Insights`/`Reflect`, data-sufficiency gate, templated fallback. **Validates value before any
  infra.**
- **Phase 2 — Classification** (#5): `lib/ai/classify.ts`, batch-triage + on-demand Suggest; estimate
  from history first. Fold "loose ends" into the Coach.
- **Phase 3 — Optional Supabase Edge Function proxy** (hide the key) for users who won't paste one.
- **Phase 4 — On-device WebLLM** for zero-egress sensitive text + Electron/Ollama setup.

---

## 8. Risks & mitigations (top)

| Risk | Mitigation |
|---|---|
| Silently breaking locked rule #1 | Deliberate, documented, scoped pivot like the Supabase one; sign-off first |
| BYOK key exfiltratable via XSS | Strict CSP, no third-party scripts (already true), key scoped to OpenRouter only; Phase-2 proxy for sensitive users |
| Personal data off-device / DeepSeek-in-China | Default OFF + consent; minimized derived digest; **`zdr:true`/no-train host**; never `api.deepseek.com`; on-device path for notes |
| Wrong classification skews the time-audit | **Suggest-and-confirm only**; `confidence<0.6` ⇒ unset; deterministic `getQuadrant` authoritative; estimate from history; measure flip-rate |
| Indirect prompt injection (OWASP LLM01) | Delimit user text, keep out of system slot, output inert, never auto-mutate |
| Guilt/over-notification | MI tone as a hard system rule; weekly + dismissible + capped; "personal best" survives misses; reference-not-target framing |
| Cold-start (noisy until ~15–20 days) | Data-sufficiency gate + "still learning" state + deterministic fallback |
| Thin-AI-wrapper gimmick | **Compute-first/narrate-second**; templated fallback so value is provider-independent |

---

## 9. Sources (selected)

**Providers / privacy:** OpenRouter [API overview](https://openrouter.ai/docs/api/reference/overview) ·
[ZDR](https://openrouter.ai/docs/guides/features/zdr) · DeepSeek
[privacy policy](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html) ·
[pricing](https://api-docs.deepseek.com/quick_start/pricing) · Supabase
[Edge Function limits](https://supabase.com/docs/guides/functions/limits) · Cloudflare
[AI Gateway pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
**Coaching / behavior change:** [Weekly review cadence](https://weekplan.net/weekly-review-productivity/) ·
[Sunsama weekly review](https://help.sunsama.com/docs/weekly-review) · [Planning fallacy](https://en.wikipedia.org/wiki/Planning_fallacy) ·
[Implementation intentions meta-analysis (d≈0.65)](https://www.researchgate.net/publication/37367696_Implementation_Intentions_and_Goal_Achievement_A_Meta-Analysis_of_Effects_and_Processes) ·
[Self-Determination Theory (autonomy-supportive framing)](https://selfdeterminationtheory.org/SDT/documents/2000_RyanDeci_SDT.pdf) ·
[Zeigarnik / unfinished tasks](https://nesslabs.com/unfinished-tasks) ·
[Motivational Interviewing](https://pmc.ncbi.nlm.nih.gov/articles/PMC8200683/) ·
[Todoist Karma distortion (cautionary)](https://thejaymo.net/2024/10/08/reaching-enlightenment-on-todoist/) ·
[streak/shame anti-pattern](https://uxmag.medium.com/the-psychology-of-hot-streak-game-design-how-to-keep-players-coming-back-every-day-without-shame-3dde153f239c)
**Classification / capture:** [Motion AI task manager](https://www.usemotion.com/features/ai-task-manager) ·
[Akiflow smart capture](https://akiflow.com/features/tasks-capture) · [TickTick vs Todoist](https://www.morgen.so/blog-posts/ticktick-vs-todoist) ·
[chrono-node](https://github.com/wanasit/chrono) ·
[Structured outputs: JSON mode vs function calling](https://towardsdatascience.com/structured-outputs-with-llms-json-mode-function-calling-and-when-to-use-each/)
