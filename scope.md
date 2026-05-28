# world cup starting 11 — scope & build guide

> **tournament**: FIFA World Cup 2026 (USA/Canada/Mexico), kicks off June 11, 2026  
> **deadline**: picks lock at first kickoff — ~2 weeks from scope date  
> **build target**: 2 Claude CLI sessions

---

## the game, in one paragraph

you join a private league with a code. you pick exactly 11 players from any World Cup squad: 1 GK and 10 outfield players. picks lock when the tournament starts. as games are played, your players earn points for goals, assists, saves, and results. but here's the twist: if multiple people in your league picked the same player, those players' points are *split equally* among them. the person who found the quiet midfielder no one else picked gets full value. the leaderboard updates after every match. most points at the end of the group stage wins the first prize; most points at the end of the tournament wins overall.

---

## core mechanics

### scoring (per player, per match)

| event | points |
|---|---|
| team wins (outfield) | +3 |
| team draws (outfield) | +1 |
| team wins (GK) | +3 |
| team draws (GK) | +1 |
| goal scored | +5 |
| assist | +3 |
| goalkeeper clean sheet | +5 |
| goalkeeper save | +0.5 |

### point splitting

for each player stat event in a match:
```
your_points += raw_points / count_of_pickers_in_your_league
```

splitting is calculated **per league** — if you're in two leagues and both have 3 people who picked Mbappe, each league splits independently.

### lock rule

all picks lock at **tournament kickoff (June 11, 2026, first whistle)**. no changes after that. late joiners can join the league and view the leaderboard but cannot make picks.

### scoring periods

- **group stage winner**: most cumulative points after all group stage matches complete
- **overall winner**: most cumulative points at the end of the final

---

## data model

```sql
-- core auth: use Supabase built-in auth (magic link only)

leagues
  id uuid PK
  name text
  join_code text UNIQUE (6 chars, uppercase)
  created_by uuid FK users
  picks_locked boolean DEFAULT false
  picks_locked_at timestamptz
  created_at timestamptz

league_members
  id uuid PK
  league_id uuid FK leagues
  user_id uuid FK users
  display_name text  -- their name in the league, set at join time
  created_at timestamptz

picks
  id uuid PK
  member_id uuid FK league_members
  player_id uuid FK players
  slot text CHECK slot IN ('GK', 'outfield')  -- enforced: exactly 1 GK per member
  created_at timestamptz
  UNIQUE (member_id, player_id)
  UNIQUE (member_id, slot) WHERE slot = 'GK'  -- enforce 1 GK

players
  id uuid PK
  api_id integer UNIQUE  -- api-football player ID
  name text
  short_name text  -- display name (e.g. "Mbappé" vs full legal name)
  position text CHECK position IN ('GK', 'DEF', 'MID', 'FWD')
  country text  -- country name
  country_code text  -- 2-char ISO for flag (e.g. 'FR', 'BR', 'DE')
  photo_url text  -- served from api-football CDN
  jersey_number integer
  seeded_at timestamptz

matches
  id uuid PK
  api_id integer UNIQUE
  home_team text
  away_team text
  home_country_code text
  away_country_code text
  home_score integer
  away_score integer
  status text  -- 'scheduled', 'live', 'finished'
  stage text   -- 'group', 'r32', 'r16', 'qf', 'sf', 'final'
  match_date timestamptz
  synced_at timestamptz

player_match_stats
  id uuid PK
  player_id uuid FK players
  match_id uuid FK matches
  goals integer DEFAULT 0
  assists integer DEFAULT 0
  saves integer DEFAULT 0
  minutes_played integer DEFAULT 0
  clean_sheet boolean DEFAULT false
  yellow_card boolean DEFAULT false
  red_card boolean DEFAULT false
  synced_at timestamptz
  UNIQUE (player_id, match_id)
```

**scores are computed on read** (no materialized cache needed at this scale — 5-10 leagues × 10-20 members each). a single SQL query can aggregate all points for a league leaderboard. if performance becomes an issue later, add a `member_scores` cache table and populate it in the sync job.

---

## rls policies

multi-league structure but low security sensitivity — the main rules:

