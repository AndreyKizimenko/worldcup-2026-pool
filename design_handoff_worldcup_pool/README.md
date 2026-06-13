# Handoff: World Cup 2026 Prediction Pool

## Overview
A tiny web app for a private group of friends to predict the 2026 FIFA World Cup group stage, score each other, and crown a winner. The flow:

1. A friend opens a shared link, types their **name** (no signup/password).
2. They pick the **winner** and **runner-up** for each of the **12 groups** (A–L).
3. As a final step they choose **8 of the 12 groups** whose **3rd-place team** they think will advance to the Round of 32 (the real tournament admits the 8 best third-placed teams).
4. They **lock in** their picks. **Picks are final on submit — no edits afterwards.**
5. The organizer (admin) privately **enters the real results** as the tournament unfolds, the app **auto-scores** everyone, and the organizer can **reveal** everyone's picks and the leaderboard when ready.

**Scoring (max 76 points):**
- Correct group **winner** = **3**
- Correct group **runner-up** = **2**
- Each correct **best-3rd group** = **2** (8 to pick)
- Max per group = 5 → 12 × 5 = 60, plus 8 × 2 = 16 → **76 total**

## About the Design Files
The file in this bundle (`World Cup Pool Wireframes.dc.html`) is a **design reference created in HTML** — a low-fidelity wireframe showing the intended screens, structure, copy, and behavior. **It is not production code to copy directly.** The task is to **build a real, working app** that implements these screens and the behavior described below, choosing an appropriate framework/stack (see "Recommended Stack & Hosting").

The wireframe represents flags as small grey boxes with 3-letter country codes — **the real build should use real country flags** (see "Assets").

## Fidelity
**Low-fidelity (lofi).** Use the wireframe as the guide for **layout, flow, and functionality**, but apply clean, real styling in the build. The intended visual direction is **retro / vintage football** (cream paper, ink, a single vintage-red accent, condensed display type) — see "Visual Direction" for tokens if you want to honor it, but the structure and behavior are what matter most.

---

## Screens / Views

### PLAYER FLOW (mobile-first — friends open on phones)

#### 1. Welcome / Enter name
- **Purpose:** Capture the player's name and start them off.
- **Layout:** Single centered column. Title block ("WORLD CUP 26" / tagline), then a name text input, then a primary "LET'S GO →" button. Footer note: "No password · no signup. Name only."
- **Behavior:** Name is required to proceed. Store the name (e.g. in a cookie/localStorage) so a returning visitor on the same device is recognized and taken to their (read-only, if submitted) picks rather than starting over. **Names should be unique within the pool** — if a name already exists, either resume that player (same device/cookie) or prompt to pick a different name.

#### 2. How it works
- **Purpose:** Explain the 2-step task and the scoring before they start.
- **Layout:** Title "HOW IT WORKS", two numbered steps, a dashed "POINTS" box listing the three scoring rules, then a "START PICKING" button.
- **Copy (exact):**
  - Step 1: "Pick the **winner** & **runner-up** for all 12 groups."
  - Step 2: "Choose **8 of 12 groups** whose 3rd-place team sneaks into the round of 32."
  - Points: "Correct group winner — 3 / Correct runner-up — 2 / Each correct best-3rd team — 2"

#### 3. Group prediction wizard (one group per screen, ×12)
- **Purpose:** Pick 1st and 2nd for a single group.
- **Layout:** Header row = back chevron `‹`, group title ("GROUP A"), step counter ("1 / 12"). Below it a 12-segment progress bar. Then a hint line ("Who finishes **1st** & **2nd**?"). Then **4 team rows**. Footer = "BACK" + "NEXT GROUP →".
- **Team row:** flag (left) + team name (flex-fill) + two toggle buttons "1ST" and "2ND".
- **Behavior:**
  - Tapping "1ST" on a team marks it the winner; tapping "2ND" marks it runner-up.
  - A team can't be both; selecting 1st on one team while it's currently 2nd should move it. **Only one 1st and one 2nd per group**, and they must be different teams (selecting a team as 1st should clear it from 2nd and vice-versa, and clear whichever other team previously held that slot).
  - **"NEXT GROUP" is disabled until both 1st and 2nd are chosen** (shown greyed/dashed in the empty-state wireframe frame).
  - Progress bar fills as groups are completed; current group highlighted.
- **States shown in wireframe:** a completed group (Group A, MEX 1st / KOR 2nd) and an empty mid-flow group (Group H) with the disabled "NEXT" button.

#### 4. Best 3rd-place step (final pick step)
- **Purpose:** Choose the 8 of 12 groups whose 3rd-place team will advance.
- **Layout:** Header (`‹`, "BEST 3RD PLACES", "LAST STEP"). Instruction line. A "SELECTED — n / 8" counter chip. A **2-column grid of 12 group tiles** (A–L). Primary button "REVIEW MY PICKS →".
- **Group tile:** group letter (e.g. "GROUP B") + a small line of the group's non-top-2 candidate teams (3-letter codes), and a selected/unselected visual state (filled olive-green when selected, with a ✓).
- **Behavior:**
  - This is modelled at the **GROUP level** (decision locked): the player selects 8 groups, not specific teams.
  - Cap at **exactly 8**. Once 8 are selected, unselected tiles are disabled/greyed; to choose a different one the player must deselect a selected tile first.
  - "REVIEW" enabled only when exactly 8 are selected.

