# TENET — Roadmap & Research

Consolidated context so any new session (and future-you) knows what's built, what's next, and the
research behind the big decisions. Pairs with `CLAUDE.md` (how to work on the repo),
`docs/warikoo-time-management-spec.md` (the prioritization feature), and
`docs/ai-integration-research.md` (the opt-in in-app AI layer — provider choice, architecture,
the weekly Coach + suggest-and-confirm classification, sourced).

---

## Current status (2026-06, branch `chore/typescript-migration`, pushed)

Built & verified (`tsc`/lint/`build` clean): Pomodoro timer · monthly focus calendar · **to-do
checklist** · **habit/gym streaks** · **unified calendar/day-planner** (NL quick-add, focus-minutes
+ tasks per day) · **Warikoo Eisenhower prioritization + time-audit** (classify-on-add, Matrix,
Insights time-mix + 75% gauge, satisfaction + 10-day, Pomodoro↔task focus link) · **bottom nav
dock**. Data is local-first in localStorage behind the `lib/persist.ts` seam, as portable
`TenetData` JSON.

---

## Backlog — what to build next (prioritized)

0. **Opt-in AI layer — Phase 1 (the weekly "Coach") DONE.** A small, privacy-first in-app LLM behind
   one `lib/ai/` seam (opt-in, BYOK→OpenRouter+`zdr`, no-op when unset). The model only *narrates
   locally-computed numbers*; deterministic `lib/prioritization.ts` stays authoritative; a templated
   fallback works with no key. Shipped as a "Coach" dock panel (resurrects `Insights.tsx`/
   `Reflect.tsx`). **Phase 2 (AI Eisenhower classification) DROPPED — classification stays manual by
   design** (AI can't know personal importance; auto-apply would corrupt the time-audit). Optional
   future AI only: P3 Supabase Edge proxy (hide the key), P4 on-device WebLLM. Full design, provider
   rationale, feature catalog, and sources: **`docs/ai-integration-research.md`**.
1. **Dark mode + design tokens** — replace hardcoded hex (incl. `QUADRANT_META` colors) with
   two-tier CSS variables in `globals.css` (primitives → semantic `--color-surface/-text/--q1..q4`),
   default to `prefers-color-scheme`, offer System/Light/Dark via `data-theme` (pre-paint script to
   avoid flash). One-time swap themes the whole app. Highest delight/effort ratio.
2. **Data safety (cheap, no backend)** — call `navigator.storage.persist()` (defeat eviction) +
   add **JSON export/import** of `TenetData` (download/restore). This is the universal safety net.
3. **Persistent "Today" home** — timer + today's plan + current/next, instead of modal-only nav.
   Delivers the long-planned "Today" view; ends the "everything is a modal" friction.
4. **Swipe gestures + completion delight** — swipe-to-complete/schedule/delete on rows (the `order`
   field already supports reorder); a check animation + confetti on clearing the day (gate behind
   `prefers-reduced-motion`; haptics are Android-only — iOS Safari has no `navigator.vibrate`).
5. **Settings** — configurable Pomodoro/break lengths (hardcoded `25/5/30` in `Clock.tsx`), theme,
   export/import.
6. **Opt-in GitHub backup** — see "Storage" below. Pasted fine-grained PAT; no backend.
7. **Reminders** — foreground-only by design (see below). True background needs the Electron edition
   or an opt-in push backend.

**North-star (don't build now):** native macOS **Electron "pro" edition** + **Obsidian vault** +
**Claude Code / MCP**. Storing `TenetData` as files inside a vault folder is the single keystone:
Obsidian sees it, a filesystem MCP server exposes it to Claude Code for free, and Obsidian-Git
pushes it to GitHub — one pipeline. The portable `lib/`, the single storage seam, and the
quadrant-color tokens are all steps toward it.

---

## Research — UX / "make it simple & delightful"

Friction today: 3–4 floating buttons (now replaced by the **nav dock** ✓); everything is a modal
(no persistent home); classification on every add; two inconsistent capture surfaces; no gestures;
flat completion; unlabeled start control (now labeled ✓); no dark mode; no settings.

North-star core flow: **Capture → Plan → Prioritize → Focus → Reflect** — most of the logic already
exists; the work is *revealing* it (a "Today" home + the dock) and *removing* friction. Quick wins
not yet done: unify the two add fields (use `parseWhen` everywhere), surface "Start focus" on every
open task (not just Matrix), undo-on-delete, reduce Insights default density (progressive
disclosure). Bigger bets: dark mode/tokens, "Today" home, swipe gestures, settings (all in the
backlog above). Cross-platform note: a bottom tab bar (not a FAB) is the right call for an
installable PWA. Refs: Material 3 (nav bar / FAB guidelines), Apple HIG (tab bars, swipe actions),
NN/g (microinteractions, onboarding), Todoist/Things/Linear/Sunsama capture patterns.

---

## Storage — DECISION (pivot): opt-in Supabase cloud layer

> **Update — the "no hosted DB" conclusion below was deliberately revised.** The app now ships an
> **opt-in Supabase layer** (auth + cloud sync + GitHub streak), gated on `NEXT_PUBLIC_SUPABASE_*`.
> Unset ⇒ pure local-first (everything below still describes that default). What changed and why:
>
> - **Why pivot:** the user wants multi-device cloud data with GitHub/Google login, and — the
>   emotional core — a real **GitHub contribution-graph streak**: finish a Pomodoro → auto-commit
>   to a `tenet-log` repo → the green square lights up that day. That needs accounts + a server-set
>   timestamp, which a pure pasted-PAT backup can't give.
> - **Stack:** Supabase (Postgres + built-in GitHub/Google OAuth + Row-Level Security). One managed
>   service, **no server of ours** — static export preserved; the only client secret is the public
>   anon key (RLS guards every row). Schema + policies live in `supabase/migrations/0001_init.sql`.
> - **Sync model:** local-first. The app still reads/writes localStorage instantly (offline-safe);
>   `lib/cloud/sync.ts` mirrors changes to Supabase via the `subscribeWrites()` seam and merges on
>   login (per-record last-write-wins via `updatedAt` + a snapshot diff that distinguishes a remote
>   delete from a local create). Realtime multi-device push is a later enhancement.
> - **Accountability / immutability:** the tamper-proof record is the `pomodoro_sessions` table —
>   server timestamp + **insert-only RLS** (no UPDATE/DELETE, even for the owner). The GitHub graph
>   rides on top as motivation only; **commits can be backdated**, so the DB ledger is truth.
> - **Explicitly OUT of scope (kept simple):** no Markdown-file data mirror, no Obsidian vault
>   integration, no in-app AI. Obsidian stays the user's separate "supreme brain"; a future
>   app↔Obsidian bridge is parked, not built.

## Research — storage & backup (pre-pivot; the local-first default still holds)

- **localStorage is adequate now** (data is kilobytes). Migrate to **IndexedDB** (behind the seam)
  only on binary/large data, jank, a sync engine, or nearing ~5 MiB. The real gap is **durability**:
  browser storage is best-effort/evictable → fix with `navigator.storage.persist()` + export/import.
- **No hosted DB needed.** A single-user local-first app needs off-device *backup of one JSON doc*,
  not a database server (and a backend breaks the no-backend rule).
- **GitHub backup IS possible from the static PWA — via a user-pasted fine-grained PAT** (scoped to
  one private repo, Contents: read+write). Key fact: `api.github.com` **supports CORS**, so the
  browser can read/write the **Contents API** directly with a token. GitHub's **OAuth/device token
  endpoints are NOT CORS-enabled** and need the client secret → OAuth would require a tiny serverless
  proxy (Cloudflare Worker); the **PAT path needs zero backend.** Store `data/tenet.json`, use the
  file `sha` for optimistic concurrency (409 on conflict), debounce commits. Rate limit (5000/hr) is
  a non-issue. Token-in-browser = XSS risk → scope it tightly; the Electron edition does this
  securely (OS keychain, real `git`).
- Phased: **(0)** persist() + export/import → **(1)** opt-in GitHub backup via PAT (`lib/githubBackup.ts`,
  token under `tenet.github.token`) → **(2)** optional OAuth-proxy / IndexedDB if triggered →
  **(3)** Electron + vault + git + MCP.
- Refs: MDN (Storage quotas/eviction, Storage API), web.dev (persistent storage), GitHub REST
  (Contents API, rate limits, fine-grained PATs), Simon Willison & gr2m (OAuth-via-Worker), Ink &
  Switch (local-first), RxDB/Dexie (if a sync engine is ever needed).

---

## Research — Google Calendar / Obsidian / MCP integrations (future)

- **True two-way Google Calendar sync is not possible in a no-backend static PWA**: browser OAuth
  gives only a ~1h access token (no silent refresh); reading/2-way needs a webhook (CA-signed HTTPS)
  or CORS proxy = a backend; the secret `.ics` URL has no CORS header. The honest web move is **`.ics`
  export** (and JSON/Markdown export). Becomes clean in **Electron** (loopback OAuth + refresh token
  + `syncToken` polling).
- **Obsidian vault** file access in-browser is Chromium-desktop-only (File System Access API) — not
  reliable cross-platform. The real path is the **Electron edition** writing JSON/Markdown into a
  vault folder.
- **MCP is external to the app** — it serves Claude Code, not the browser. Use existing servers
  today, outside TENET: `nspady/google-calendar-mcp`, a filesystem MCP pointed at the vault. Once
  the Electron edition stores data as vault files, the **filesystem MCP exposes TENET's data to
  Claude Code for free** — the "intelligence outside the app" principle realized.
- Refs: Google Identity Services token model, GitHub/Google OAuth CORS constraints, MDN File System
  Access API support, Obsidian Tasks Markdown format, the named MCP servers above.
