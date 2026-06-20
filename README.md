# TENET

A minimalist, **local-first** personal productivity web app — Pomodoro timer + to-do list +
day-planner/calendar + habit streaks + **Eisenhower (Warikoo) prioritization & time-audit** +
notes/reminders, with an **opt-in cloud layer** (Supabase auth + sync + a GitHub accountability
streak).

> Working on the code? Read **`CLAUDE.md`** first — it's the source of truth for architecture and
> conventions. This README focuses on **what the cloud layer is and how to set it up.**

---

## How it works at two levels

**1. Local-first (always on, no setup).** The app reads and writes the browser's `localStorage`
instantly and works fully offline. All persistence funnels through one seam, `lib/persist.ts`
(`readJSON`/`writeJSON`). Data is portable JSON. If you do nothing else, TENET is a complete,
private, offline app.

**2. Cloud (opt-in, switched on by two env vars).** Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and the app gains:
- **Login** with GitHub or Google (Supabase Auth).
- **Cloud sync** of your todos / habits / day-logs / notes across devices.
- An **immutable focus ledger** of every completed Pomodoro.
- A real **GitHub contribution-graph streak** — finishing a focus session commits to a `tenet-log`
  repo, so your green squares reflect your focus.

If those env vars are **absent**, every cloud call no-ops and the app behaves exactly like the
local-only version. The cloud is purely additive.

---

## The cloud layer, explained

### Data flow

```
┌─────────────┐   writeJSON()    ┌──────────────┐
│     UI      │ ───────────────► │ localStorage │   ← instant, offline, the source the UI reads
└─────────────┘                  └──────┬───────┘
                                        │ subscribeWrites()  (the ONE hook the cloud attaches to)
                                        ▼
                                 ┌──────────────┐   RLS, per-user rows
                                 │   Supabase   │ ◄── pull-on-login merge + debounced push
                                 │   Postgres   │
                                 └──────────────┘

Pomodoro completes ──► insert pomodoro_sessions (immutable ledger)
                   └──► GitHub Contents API ──► 1 commit/day to tenet-log (green square)
```

### What GitHub does

Two separate jobs:
1. **Login** — GitHub is an OAuth provider for Supabase Auth. You click "Sign in with GitHub",
   GitHub redirects to **Supabase** (`/auth/v1/callback`), Supabase creates your session and
   redirects back to the app's `/auth/callback` page.
