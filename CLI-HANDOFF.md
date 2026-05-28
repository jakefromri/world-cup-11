# session 2 handoff — world cup starting 11

paste this prompt into claude CLI from inside `skunkworks/world-cup-starting-11/`

---

## prompt

We're resuming work on `world-cup-starting-11`, a World Cup fantasy game built in Vite + React + TypeScript + Supabase. The full scope is in `scope.md` — read that first for full context on the game mechanics, data model, and design direction.

**infrastructure already in place:**
- GitHub repo: https://github.com/jakefromri/world-cup-11
- Vercel project: https://world-cup-starting-11.vercel.app (connected to GitHub)
- Supabase dev project ref: `hktcxoumldzgbnbhjytj`
- Supabase prod project ref: `wspafzifrnpkfzpglkqn`
- All keys are in `.credentials` (gitignored). Copy values to `.env.local` as needed.
- Schema migration (`supabase/migrations/001_initial_schema.sql`) is applied to dev. Tables: `leagues`, `league_members`, `players`, `picks`, `matches`, `player_match_stats`. RLS policies in place.

**what was just fixed in cowork (already committed):**
1. `src/pages/AuthCallback.tsx` — now properly calls `supabase.auth.exchangeCodeForSession(code)` for Supabase v2 PKCE flow. Magic links land on `/auth/callback?code=XXXX` — the code must be exchanged explicitly.
2. `src/pages/Login.tsx` — password field removed. Magic link only.

**before anything else — one required dashboard step:**
Go to Supabase dashboard → Authentication → URL Configuration → Redirect URLs and add:
- `http://localhost:5173/auth/callback`
- `https://world-cup-starting-11.vercel.app/auth/callback`
- `https://world-cup-starting-11-*.vercel.app/auth/callback`

Without this, magic link emails arrive but the redirect is silently blocked. This cannot be done in code — it must be done in the dashboard.

**then verify SMTP is routing through Resend (not Supabase's built-in emailer):**
Supabase dev limits built-in email to 2/hour. Resend SMTP was previously configured but not confirmed. Check: Supabase dashboard → Authentication → Logs → see if outgoing emails show Resend as provider. If not, the Resend config needs a verified sender domain. Resend API key is in `.credentials`.

---

**session 2 goals — work through these in order:**

1. **confirm auth works end-to-end**
   - add redirect URLs in Supabase dashboard (above)
   - run `npm run dev`, go to http://localhost:5173, enter your email, click the magic link, confirm you land on the home page authenticated
   - if magic links still fail due to SMTP: re-add a temporary password field to Login.tsx for local testing (test user `jakericciardi@gmail.com` / `WCtest2026!` exists in dev Supabase)

2. **seed the players table**
   - call `POST /api/seed-players` — this hits api-football and populates the `players` table
   - before running: confirm the World Cup 2026 league ID in the api-football dashboard (scope notes it's likely `1` — verify this first, wrong ID = empty seed)
   - run with: `curl -X POST http://localhost:3000/api/seed-players -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`
   - or trigger from the `/admin` page once auth is working
   - verify: check `players` table in Supabase — should have ~700 rows with `photo_url` populated

3. **smoke test the full game flow**
   - create a league → copy join code → open incognito → join with a different email → both users pick their 11 → confirm `picks` rows in Supabase

4. **wire up score computation in the leaderboard**
   - `src/components/Leaderboard.tsx` currently shows `totalPoints: 0` for everyone
   - `src/lib/scoring.ts` has a stub — implement the actual SQL aggregation query
   - the scoring formula: for each player a member picked, sum their raw points divided by the count of members in that league who also picked that player
   - raw points come from `player_match_stats` joined to `matches` (wins, draws, goals, assists, saves, clean sheets)
   - see scoring table in scope.md for exact point values

5. **set up score sync cron**
   - `vercel.json` is currently `{}` — Vercel hobby plan allows 1 cron/day (runs at midnight UTC)
   - add to vercel.json:
     ```json
     {
       "crons": [{ "path": "/api/sync-scores", "schedule": "0 0 * * *" }]
     }
     ```
   - for more frequent syncs during the tournament, set up Supabase pg_cron instead:
     ```sql
     select cron.schedule(
       'sync-scores',
       '0 */3 * * *',
       $$select net.http_post(
         url := 'https://world-cup-starting-11.vercel.app/api/sync-scores',
         headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
       )$$
     );
     ```

6. **mobile responsive pass**
   - test in Chrome DevTools at 390px width (iPhone 14)
   - picker tray and filter chips are the most likely pain points
   - player cards should be 2-col on mobile, 3-col on tablet, 4-col on desktop

7. **prod deploy**
   - `supabase link --project-ref wspafzifrnpkfzpglkqn` then `supabase db push` to push schema to prod
   - `vercel deploy --prod` to deploy to the canonical URL
   - re-add the Supabase redirect URLs for the prod URL in the prod Supabase project dashboard
   - smoke test on prod

---

**known gotchas (don't get tripped up):**
- `vercel deploy` without `--prod` = preview URL, not the canonical domain. always use `--prod`.
- `supabase db push` always targets the linked project. verify with `cat supabase/.temp/project-ref` before running.
- `players` table is empty until seed runs. The Pick page shows "players not seeded yet" — that's expected.
- the api-football `seed-players` script is at `api/seed-players.ts`. it's a Vercel serverless function — run it via HTTP, not directly with node.
- scoring is computed on-read in the leaderboard query (no cache table). fine at this scale (5-10 leagues).