#### 5. Review & lock in
- **Purpose:** Final check of all picks before submitting.
- **Layout:** Title "REVIEW & LOCK IN", player name, a scrollable summary list of all 12 groups (format: `A  Mexico › S. Korea`) each with an edit pencil, then a summary of the 8 best-3rd groups. Primary button "🔒 LOCK IN MY PICKS". Warning line: "once you lock in, picks are final. No edits."
- **Behavior:**
  - Tapping a row jumps back to that group/the 3rd-place step to change it — **only before submitting.**
  - "LOCK IN" persists the player's full prediction to the shared database and transitions to the confirmation screen.
  - After lock-in, **the player can no longer edit** (see screen 6).

#### 6. Confirmation / share
- **Purpose:** Confirm submission and let them invite friends.
- **Layout:** Celebratory header ("You're in, {name}!"), a dashed "INVITE YOUR FRIENDS" box with the app URL + "COPY" button, and a secondary "VIEW MY PICKS · locked" button (read-only).
- **Behavior:** "COPY" copies the pool URL to clipboard. "VIEW MY PICKS" shows their submitted picks read-only. **No edit affordance** — submission is final.

### ADMIN FLOW (organizer only)

#### 7. Admin login
- **Purpose:** Gate the admin area.
- **Layout:** Lock icon, "ADMIN ACCESS", "/admin · only you have this", a passcode input, "UNLOCK" button.
- **Behavior:** A single shared passcode (stored as an **environment variable**, not in client code). Reachable at a non-obvious route (e.g. `/admin`). On success, set an admin session.

#### 8. Admin dashboard ("Control room")
- **Purpose:** Overview + global controls.
- **Layout:** Title "CONTROL ROOM". Two stat tiles ("ENTRIES IN" count, "RESULTS SET" e.g. 6/12). Two primary actions: "ENTER / UPDATE REAL RESULTS", "VIEW LEADERBOARD". Two labelled **toggles**:
  - **CLOSE ENTRIES** — "lock everyone's picks" (stops new submissions; e.g. flip at first kickoff).
  - **REVEAL PICKS TO ALL** — "friends see who chose what" (off by default).
  - A "WHO'S ENTERED" list of names.
- **Behavior:** Toggles flip the corresponding `Settings` flags. Reveal is **off until the admin turns it on**; until then friends cannot see others' picks or the detailed leaderboard.

#### 9. Enter real results
- **Purpose:** Record actual outcomes; triggers re-scoring.
- **Layout:** Same group picker UI as the player wizard but headed "ACTUAL RESULTS" — set the real 1st & 2nd per group. Plus a dashed box "REAL BEST-3RD (8 of 12)" where the admin marks which 8 groups' third-place teams actually advanced. Button "SAVE RESULTS & RESCORE".
- **Behavior:** Admin can enter results group-by-group as they happen (partial results allowed; the dashboard shows "n/12 set"). Saving recomputes every player's score.