2. **The streak** — we request the `repo` scope during login, so Supabase hands back a GitHub
   **`provider_token`**. The app uses that token to call the GitHub **Contents API** directly from
   the browser (GitHub's API allows CORS) and append a line to `log/<year>.md` in your `tenet-log`
   repo. One commit per active day ⇒ one green square. Code: `lib/githubStreak.ts`,
   token captured in `lib/cloud/auth.ts`.

### What Supabase does

- **Auth** — GitHub/Google OAuth, session management. No passwords stored by us.
- **Postgres database** — one table per data type (`todos`, `habits`, `day_logs`, `notes`,
  `pomodoro_sessions`, `profiles`). Schema + security live in `supabase/migrations/0001_init.sql`.
- **Row-Level Security (RLS)** — every table restricts rows to their owner
  (`auth.uid() = user_id`). This is why the **anon key is safe to ship publicly**: the database
  itself refuses to return anyone else's data. Without a logged-in session you get nothing.

### Sync model (local-first, single user, multi-device)

`lib/cloud/sync.ts`:
- **Pull on login** — fetch the user's rows, merge into local state with **per-record
  last-write-wins** (each record carries an `updatedAt` stamp). A per-table "snapshot" of the
  last-seen server state lets the merge tell a *remote delete* (drop it locally) from a *local
  create* (keep & upload it).
- **Push on change** — the `subscribeWrites()` hook fires on every local save; the dirty table is
  pushed (debounced ~1.5s) as an idempotent upsert, with removed records deleted.
- **Known v1 limits (acceptable for one user):** sync runs on login + on change, not realtime; the
  same record edited offline on two devices resolves by whichever syncs later. Realtime push is a
  future enhancement.

### Accountability & immutability

The **`pomodoro_sessions`** table is the tamper-proof record: it has a **server-set timestamp** and
**only SELECT + INSERT** RLS policies — there is **no UPDATE or DELETE policy, so even you cannot
edit or remove a past session**. That is the honest accountability ledger.

> ⚠️ **Honest caveat:** a GitHub contribution square follows the commit's *author-date*, which can
> be backdated. So the **green graph is motivation, not proof** — the immutable Postgres ledger is
> the truth. The squares ride on top of it.

### Out of scope (deliberately, to keep it simple)

No Markdown-file data mirror, no Obsidian-vault integration, no in-app AI. Obsidian stays a separate
tool; a future app↔Obsidian bridge is parked, not built.

---

## This project's live Supabase instance

These values are **public and safe to commit** — the anon key is meant to ship in the client
bundle, and Row-Level Security is what actually protects the data.

| What | Value |
| --- | --- |
| Supabase project ref | `jfxbltohhirevwunyipd` |
| Project URL | `https://jfxbltohhirevwunyipd.supabase.co` |
| Anon (public) key | the JWT in `.env.local` / Vercel env (`role: anon`) |
| GitHub OAuth callback (set in the GitHub OAuth App) | `https://jfxbltohhirevwunyipd.supabase.co/auth/v1/callback` |
| App redirect URLs (allow-listed in Supabase Auth → URL Config) | `http://localhost:3000/auth/callback` and the deployed URL's `/auth/callback` |
| Dashboard | https://supabase.com/dashboard/project/jfxbltohhirevwunyipd |

**Secrets — NOT stored in this repo (and must never be):**
- **Database password** — lives only in your password manager; the app never uses it (anon key only).
- **GitHub OAuth Client Secret** — lives only in the Supabase dashboard (Auth → Providers → GitHub).

The local config file `.env.local` holds the URL + anon key and is **gitignored** (`.env*`). See
`.env.example` for the template.

---

## Set up the cloud from scratch (new Supabase project)

If you ever rebuild the backend, this is the full sequence:

1. **Create a Supabase project** (https://supabase.com/dashboard → New project). Copy the
   **Project URL** + **anon key** from Settings → API.
2. **Load the schema** — SQL Editor → paste `supabase/migrations/0001_init.sql` → Run. Verify the
   six tables appear in the Table Editor.
3. **GitHub OAuth App** (https://github.com/settings/developers → New OAuth App):
   - Homepage: your app URL · Callback: `https://<ref>.supabase.co/auth/v1/callback`
   - Generate a client secret; in Supabase → Auth → Providers → **GitHub**, enable it and paste the
     Client ID + Secret.
4. **Allow-list redirects** — Supabase → Auth → URL Configuration: set **Site URL** and add
   `<your-url>/auth/callback` to **Redirect URLs** (add both localhost and production).
5. **Env vars** — copy `.env.example` → `.env.local`, fill in `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. *(Optional)* **Google login** — create an OAuth client in Google Cloud, use the same Supabase
   callback URL, enable Google in Supabase → Auth → Providers.

---

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000 (Turbopack)
npm run build      # static export to ./out
npx tsc --noEmit   # type-check
npm run lint
```

Use **port 3000** for OAuth — it's the redirect URL allow-listed in Supabase. If 3000 is taken,
free it (or add the alternate port's `/auth/callback` to the Supabase allow-list).

---

## Deploy (Vercel)

1. https://vercel.com → import the GitHub repo `nikhil-pn/TENET`.
2. Add env vars **`NEXT_PUBLIC_SUPABASE_URL`** and **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** (same values
   as `.env.local`).
3. Deploy → you get a `*.vercel.app` URL.
4. **Important:** add `https://<your-vercel-url>/auth/callback` to Supabase → Auth → URL
   Configuration → Redirect URLs, and set the Site URL. Update the GitHub OAuth App's Homepage URL.
   (The GitHub/Google callback URL stays the Supabase one — don't change it.)

The build is a **static export** (`output: "export"`); there is no server of ours to run — the
Supabase client and OAuth callback are entirely client-side.

---

## Where the code lives

| Area | Files |
| --- | --- |
| Storage seam | `lib/persist.ts` (`readJSON`/`writeJSON`/`subscribeWrites`) |
| Domain logic (pure TS) | `lib/storage.ts`, `lib/habits.ts`, `lib/daylog.ts`, `lib/notes.ts`, `lib/deadlines.ts`, `lib/prioritization.ts`, `lib/session.ts`, `lib/dates.ts` |
| Focus ledger | `lib/pomodoroLog.ts` (local mirror + cloud insert) |
| Cloud client | `lib/supabase.ts` (env-gated singleton, `cloudEnabled`) |
| Cloud auth | `lib/cloud/auth.ts` (OAuth, `provider_token` capture) |
| Cloud sync | `lib/cloud/sync.ts` (pull/merge/push) |
| GitHub streak | `lib/githubStreak.ts` |
| DB schema + RLS | `supabase/migrations/0001_init.sql` |
| UI | `app/page.tsx`, `app/components/*` (`AuthButton`, `NotesPanel`, panels), `app/auth/callback/page.tsx` |

Types for everything: `lib/types.ts`.
