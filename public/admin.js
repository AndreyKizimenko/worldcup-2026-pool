// ===== World Cup 2026 Prediction Pool — admin app (/admin) =====
const app = document.getElementById('app');

const state = {
  groups: {},
  letters: [],
  screen: 'login',
  data: null,            // admin payload
  rPicks: {},            // results draft { A: {first, second} }
  rBest3rd: [],          // results draft best-3rd groups
  detail: null,          // player being inspected
  error: '',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const teamName = (g, code) => (code ? state.groups[g].find((t) => t.code === code)?.name || code : '—');

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let body = null; try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

(async function boot() {
  try {
    const cfg = await api('/api/config');
    state.groups = cfg.groups;
    state.letters = Object.keys(cfg.groups);
    // Are we already an admin? Try loading data.
    try { state.data = await api('/api/admin/data'); state.screen = 'dash'; }
    catch { state.screen = 'login'; }
  } catch (e) {
    app.innerHTML = `<div class="spinner">Couldn't load.<br>${esc(e.message)}</div>`; return;
  }
  render();
})();

function render() {
  const screens = { login, dash, results, leaderboard };
  app.innerHTML = '<div class="handle-bar"></div>' + (screens[state.screen] || login)();
  bind();
  window.scrollTo(0, 0);
}
function go(s) { state.error = ''; state.screen = s; render(); }
async function refresh() { state.data = await api('/api/admin/data'); }

// ---------- screens ----------
function login() {
  return `
    <div class="center" style="margin-top:30px;">
      <div class="ball">🔒</div>
      <h2 class="title" style="margin-top:12px;">Admin access</h2>
      <div class="sub">/admin · only you have this</div>
    </div>
    <div style="display:flex; flex-direction:column; gap:9px; margin-top:6px;">
      <label class="field-label">PASSCODE</label>
      <input class="text code" id="code" type="password" inputmode="numeric" autocomplete="off" />
      <div class="error" id="err"></div>
      <button class="btn primary" id="unlock">UNLOCK</button>
    </div>
    <div class="note">One shared passcode set via env var. Keeps friends out of results.</div>`;
}

function dash() {
  const d = state.data;
  const s = d.settings;
  const names = d.entries.map((e) => esc(e.name) + (e.submitted ? '' : ' <span style="color:#9a8f5f">(draft)</span>')).join(' · ') || '—';
  return `
    <h2 class="title">Control room</h2>
    <div class="stat-row">
      <div class="stat"><div class="num">${d.entriesIn}</div><div class="lbl">ENTRIES IN</div></div>
      <div class="stat"><div class="num">${d.resultsSet}/12</div><div class="lbl">RESULTS SET</div></div>
    </div>
    <button class="btn primary" id="toresults">ENTER / UPDATE REAL RESULTS</button>
    <button class="btn ghost" id="tolb">VIEW LEADERBOARD</button>
    <div class="toggle-row">
      <div><div class="tt1">CLOSE ENTRIES</div><div class="tt2">lock everyone's picks</div></div>
      <div class="switch ${!s.entriesOpen ? 'on' : ''}" id="t-entries"><span class="knob"></span></div>
    </div>
    <div class="toggle-row olive">
      <div><div class="tt1">REVEAL PICKS TO ALL</div><div class="tt2">friends see who chose what</div></div>
      <div class="switch olive ${s.picksRevealed ? 'on' : ''}" id="t-reveal"><span class="knob"></span></div>
    </div>
    <div class="entered">
      <div class="eh">WHO'S ENTERED</div>
      <div class="names">${names}</div>
    </div>
    <div class="grow1"></div>
    <button class="btn ghost sm" id="logout" style="align-self:center; width:auto;">log out</button>`;
}

function results() {
  const blocks = state.letters.map((g) => {
    const rp = state.rPicks[g] || {};
    const rows = state.groups[g].map((t) => `
      <div class="team">
        <span class="fi fi-${t.iso}"></span>
        <span class="nm">${esc(t.name)}</span>
        <button class="pick-btn first ${rp.first === t.code ? 'on' : ''}" data-g="${g}" data-slot="first" data-code="${t.code}">1ST</button>
        <button class="pick-btn second ${rp.second === t.code ? 'on' : ''}" data-g="${g}" data-slot="second" data-code="${t.code}">2ND</button>
      </div>`).join('');
    return `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:6px;">
      <div class="osw" style="font:700 16px Oswald;">GROUP ${g}</div>${rows}</div>`;
  }).join('');
  const tiles = state.letters.map((g) => {
    const on = state.rBest3rd.includes(g);
    const full = state.rBest3rd.length >= 8;
    return `<span class="chip ${on ? '' : ''}" data-b="${g}" style="cursor:pointer; ${on ? '' : 'background:#d8d0bf; color:#6b6457;'} ${!on && full ? 'opacity:.5;' : ''}">${g}${on ? ' ✓' : ''}</span>`;
  }).join('');
  return `
    <div class="wiz-head"><span class="chev" id="back">‹</span><span class="gname" style="color:var(--accent); font-size:18px;">ACTUAL RESULTS</span><span class="counter"></span></div>
    <div class="hint">Enter how each group <b>really finished</b>. Partial is fine — save anytime.</div>
    ${blocks}
    <div class="best3rd-box">
      <div class="bh">REAL BEST-3RD (pick up to 8) — selected ${state.rBest3rd.length}/8</div>
      <div class="third-summary">${tiles}</div>
    </div>
    <div class="error" id="err"></div>
    <button class="btn ink" id="save">SAVE RESULTS &amp; RESCORE</button>`;
}

function leaderboard() {
  const d = state.data;
  if (state.detail) return detailView(state.detail);
  const players = d.players;
  const head = `<div class="wiz-head"><span class="chev" id="back">‹</span><span class="gname">LEADERBOARD</span><span class="counter"></span></div>`;
  if (!players.length) return head + `<div class="note" style="margin-top:20px;">No entries submitted yet.</div>`;
  const rows = players.map((p) => {
    const gp = p.groupPoints, tp = p.thirdPoints, tot = p.total || 1;
    return `<div class="lb-row ${p.rank === 1 ? 'first' : ''}" data-player="${esc(p.name)}">
      <div class="top"><span class="rk">${p.rank}</span><span class="nm">${esc(p.name)}</span><span class="pts">${p.total}</span></div>
      <div class="bar"><span class="g" style="width:${Math.round((gp / tot) * 100)}%"></span><span class="t" style="width:${Math.round((tp / tot) * 100)}%"></span></div>
      <div class="bd">${gp} group · ${tp} best-3rd · ${p.thirdHits} of ${p.thirdTotal} third hit</div>
    </div>`;
  }).join('');
  return head + `<div class="lb-legend"><span class="swatch ink"></span> group pts <span class="swatch olive" style="margin-left:6px;"></span> best-3rd pts</div>
    ${rows}<div class="note">${d.resultsSet}/12 groups scored. Tap a row for detail.</div>`;
}

function detailView(p) {
  const rows = state.letters.map((g) => {
    const dd = p.groups[g];
    const mark = dd.status === 'hit' ? '✓ +5' : dd.status === 'miss' ? '✗ +0' : dd.status === 'partial' ? `½ +${dd.points}` : '· —';
    return `<div class="detail-row ${dd.status}"><b class="gl">${g}</b><span class="pk">${esc(teamName(g, dd.first))} › ${esc(teamName(g, dd.second))}</span><span class="pp">${mark}</span></div>`;
  }).join('');
  const chips = p.thirds.map((t) => `<span class="chip sm ${t.correct ? 'ok' : 'no'}">${t.group}${t.correct ? '✓' : '✗'}</span>`).join('');
  return `
    <div class="wiz-head"><span class="chev" id="dback">‹</span><span class="gname" style="font-size:20px;">${esc(p.name.toUpperCase())} · ${p.total}</span><span class="counter">#${p.rank}</span></div>
    <div class="sub">Picks vs actual</div>
    ${rows}
    <div class="best3rd-box"><div class="bh">BEST-3RD · ${p.thirdHits} of ${p.thirdTotal} correct (+${p.thirdPoints})</div><div class="third-summary">${chips}</div></div>`;
}

// ---------- binding ----------
function bind() {
  const s = state.screen;
  if (s === 'login') {
    const input = document.getElementById('code');
    const submit = async () => {
      try {
        await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ code: input.value }) });
        await refresh(); go('dash');
      } catch (e) { document.getElementById('err').textContent = e.message; }
    };
    document.getElementById('unlock').onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  if (s === 'dash') {
    document.getElementById('toresults').onclick = () => {
      // seed results draft from saved results
      state.rPicks = JSON.parse(JSON.stringify(state.data.results.picks || {}));
      state.rBest3rd = [...(state.data.results.best3rd || [])];
      go('results');
    };
    document.getElementById('tolb').onclick = () => { state.detail = null; go('leaderboard'); };
    document.getElementById('logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); };
    document.getElementById('t-entries').onclick = async () => {
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ entriesOpen: !state.data.settings.entriesOpen }) });
      await refresh(); render();
    };
    document.getElementById('t-reveal').onclick = async () => {
      await api('/api/admin/settings', { method: 'POST', body: JSON.stringify({ picksRevealed: !state.data.settings.picksRevealed }) });
      await refresh(); render();
    };
  }

  if (s === 'results') {
    app.querySelectorAll('.pick-btn').forEach((b) => {
      b.onclick = () => {
        const g = b.dataset.g, slot = b.dataset.slot, code = b.dataset.code;
        let { first = null, second = null } = state.rPicks[g] || {};
        if (slot === 'first') { if (first === code) first = null; else { first = code; if (second === code) second = null; } }
        else { if (second === code) second = null; else { second = code; if (first === code) first = null; } }
        state.rPicks[g] = { first, second };
        render();
      };
    });
    app.querySelectorAll('[data-b]').forEach((c) => {
      c.onclick = () => {
        const g = c.dataset.b; const i = state.rBest3rd.indexOf(g);
        if (i >= 0) state.rBest3rd.splice(i, 1);
        else if (state.rBest3rd.length < 8) state.rBest3rd.push(g);
        render();
      };
    });
    document.getElementById('back').onclick = () => go('dash');
    document.getElementById('save').onclick = async () => {
      try {
        await api('/api/admin/results', { method: 'POST', body: JSON.stringify({ picks: state.rPicks, best3rd: state.rBest3rd }) });
        await refresh();
        go('dash');
      } catch (e) { document.getElementById('err').textContent = e.message; }
    };
  }

  if (s === 'leaderboard') {
    if (state.detail) {
      document.getElementById('dback').onclick = () => { state.detail = null; render(); };
    } else {
      document.getElementById('back').onclick = () => go('dash');
      app.querySelectorAll('[data-player]').forEach((r) => {
        r.onclick = () => { state.detail = state.data.players.find((x) => x.name === r.dataset.player); render(); };
      });
    }
  }
}