```
leagues: anyone can read. only creator can update/delete.
league_members: members of a league can read all members in that league. users can insert themselves.
picks: members of a league can read all picks in that league (leaderboard needs this). users can only insert/update their own picks (before lock).
players: public read. insert/update only via service role (sync job).
matches: public read. insert/update only via service role.
player_match_stats: public read. insert/update only via service role.
```

---

## app screens

### 1. `/` — home / entry point
- headline + brief game description
- two actions: **create a league** | **join a league** (enter code)
- if user is already auth'd and has leagues, show them directly

### 2. `/join/:code` — join flow
- shows league name + member count
- prompts for display name (what others see in the leaderboard)
- magic link auth if not signed in — email → check inbox → auto-redirect back to this URL
- on join: creates `league_member` record, redirects to `/league/:id`

### 3. `/league/:id` — the main screen
this is where 90% of time is spent. split into two tabs or sections:

**leaderboard tab**
- ranked list of all members
- each row: rank, display name, total points, mini row of their 11 player flags
- tapping a member expands to show their full 11 with per-player point breakdown
- group stage subtotal + overall total if applicable
- "picks not locked yet" banner if tournament hasn't started

**my team tab** (or inline section)
- shows your 11 players (or prompt to pick if not done yet)
- after lock: read-only view with live points per player
- player cards: photo, name, country flag, position badge, points earned

### 4. `/league/:id/pick` — player picker (pre-lock only)
- the hero UI — see design section
- search bar (name search)
- filter chips: All | GK | DEF | MID | FWD | [country flag chips]
- player cards in a grid
- selected players shown in a fixed bottom tray: 11 slots, GK slot visually distinct
- submit button activates when exactly 11 are selected (1 GK + 10 out)

### 5. `/admin` — admin panel (simple, auth-gated to Jake's email)
- list of leagues + member counts
- sync status: last synced, next sync
- manual "sync now" button (triggers the score sync edge function)
- error log if API calls failed

---

## API integration — api-football.com

**signup**: https://www.api-football.com — monthly subscription, cancel anytime

### relevant endpoints (verify these in the API explorer — exact paths may vary by version)

```
GET /players?league={wc_league_id}&season=2026  -- squad rosters
GET /fixtures?league={wc_league_id}&season=2026  -- all matches + results
GET /fixtures/players?fixture={fixture_id}       -- player stats per match
```

> ⚠️ **open for CLI to resolve**: confirm the correct league ID for World Cup 2026. check the API explorer or docs at api-football.com. the World Cup competition ID in v3 of the API has historically been `1` (FIFA World Cup). verify this, and confirm which season parameter applies (likely `2026`).

