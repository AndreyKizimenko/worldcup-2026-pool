// ===== World Cup 2026 Prediction Pool — public leaderboard (/leaderboard) =====
// Locked until the organizer flips "Reveal picks to all". Once revealed: ranked
// standings, tap a row for the full pick-by-pick breakdown vs the real results.
const app = document.getElementById('app');

const state = { groups: {}, letters: [], data: null, detail: null };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const teamName = (g, code) => (code ? state.groups[g].find((t) => t.code === code)?.name || code : '—');

async function api(path) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } });
  let body = null; try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

(async function boot() {
  try {
    const cfg = await api('/api/config');
    state.groups = cfg.groups;
    state.letters = Object.keys(cfg.groups);
    state.data = await api('/api/leaderboard');
  } catch (e) {
    app.innerHTML = `<div class="spinner">Couldn't load the leaderboard.<br>${esc(e.message)}</div>`;
    return;
  }
  render();
})();

function render() {
  app.innerHTML = '<div class="handle-bar"></div>' + (state.detail ? detailView(state.detail) : board());
  bind();
  window.scrollTo(0, 0);
}

function header(showBack) {
  return `<div class="wiz-head">
    ${showBack ? '<span class="chev" id="back">‹</span>' : '<span style="width:30px;"></span>'}
    <span class="gname">LEADERBOARD</span>
    <span class="counter"></span></div>`;
}

function board() {
  const d = state.data;
  // Locked: organizer hasn't revealed yet.
  if (!d.revealed) {
    return header(false) + `
      <div class="center" style="margin-top:26px;">
        <div class="ball">🔒</div>
        <h2 class="title" style="margin-top:12px;">Not revealed yet</h2>
        <div class="sub" style="margin-top:8px;">Standings and everyone's picks unlock here once the organizer reveals them. Hang tight.</div>
      </div>
      <div class="note" style="margin-top:14px;">${d.entries} ${d.entries === 1 ? 'entry' : 'entries'} in so far.</div>
      <div class="grow1"></div>
      <a class="btn ghost" href="/" style="text-decoration:none;">← BACK TO THE POOL</a>`;
  }
  // Revealed but no results scored yet.
  if (!d.players.length || d.resultsSet === 0) {
    return header(false) + `
      <div class="center" style="margin-top:26px;">
        <div class="ball">⚽</div>
        <h2 class="title" style="margin-top:12px;">Results coming soon</h2>
        <div class="sub" style="margin-top:8px;">${d.players.length} ${d.players.length === 1 ? 'entry is' : 'entries are'} in. Standings fill in as the organizer enters real group results.</div>
      </div>
      <div class="grow1"></div>
      <a class="btn ghost" href="/" style="text-decoration:none;">← BACK TO THE POOL</a>`;
  }
  const rows = d.players.map((p) => {
    const gp = p.groupPoints, tp = p.thirdPoints, tot = p.total || 1;
    return `<div class="lb-row ${p.rank === 1 ? 'first' : ''}" data-player="${esc(p.name)}">
      <div class="top"><span class="rk">${p.rank}</span><span class="nm">${esc(p.name)}</span><span class="pts">${p.total}</span></div>
      <div class="bar"><span class="g" style="width:${Math.round((gp / tot) * 100)}%"></span><span class="t" style="width:${Math.round((tp / tot) * 100)}%"></span></div>
      <div class="bd">${gp} group · ${tp} best-3rd · ${p.thirdHits} of ${p.thirdTotal} third hit</div>
    </div>`;
  }).join('');
  return header(false) + `
    <div class="lb-legend"><span class="swatch ink"></span> group pts <span class="swatch olive" style="margin-left:6px;"></span> best-3rd pts</div>
    ${rows}
    <div class="note">${d.resultsSet}/12 groups scored. Tap anyone for their pick-by-pick breakdown.</div>`;
}

function detailView(p) {
  const rows = state.letters.map((g) => {
    const dd = p.groups[g];
    const mark = dd.status === 'hit' ? '✓ +5' : dd.status === 'miss' ? '✗ +0' : dd.status === 'partial' ? `½ +${dd.points}` : '· —';
    return `<div class="detail-row ${dd.status}"><b class="gl">${g}</b><span class="pk">${esc(teamName(g, dd.first))} › ${esc(teamName(g, dd.second))}</span><span class="pp">${mark}</span></div>`;
  }).join('');
  const chips = p.thirds.map((t) => `<span class="chip sm ${t.correct ? 'ok' : 'no'}">${t.group}${t.correct ? '✓' : '✗'}</span>`).join('');
  return `
    <div class="wiz-head"><span class="chev" id="back">‹</span><span class="gname" style="font-size:20px;">${esc(p.name.toUpperCase())} · ${p.total}</span><span class="counter">#${p.rank}</span></div>
    <div class="sub">Picks vs actual · ✓ hit · ✗ miss · ½ partial</div>
    ${rows}
    <div class="best3rd-box"><div class="bh">BEST-3RD · ${p.thirdHits} of ${p.thirdTotal} correct (+${p.thirdPoints})</div><div class="third-summary">${chips}</div></div>`;
}

function bind() {
  if (state.detail) {
    document.getElementById('back').onclick = () => { state.detail = null; render(); };
    return;
  }
  app.querySelectorAll('[data-player]').forEach((r) => {
    r.onclick = () => { state.detail = state.data.players.find((x) => x.name === r.dataset.player); render(); };
  });
}
