import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query, init } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PROD = process.env.NODE_ENV === 'production';
const ADMIN_CODE = process.env.ADMIN_CODE || 'changeme';
if (PROD && ADMIN_CODE === 'changeme') {
  console.warn('[warn] ADMIN_CODE is not set — using insecure default. Set it in Render env vars.');
}

const GROUPS = JSON.parse(readFileSync(join(__dirname, 'shared', 'groups.json'), 'utf8'));
const GROUP_LETTERS = Object.keys(GROUPS); // ['A'..'L']
const codesFor = (g) => GROUPS[g].map((t) => t.code);

// ---- admin auth: cookie value derived from the passcode, so it survives restarts
//      without any server-side session store (fine for a tiny single-instance app).
const adminToken = crypto.createHash('sha256').update('wcp::' + ADMIN_CODE).digest('hex');
const isAdmin = (req) => req.cookies?.wcp_admin === adminToken;
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'admin required' });
  next();
}

const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: PROD, path: '/', maxAge: 1000 * 60 * 60 * 24 * 120 };

const app = express();
app.use(express.json());
app.use(cookieParser());

// ---------- helpers ----------
async function getSettings() {
  const { rows } = await query('SELECT entries_open, picks_revealed FROM settings WHERE id = 1');
  return { entriesOpen: rows[0].entries_open, picksRevealed: rows[0].picks_revealed };
}
async function getResults() {
  const { rows } = await query('SELECT picks, best3rd FROM results WHERE id = 1');
  return { picks: rows[0].picks || {}, best3rd: rows[0].best3rd || [] };
}
async function getPlayerByToken(token) {
  if (!token) return null;
  const { rows } = await query('SELECT * FROM players WHERE token = $1', [token]);
  return rows[0] || null;
}
const publicPlayer = (p) => p && ({
  name: p.name,
  submitted: p.submitted,
  picks: p.picks || null,
  thirdPicks: p.third_picks || null,
  createdAt: p.created_at,
});

// resultsSet count = number of groups with both first & second recorded
function resultsSetCount(results) {
  return GROUP_LETTERS.filter((g) => results.picks[g]?.first && results.picks[g]?.second).length;
}

// Score one player's picks against official results. Only groups with a recorded
// result are scored; best-3rd groups score +2 each when present in official best3rd.
function scorePlayer(player, results) {
  const picks = player.picks || {};
  const thirds = player.third_picks || [];
  const groups = {};
  let groupPoints = 0;
  for (const g of GROUP_LETTERS) {
    const pick = picks[g] || {};
    const real = results.picks[g];
    if (!real?.first || !real?.second) {
      groups[g] = { first: pick.first || null, second: pick.second || null, points: 0, status: 'pending' };
      continue;
    }
    // Exact slot: 1st = 3, 2nd = 2. Otherwise, if the team you named still qualified
    // (finished in the real top 2) but in the wrong slot, it's worth +1. Each of your
    // two picks is judged independently, so a full order-swap earns 1 + 1 = 2.
    let pts = 0;
    if (pick.first) {
      if (pick.first === real.first) pts += 3;
      else if (pick.first === real.second) pts += 1;
    }
    if (pick.second) {
      if (pick.second === real.second) pts += 2;
      else if (pick.second === real.first) pts += 1;
    }
    const status = pts === 5 ? 'hit' : pts === 0 ? 'miss' : 'partial';
    groups[g] = { first: pick.first || null, second: pick.second || null, points: pts, status };
    groupPoints += pts;
  }
  const best3rd = results.best3rd || [];
  const thirdDetail = thirds.map((g) => ({ group: g, correct: best3rd.includes(g) }));
  const thirdHits = thirdDetail.filter((t) => t.correct).length;
  const thirdPoints = thirdHits * 2;
  return {
    total: groupPoints + thirdPoints,
    groupPoints,
    thirdPoints,
    thirdHits,
    thirdTotal: thirds.length,
    groups,
    thirds: thirdDetail,
  };
}

function validateSubmission(picks, thirdPicks) {
  if (typeof picks !== 'object' || picks === null) return 'picks missing';
  for (const g of GROUP_LETTERS) {
    const p = picks[g];
    if (!p || !p.first || !p.second) return `group ${g} incomplete`;
    if (p.first === p.second) return `group ${g}: 1st and 2nd must differ`;
    const codes = codesFor(g);
    if (!codes.includes(p.first) || !codes.includes(p.second)) return `group ${g}: invalid team`;
  }
  if (!Array.isArray(thirdPicks)) return 'thirdPicks missing';
  const uniq = [...new Set(thirdPicks)];
  if (uniq.length !== 8) return 'pick exactly 8 best-3rd groups';
  if (!uniq.every((g) => GROUP_LETTERS.includes(g))) return 'invalid best-3rd group';
  return null;
}

// ---------- public API ----------
app.get('/api/config', async (req, res) => {
  res.json({ groups: GROUPS, settings: await getSettings() });
});

app.get('/api/state', async (req, res) => {
  const player = await getPlayerByToken(req.cookies?.wcp_token);
  res.json({ player: publicPlayer(player), settings: await getSettings(), isAdmin: isAdmin(req) });
});