> ⚠️ **open for CLI to resolve**: api-football serves player photos at a CDN URL included in the player response. store the URL directly in the `players.photo_url` column — don't re-host the images. confirm the URL pattern is stable and doesn't require auth headers (it shouldn't, but verify).

> ⚠️ **open for CLI to resolve**: the free tier has 100 requests/day. with ~700 players across 48 teams, seeding the player table will take 5-10 requests (paginated). match stat syncs are 1 request per completed fixture. with up to 3-4 matches per day during the group stage, the free tier is borderline. evaluate whether to use the Pro tier from the start or implement request batching carefully.

### score sync job

implement as a **Vercel cron function** at `api/sync-scores.ts`:

```
schedule: every 3 hours during tournament (adjust to more frequent if needed)
logic:
  1. fetch all fixtures with status = 'FT' (full time) where synced_at is null
  2. for each unsynchronized fixture, fetch player stats
  3. upsert into player_match_stats
  4. mark match as synced
  5. log result
```

use Supabase service role key for all writes in this function (bypasses RLS).

> ⚠️ **open for CLI to resolve**: Vercel cron syntax in vercel.json. confirm whether edge functions or serverless functions are better suited for this (edge functions have a 30s limit — fine for this use case, but verify). alternatively, consider a Supabase edge function with pg_cron if Vercel cron proves complex.

---

## design direction

### philosophy
this is not a SaaS dashboard. it's a tournament. the design should feel alive — bold, rich, flag-colored. think ESPN app meets FIFA's visual language, not Notion or Linear.

### palette — dark mode first

```css
/* establish these as CSS variables / Tailwind config */
--background: #08090e         /* near-black, slight blue tint */
--surface: #12141f            /* card backgrounds */
--surface-raised: #1c1f2e     /* elevated cards, modals */
--border: #2a2d3e             /* subtle borders */
--text-primary: #f0f2ff       /* main text */
--text-muted: #6b7280         /* secondary text */
--accent-gold: #f5c518        /* tournament gold — rankings, wins */
--accent-green: #22c55e       /* goals, positive events */
--accent-blue: #3b82f6        /* links, CTAs */
```

shadcn/ui provides the component structure — override its CSS variables to match this palette in `globals.css`. do this in the very first commit so every component inherits it.

### the player card — core UI unit

every player appears as a card throughout the app. consistent design:

```
┌────────────────────────────┐
│  [country flag gradient bg] │
│  [player photo, centered]   │
│  ┌──────────────────────┐   │
│  │ MBAPPE              │   │
│  │ FWD  🇫🇷  #10       │   │
│  │ 24.5 pts            │   │
│  └──────────────────────┘   │
└────────────────────────────┘
```

- the card background uses a subtle gradient derived from the country's flag colors (can be hardcoded per country or approximated with a country→color map — see open decision below)
- player photo centered, cropped to head/shoulders
- position badge: color-coded (GK = amber, DEF = blue, MID = green, FWD = red)
- points shown only after tournament starts

> ⚠️ **open for CLI to decide**: flag gradient backgrounds — two options:
>   - **option A**: hardcode a `country_colors` map (e.g. France = #002395/white, Brazil = #009c3b/gold) — ~48 entries, tedious but precise
>   - **option B**: use the flag image itself and a CSS `background-blend-mode` trick to create a washed-out gradient effect — less work, less precise
>   - recommend trying option B first; fall back to A if it looks bad

### flags

use **flagcdn.com** — free, no auth, reliable.

```
https://flagcdn.com/w80/{country_code}.png    // player card
https://flagcdn.com/w40/{country_code}.png    // leaderboard row chips
```

country_code = lowercase 2-char ISO (e.g. `fr`, `br`, `de`, `us`)

### the player picker — most important screen

this is where users spend the most time and form their opinion of the app. make it great.

- **dark background**, player cards in a responsive grid (2-col mobile, 3-col tablet, 4-col desktop)
- **sticky search + filter bar** at top
- **fixed bottom tray**: 11 slots shown as small circles. the GK slot has a distinct visual (different color, labeled "GK"). fills in as you pick.
- **selected state**: selected cards get a colored border + checkmark overlay, not removed from the grid (lets you see who else you could swap)
- **GK enforcement**: if you try to select a second GK, show a toast "swap your GK first" and highlight the current GK slot
- smooth transitions on card select/deselect (framer-motion or simple CSS transitions)

### leaderboard

- rank numbers in bold gold for top 3
- each row expands on tap to reveal the member's 11 with per-player points
- mini flag row (small flag chips) shown collapsed so you can scan the whole board at a glance
- live badge on players currently in an active match (if implementing real-time — see below)

### mobile-first specifics

- bottom navigation: **Leaderboard** | **My Team** | **Pick** (disabled after lock)
- player cards: 2-column grid on mobile
- bottom picker tray: scrollable horizontal row of selected player chips above the submit button
- all tap targets ≥ 44px

---

## tech stack

```
framework:    Vite + React + TypeScript
ui:           shadcn/ui (dark mode theme, customized)
styling:      Tailwind CSS (with custom color config)
auth:         Supabase magic link (email only)
database:     Supabase Postgres
realtime:     optional — Supabase realtime subscriptions for live leaderboard
hosting:      Vercel
cron:         Vercel cron functions
api:          api-football.com v3
```

### project structure

```
world-cup-11/
  src/
    components/
      PlayerCard.tsx       -- the core card component
      PlayerPicker.tsx     -- picker UI + tray
      Leaderboard.tsx      -- league standings
      TeamView.tsx         -- member's 11, post-lock
    pages/
      Home.tsx
      Join.tsx
      League.tsx
      Pick.tsx
      Admin.tsx
    lib/
      supabase.ts          -- supabase client
      scoring.ts           -- score computation logic
      api-football.ts      -- API client wrapper
    types/
      index.ts             -- shared types matching DB schema
  api/
    sync-scores.ts         -- Vercel cron function
    seed-players.ts        -- one-time player seeding endpoint
  supabase/
    migrations/
      001_initial_schema.sql
```

---

## session plan

### session 1 — foundation (~3 hrs)

1. create GitHub repo + Supabase project (dev + prod)
2. scaffold Vite app, configure shadcn/ui with dark theme
3. set up Supabase schema (migration 001)
4. implement magic link auth flow
5. implement league create + join flow
6. call api-football, seed players table (verify API endpoints work)
7. build player picker UI with real player data

**end of session 1**: a working app where you can create a league, join it, and pick your 11 from real World Cup players.

### session 2 — scoring + polish (~2-3 hrs)

1. build score computation query
2. build leaderboard screen
3. implement sync-scores cron function
4. player photos + flag gradients
5. mobile responsive pass
6. deploy to Vercel prod
7. smoke test end-to-end: create league → join → pick → simulate score sync → see leaderboard

**end of session 2**: fully deployed, shareable app.

---

## open decisions summary (for CLI to resolve)

| # | decision | guidance |
|---|---|---|
| 1 | api-football World Cup 2026 league ID | check `/leagues?name=world+cup&season=2026` in API explorer |
| 2 | player photo URL stability | fetch one player, confirm photo URL is public CDN with no auth |
| 3 | free vs paid API tier | 100 req/day free — evaluate after seeing squad + fixture counts |
| 4 | Vercel cron vs Supabase edge function for sync | Vercel cron preferred; fall back to Supabase pg_cron if issues |
| 5 | flag gradient approach (hardcoded colors vs CSS blend) | try CSS blend first |
| 6 | real-time leaderboard (Supabase realtime vs polling) | polling every 60s is fine for v1; real-time is a nice-to-have |
| 7 | score computation: on-read vs cached | on-read for v1; add cache if leaderboard feels slow |

---

## non-goals (v1)

- no player transfer/swap after lock
- no push notifications
- no bracket prediction
- no social features (comments, reactions)
- no public league discovery
- no automated league creation by users outside Jake's invite
- no knockout stage tiebreaker rules (total points is sufficient)

---

## environment setup checklist

before session 1 starts:

- [x] sign up at api-football.com, get API key
- [x] create `world-cup-11` GitHub repo (public)
- [x] create two Supabase projects: `world-cup-11-dev` and `world-cup-11-prod`
- [x] create Vercel project connected to the GitHub repo
- [x] note both Supabase project refs + anon keys + service role keys
- [ ] confirm api-football World Cup 2026 competition is available (check dashboard)

---

## session 1 handoff — for claude cowork

> **status as of 2026-05-28**: infrastructure complete, app scaffolded and deployed, auth broken. pick up from here.

### what exists

**git repo**: https://github.com/jakefromri/world-cup-11  
local path: `skunkworks/world-cup-starting-11/`

**vercel**: https://world-cup-starting-11.vercel.app  
project name: `world-cup-starting-11` (under jake-7675s-projects)

**supabase dev**: project ref `hktcxoumldzgbnbhjytj`  
**supabase prod**: project ref `wspafzifrnpkfzpglkqn`  
all keys are in `.credentials` (gitignored, in the project root)

### environment variables

set in Vercel (preview = dev supabase, production = prod supabase):

```
VITE_SUPABASE_URL          — supabase project URL (public)
VITE_SUPABASE_ANON_KEY     — supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY  — supabase service role key (secret, server-side only)
API_FOOTBALL_KEY           — api-football.com v3 API key (secret)
```

local dev: copy `.credentials` values into `.env.local` using the same names.

### what was built in session 1

**schema**: migration `supabase/migrations/001_initial_schema.sql` — applied to dev. tables: `leagues`, `league_members`, `players`, `picks`, `matches`, `player_match_stats`. full RLS policies in place. confirmed visible in supabase dashboard.

**app**: full Vite + React + TypeScript scaffold with:
- dark theme (custom CSS variables matching scope palette)
- tailwind CSS v4 + shadcn-style components (Button, Input, Toast)
- react-router-dom with all routes wired
- pages: Home, Login, AuthCallback, Join, League, Pick, Admin
- components: PlayerCard, PlayerPicker (GK enforcement + 11-slot tray), Leaderboard
- `src/hooks/useAuth.ts` — supabase session hook
- `src/lib/supabase.ts` — supabase client
- `src/lib/scoring.ts` — point computation logic (stub, needs real query)
- `src/types/index.ts` — full type definitions

**vercel API functions**:
- `api/seed-players.ts` — seeds players table from api-football `/players/squads`
- `api/sync-scores.ts` — syncs finished match stats from api-football

**vercel.json**: cron removed (hobby plan limitation). score sync needs an alternative — recommend supabase pg_cron or a daily vercel cron (free tier allows 1/day).

### what is broken / not done

**auth was broken** — cowork fixed two issues on 2026-05-28:

**fix 1 — PKCE token exchange (cowork, committed)**  
`AuthCallback.tsx` was rewritten. Supabase v2 magic links use PKCE by default: the email link lands on `/auth/callback?code=XXXX`, and the app must call `supabase.auth.exchangeCodeForSession(code)` explicitly to get a session. The old version only listened to `onAuthStateChange` which never fires without the exchange. Fixed.

**fix 2 — login page cleanup (cowork, committed)**  
The password fallback field was removed from `Login.tsx`. App is magic-link only as originally scoped. The test user (`jakericciardi@gmail.com` / `WCtest2026!`) still exists in the dev Supabase project if you need it for quick testing — you can re-add the password field temporarily, or just use the Supabase dashboard to confirm the user exists.

**still needs a dashboard step — Supabase redirect URL**  
Before magic links will work, the callback URL must be whitelisted in Supabase:
1. Go to Supabase dashboard → Authentication → URL Configuration
2. Under **Redirect URLs**, add:
   - `http://localhost:5173/auth/callback`
   - `https://world-cup-starting-11.vercel.app/auth/callback`
   - `https://world-cup-starting-11-*.vercel.app/auth/callback` (covers preview deploys)
3. Save. Without this, magic link emails are sent but the redirect is blocked silently.

**still needs SMTP verification**  
Supabase dev projects have a 2 emails/hour rate limit on the built-in emailer. Resend SMTP was configured via management API but wasn't confirmed working. To verify:
- Go to Supabase dashboard → Authentication → Logs — check if outbound emails show "resend" as provider
- If still rate-limiting, the Resend SMTP config needs a verified domain. The Resend API key is in `.credentials`
- Alternative for dev/testing: use Supabase's "Email OTP" mode and confirm the 6-digit code manually (works without SMTP setup)

### what to do next (session 2 scope)

once auth is working:

1. **verify create league flow** — sign in with password, create a league, confirm redirect to `/league/:id` with join code visible
2. **verify join flow** — open join URL in incognito, join the league, confirm `league_members` row created in supabase
3. **seed players** — call `POST /api/seed-players` (from admin page or curl with service role key). this will populate the players table from api-football. verify the league ID for World Cup 2026 is correct (scope notes league ID `1` — confirm this in api-football dashboard before seeding).
4. **verify pick flow** — go to `/league/:id/pick`, pick 11 players, submit, confirm `picks` rows in supabase
5. **score computation** — the leaderboard currently shows 0 points for everyone. needs a SQL query that computes `raw_points / picker_count` per player per league. this is the core game mechanic — see `src/lib/scoring.ts` and `src/components/Leaderboard.tsx`
6. **cron for score sync** — set up supabase pg_cron to call `sync-scores` every 3 hours during tournament: `select cron.schedule('sync-scores', '0 */3 * * *', $$select net.http_post(...)$$)`
7. **mobile responsive pass** — check on phone, tighten spacing
8. **prod deploy** — push schema to prod supabase, merge to main, verify on prod URL

### known issues / gotchas

- `vercel deploy` without `--prod` flag deploys a preview (new URL each time), not the aliased `world-cup-starting-11.vercel.app`. use `vercel deploy --prod` for the canonical URL.
- supabase `db push` always pushes to the linked project — verify with `cat supabase/.temp/project-ref` before running. re-link with `supabase link --project-ref [REF]` to switch.
- the `players` table is empty until seed-players is called. the Pick page shows an empty state message for this.
- `src/lib/supabase.ts` uses `createClient<any>()` (no typed Database generic) to avoid TS errors — types are in `src/types/index.ts` instead.