#### 10. Leaderboard
- **Purpose:** Ranked standings with breakdown.
- **Layout:** Title "LEADERBOARD", a legend (group pts = ink, best-3rd pts = olive). Each player row: rank number, name, total points (right, accent for #1), a **stacked horizontal bar** splitting group-points vs best-3rd-points, and a small breakdown line ("30 group · 10 best-3rd · 5 of 8 third hit"). Tap a row → player detail (screen 11).
- **Behavior:** Sorted by total descending. Updates whenever results change.

#### 11. Player detail / reveal (pick vs actual)
- **Purpose:** Show one player's picks scored against reality.
- **Layout:** Header (name + total). A list of groups, each row tinted **green (hit)**, **red (miss)**, or **amber (partial — e.g. only one of 1st/2nd right)** with the points earned (`✓ +5`, `✗ +0`, `½ +3`). A dashed "BEST-3RD · n of 8 correct" box with per-group ✓/✗ chips.
- **Behavior:** **Only visible to friends after the admin flips "Reveal picks" on.** The admin can always see it. Before reveal, players can see their own total but not others' detailed picks.

---

## Interactions & Behavior (summary)
- **Navigation:** Player flow is a linear wizard: Welcome → How it works → Group 1…12 → Best-3rd → Review → Confirmation. Back chevron steps backward; progress bar reflects position.
- **Validation:** Each group requires exactly one 1st and one 2nd (distinct teams) before advancing. Best-3rd step requires exactly 8 selected. Name required at start.
- **Locking:** Once a player submits, their picks are immutable. Admin "Close entries" additionally prevents any new submissions globally.
- **Reveal gating:** Others' picks and the detailed per-player breakdown are hidden until the admin reveals.
- **Re-scoring:** Automatic whenever results are saved/changed.
- **Responsive:** Mobile-first (designed at ~332px wide phone frames). Should work fine on desktop too, but optimize for phones.
- **Tie-breaker:** None in-app — the admin resolves ties manually if they occur.

## State Management
Client state per player session: `name`, current wizard step, in-progress `picks` (per-group {first, second}), in-progress `thirdPicks` (array of group letters), submitted flag.
Global/server state: all players + their submitted picks, the official `Results`, and `Settings` (entriesOpen, picksRevealed).

## Data Model
```
Player      { id, name, createdAt }
Pick        { playerId, group: 'A'..'L', first: teamCode, second: teamCode }   // one row per player per group
ThirdPicks  { playerId, groups: ['B','C','E',...] }   // exactly 8 group letters
Results     { group: 'A'..'L', first: teamCode, second: teamCode },            // official, per group
            best3rdGroups: ['B','C',...]              // exactly 8 group letters, official
Settings    { entriesOpen: bool, picksRevealed: bool, adminCode: <env var> }
```
Scoring per player: for each group, +3 if first matches official first, +2 if second matches official second; for best-3rd, +2 for each picked group that is in the official `best3rdGroups`. Sum = total (cap 76).

## The 12 Groups (real 2026 draw — Dec 5 2025)
Use these exact teams. Top-2 are the typical seeds but players choose freely; the codes are FIFA-style 3-letter codes for flag mapping.

- **A:** Mexico (MEX), South Korea (KOR), Czechia (CZE), South Africa (RSA)
- **B:** Canada (CAN), Switzerland (SUI), Qatar (QAT), Bosnia & Herzegovina (BIH)
- **C:** Brazil (BRA), Morocco (MAR), Scotland (SCO), Haiti (HAI)
- **D:** USA (USA), Paraguay (PAR), Australia (AUS), Türkiye (TUR)
- **E:** Germany (GER), Ecuador (ECU), Côte d'Ivoire (CIV), Curaçao (CUW)
- **F:** Netherlands (NED), Japan (JPN), Sweden (SWE), Tunisia (TUN)
- **G:** Belgium (BEL), Egypt (EGY), Iran (IRN), New Zealand (NZL)
- **H:** Spain (ESP), Uruguay (URU), Saudi Arabia (KSA), Cape Verde (CPV)
- **I:** France (FRA), Senegal (SEN), Iraq (IRQ), Norway (NOR)
- **J:** Argentina (ARG), Algeria (ALG), Austria (AUT), Jordan (JOR)
- **K:** Portugal (POR), Colombia (COL), Uzbekistan (UZB), DR Congo (COD)
- **L:** England (ENG), Croatia (CRO), Ghana (GHA), Panama (PAN)

*(Verify codes against your flag asset source; ALG/IRN/etc. vary by library — ALG vs DZA, IRN, GHA, etc.)*

## Recommended Stack & Hosting
Because each friend opens the link on **their own phone**, the app needs **shared server-side storage** — browser localStorage will NOT sync between people. The data is tiny (~10 players), so free tiers are plenty. This is a **~$0 project**, nowhere near $60/mo.

Options (any work):
- **Render free web service + SQLite** (simplest single-service deploy; note: free service cold-starts after ~15 min idle).
- **Render Starter (~$7/mo) + free hosted Postgres** (Neon/Supabase) — no cold start.
- **Vercel Hobby (free) + Neon/Supabase/Turso (free)** — serverless API routes + managed DB.

A small full-stack app (e.g. a single Node/Express or Next.js service with SQLite/Postgres) is the right size. Keep the admin passcode in an env var.

## Visual Direction (optional — lofi, restyle freely)
Retro / vintage football. If honoring it:
- **Paper / surface:** `#f6f0e2` (cream), rows `#fbf7ec`
- **Ink (text/borders):** `#211d17`, muted text `#6b6457`, faint borders `#cfc4ab`
- **Accent (primary / winner):** vintage red `#c0492f`
- **Runner-up fill:** ink `#211d17`
- **Best-3rd / secondary accent:** olive `#7a6f3f`
- **Hit / miss / partial:** green `#3f7a4a` / red `#c0492f` / amber `#7a6f3f`
- **Type:** condensed display (wireframe used **Oswald**) for headers/numbers; clean sans (Helvetica/system) for body; the wireframe uses a handwritten face (Caveat) only for annotations — not needed in the build.
- **Radii:** ~11–12px on cards/buttons, ~26px on the phone frame (frame is wireframe-only).

## Assets
- **Flags:** need real country flags for all 48 teams. Use a flag library/sprite (e.g. `flag-icons`, `circle-flags`, or SVG flag set) keyed by ISO country code — map the 3-letter codes above to your library's keys. No flag images are bundled here.
- No other images required.

## Files
- `World Cup Pool Wireframes.dc.html` — the low-fi wireframe board with all 12 screens (player flow + admin flow) and an embedded build-spec card. Open in a browser to view. *(It is a streaming "Design Component"; if it doesn't render standalone, just read it as markup — every screen is laid out as a labelled phone frame.)*
