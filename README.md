# World Cup 2026 — Prediction Pool ⚽

A tiny mobile-first web app for a private group of friends to predict the 2026 FIFA
World Cup group stage, auto-score each other, and crown a winner. Built from the
`design_handoff_worldcup_pool` spec.

- **Players** open one shared link, type a name (no signup), pick the **winner + runner-up**
  for all 12 groups, then choose the **8 of 12 groups** whose 3rd-place team advances, and
  **lock in** (final — no edits).
- **Organizer** (`/admin`) enters the real results as the tournament unfolds; everyone is
  auto-scored. Picks stay hidden from friends until the organizer flips **Reveal**.
- **Public leaderboard** (`/leaderboard`) stays locked ("not revealed yet") until the
  organizer flips Reveal — then it shows ranked standings, and tapping any player opens
  their full pick-by-pick breakdown vs the real results.

**Scoring (max 76):** correct group winner = **3**, correct runner-up = **2**,
each correct best-3rd group = **2** (8 to pick). 12×5 + 8×2 = **76**.

## Run locally

```bash
npm install
ADMIN_CODE=1234 npm start      # http://localhost:3000  ·  admin at /admin
```

With no `DATABASE_URL` set, the app stores data in an in-process Postgres (PGlite) file
under `./.data` — zero setup. Set `DATABASE_URL` to use real Postgres.

## Deploy free on Render + Neon

The pool must persist picks for weeks, but **Render's free web service has no persistent
disk** (it's wiped on every restart/redeploy). So we use a **free hosted Postgres (Neon)**
for storage — the app + DB are both $0.

1. **Create the database (Neon — free):**
   - Sign up at <https://neon.tech> → create a project.
   - Copy the **connection string** (looks like `postgresql://...@...neon.tech/...?sslmode=require`).
   - Tables are created automatically on first boot — nothing else to set up.

2. **Push this folder to a GitHub repo.**

3. **Deploy on Render (free):**
   - <https://render.com> → **New + → Blueprint** → pick the repo (uses `render.yaml`), or
     **New + → Web Service** with build `npm install` and start `npm start`.
   - Set environment variables in the Render dashboard:
     - `ADMIN_CODE` — your private admin passcode.
     - `DATABASE_URL` — the Neon connection string from step 1.
     - `NODE_ENV` = `production`.
   - Deploy. Share the resulting `https://<name>.onrender.com` link with friends.

> **Free-tier note:** a free Render service sleeps after ~15 min idle, so the first visit
> after a quiet spell takes a few seconds to wake. Data is safe in Neon regardless. If you
> want zero cold starts, bump Render to the ~$7/mo Starter plan (DB stays free).

## Admin guide (`/admin`)

- **Unlock** with `ADMIN_CODE`.
- **Control room:** entries count, results progress, and two toggles:
  - **Close entries** — stops new submissions (flip at the deadline / first kickoff).
  - **Reveal picks to all** — unlocks the public `/leaderboard` (standings + everyone's picks) for friends (off by default).
- **Enter / update real results:** set the real 1st & 2nd per group and mark the real 8
  best-3rd groups. Partial is fine — save anytime; everyone is re-scored instantly.
- **Leaderboard:** ranked totals with a group-vs-best-3rd breakdown; tap a row for the
  pick-by-pick detail.

## Editing the pool copy

The two house rules and the entry-fee reminder live at the top of
[`public/app.js`](public/app.js) as `ENTRY_FEE` and `ENTRY_DEADLINE` constants —
change them in one place. Teams/flags are in [`shared/groups.json`](shared/groups.json)
(real Dec 5 2025 draw; flags via the `flag-icons` library keyed by ISO code).

## Stack

Node + Express, vanilla-JS SPA (no build step), Postgres (`pg` in prod / PGlite locally),
`flag-icons` for real flags. Admin is gated by a passcode env var; the admin cookie is
derived from the passcode (no server-side session store needed).