// Create a new player or resume an existing one on this device.
app.post('/api/player', async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (name.length > 40) return res.status(400).json({ error: 'Name is too long' });
  const nameKey = name.toLowerCase();

  // Already known on this device?
  const existing = await getPlayerByToken(req.cookies?.wcp_token);
  if (existing && existing.name_key === nameKey) {
    return res.json({ player: publicPlayer(existing) });
  }

  const taken = await query('SELECT * FROM players WHERE name_key = $1', [nameKey]);
  if (taken.rows.length) {
    const owner = taken.rows[0];
    // Same device/cookie owns this name -> resume; otherwise it's taken.
    if (req.cookies?.wcp_token && owner.token === req.cookies.wcp_token) {
      return res.json({ player: publicPlayer(owner) });
    }
    return res.status(409).json({ error: 'That name is already taken — pick another.' });
  }

  const token = crypto.randomUUID();
  const { rows } = await query(
    'INSERT INTO players (name, name_key, token) VALUES ($1, $2, $3) RETURNING *',
    [name, nameKey, token],
  );
  res.cookie('wcp_token', token, cookieOpts);
  res.json({ player: publicPlayer(rows[0]) });
});

app.post('/api/submit', async (req, res) => {
  const player = await getPlayerByToken(req.cookies?.wcp_token);
  if (!player) return res.status(401).json({ error: 'Enter your name first.' });
  if (player.submitted) return res.status(409).json({ error: 'Your picks are already locked in.' });
  const { entriesOpen } = await getSettings();
  if (!entriesOpen) return res.status(403).json({ error: 'Entries are closed.' });

  const { picks, thirdPicks } = req.body || {};
  const err = validateSubmission(picks, thirdPicks);
  if (err) return res.status(400).json({ error: err });

  const { rows } = await query(
    `UPDATE players SET picks = $1, third_picks = $2, submitted = TRUE, submitted_at = now()
     WHERE id = $3 RETURNING *`,
    [JSON.stringify(picks), JSON.stringify([...new Set(thirdPicks)]), player.id],
  );
  res.json({ player: publicPlayer(rows[0]) });
});

// Public leaderboard. Fully gated until the admin flips Reveal (admin always sees all).
app.get('/api/leaderboard', async (req, res) => {
  const admin = isAdmin(req);
  const { picksRevealed } = await getSettings();
  const revealed = admin || picksRevealed;

  const { rows: cnt } = await query('SELECT COUNT(*)::int AS n FROM players WHERE submitted = TRUE');
  const entries = cnt[0].n;

  if (!revealed) {
    return res.json({ revealed: false, entries });
  }

  const results = await getResults();
  const { rows } = await query('SELECT * FROM players WHERE submitted = TRUE');
  const scored = rows
    .map((p) => ({ name: p.name, ...scorePlayer(p, results) }))
    .sort((a, b) => b.total - a.total);
  scored.forEach((s, i) => { s.rank = i + 1; });
  res.json({ revealed: true, resultsSet: resultsSetCount(results), entries, players: scored });
});

// ---------- admin API ----------
app.post('/api/admin/login', (req, res) => {
  const code = (req.body?.code || '').trim();
  if (code !== ADMIN_CODE) return res.status(401).json({ error: 'Wrong passcode.' });
  res.cookie('wcp_admin', adminToken, cookieOpts);
  res.json({ ok: true });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('wcp_admin', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/data', requireAdmin, async (req, res) => {
  const settings = await getSettings();
  const results = await getResults();
  const { rows } = await query('SELECT * FROM players ORDER BY created_at ASC');
  const entered = rows.map((p) => ({ name: p.name, submitted: p.submitted, submittedAt: p.submitted_at }));
  const scored = rows
    .filter((p) => p.submitted)
    .map((p) => ({ name: p.name, ...scorePlayer(p, results) }))
    .sort((a, b) => b.total - a.total);
  scored.forEach((s, i) => { s.rank = i + 1; });
  res.json({
    settings,
    results,
    resultsSet: resultsSetCount(results),
    entries: entered,
    entriesIn: entered.filter((e) => e.submitted).length,
    players: scored,
  });
});

app.post('/api/admin/results', requireAdmin, async (req, res) => {
  const { picks, best3rd } = req.body || {};
  const cleanPicks = {};
  if (picks && typeof picks === 'object') {
    for (const g of GROUP_LETTERS) {
      const p = picks[g];
      if (!p) continue;
      const codes = codesFor(g);
      const first = codes.includes(p.first) ? p.first : null;
      const second = codes.includes(p.second) ? p.second : null;
      if (first && second && first === second) continue; // skip invalid
      if (first || second) cleanPicks[g] = { first, second };
    }
  }
  let clean3rd = [];
  if (Array.isArray(best3rd)) {
    clean3rd = [...new Set(best3rd.filter((g) => GROUP_LETTERS.includes(g)))].slice(0, 8);
  }
  await query('UPDATE results SET picks = $1, best3rd = $2 WHERE id = 1', [
    JSON.stringify(cleanPicks),
    JSON.stringify(clean3rd),
  ]);
  res.json({ ok: true, results: await getResults() });
});

app.post('/api/admin/settings', requireAdmin, async (req, res) => {
  const { entriesOpen, picksRevealed } = req.body || {};
  const cur = await getSettings();
  const next = {
    entriesOpen: typeof entriesOpen === 'boolean' ? entriesOpen : cur.entriesOpen,
    picksRevealed: typeof picksRevealed === 'boolean' ? picksRevealed : cur.picksRevealed,
  };
  await query('UPDATE settings SET entries_open = $1, picks_revealed = $2 WHERE id = 1', [
    next.entriesOpen,
    next.picksRevealed,
  ]);
  res.json({ ok: true, settings: next });
});

// ---------- static + pages ----------
app.use(express.static(join(__dirname, 'public')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'public', 'admin.html')));
app.get(['/leaderboard', '/leaderboards'], (req, res) => res.sendFile(join(__dirname, 'public', 'leaderboard.html')));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'public', 'index.html')));

await init();
app.listen(PORT, () => console.log(`World Cup pool running on http://localhost:${PORT}`));
