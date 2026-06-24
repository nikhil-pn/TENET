# `coach` Edge Function — managed-key AI proxy

Holds the **single OpenRouter API key** (a Supabase secret) so end users get the AI
Coach **for free** without their own key. Requires a signed-in user; builds the
prompt + pins the model server-side so a client can't run an expensive call.

The app calls it via `supabase.functions.invoke("coach", { body: { digest } })`
(see `lib/ai/provider.ts`), which auto-attaches the user's auth token.

## One-time setup (owner only)

1. **Get an OpenRouter key**
   - Sign in at <https://openrouter.ai> → **Credits** → add $5–$10 (this balance funds all users).
   - **Keys** → *Create Key* (name it "TENET Coach") → copy `sk-or-...`.
   - On that key, **set a spend limit** — your hard cost ceiling.

2. **Install + link the Supabase CLI** (once)
   ```bash
   npm i -g supabase            # or: brew install supabase/tap/supabase
   supabase login
   supabase link --project-ref jfxbltohhirevwunyipd
   ```

3. **Set the key as a secret** (this is the "server-side ENV" — never in the app bundle)
   ```bash
   supabase secrets set OPENROUTER_API_KEY=sk-or-xxxxxxxx
   # optional override (defaults to deepseek/deepseek-chat):
   # supabase secrets set COACH_MODEL=deepseek/deepseek-chat
   ```
   *(Or do it in the dashboard: Project → Edge Functions → Manage secrets.)*

4. **Deploy the function**
   ```bash
   supabase functions deploy coach
   ```
   `verify_jwt` stays on (default), and the function additionally checks for a real
   user, so anonymous callers are rejected.

5. **Test**: open the app, sign in, open **Coach**, enable the AI review. With ≥10
   active days of data you'll get an AI-written review; otherwise the deterministic
   templated one.

## Notes
- **Provider switch:** change `COACH_MODEL` (any OpenRouter model id) or, to use a
  different host, edit `OPENROUTER_URL`/headers in `index.ts` and redeploy. No app
  redeploy needed.
- **Cost:** ~$0.0006 per weekly review. The client caches per ISO week, so opening
  the panel does not re-call. The OpenRouter spend limit is the backstop.
- **Privacy:** only the derived digest (counts/ratios + ≤5 truncated task titles)
  is sent — never note bodies. Routed with `zdr: true` (zero data retention).
