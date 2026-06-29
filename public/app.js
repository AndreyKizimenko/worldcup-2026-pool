// ===== World Cup 2026 Prediction Pool — player app =====
// Single-file vanilla SPA. State machine over the linear wizard.

// ---- Pool rules / copy (edit these freely) ----
const ENTRY_FEE = '$20';
const ENTRY_DEADLINE = 'EOD Saturday, June 14';

const app = document.getElementById('app');
const LS_KEY = 'wcp_progress';

const state = {
  groups: {},
  letters: [],
  settings: { entriesOpen: true, picksRevealed: false },
  player: null,           // { name, submitted, picks, thirdPicks }
  screen: 'welcome',
  // in-progress draft
  picks: {},              // { A: {first, second}, ... }
  thirdPicks: [],         // [ 'B', 'C', ... ]
  wizIndex: 0,            // 0..11
  error: '',
};

// ---------- helpers ----------
const flag = (iso) => `<span class="fi fi-${iso}"></span>`;
const teamByCode = (g, code) => state.groups[g].find((t) => t.code === code);
const teamName = (g, code) => (code ? teamByCode(g, code)?.name || code : '—');
const shortName = (n) => (n && n.length > 11 ? n.split(' ').map((w, i) => (i === 0 ? w[0] + '.' : w)).join(' ') : n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

function saveDraft() {
  if (!state.player) return;
  localStorage.setItem(LS_KEY, JSON.stringify({
    name: state.player.name, picks: state.picks, thirdPicks: state.thirdPicks, wizIndex: state.wizIndex,
  }));
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (d && state.player && d.name === state.player.name) {
      state.picks = d.picks || {};
      state.thirdPicks = d.thirdPicks || [];
      state.wizIndex = d.wizIndex || 0;
      return true;
    }
  } catch {}
  return false;
}
const groupComplete = (g) => {
  const p = state.picks[g];
  return p && p.first && p.second && p.first !== p.second;
};
const allGroupsComplete = () => state.letters.every(groupComplete);

// ---------- boot ----------
(async function boot() {
  try {
    const cfg = await api('/api/config');
    state.groups = cfg.groups;
    state.letters = Object.keys(cfg.groups);
    const st = await api('/api/state');
    state.settings = st.settings;
    state.player = st.player;

    if (state.player?.submitted) {
      state.screen = 'confirm';
    } else if (state.player) {
      const had = loadDraft();
      state.screen = had ? 'wizard' : 'how';
    } else {
      state.screen = 'welcome';
    }
  } catch (e) {
    app.innerHTML = `<div class="spinner">Couldn't load the pool.<br>${esc(e.message)}</div>`;
    return;
  }
  render();
})();

// ---------- router ----------
function render() {
  const screens = {
    welcome, how, wizard, third, review, confirm, viewpicks, closed,
  };
  // Block the picking flow once entries are closed (unless already submitted).
  if (!state.settings.entriesOpen && !state.player?.submitted &&
      ['how', 'wizard', 'third', 'review'].includes(state.screen)) {
    state.screen = 'closed';
  }
  app.innerHTML = '<div class="handle-bar"></div>' + (screens[state.screen] || welcome)();
  bind();
  app.scrollTop = 0;
  window.scrollTo(0, 0);
}
function go(screen) { state.error = ''; state.screen = screen; render(); }

// ---------- screens ----------
function welcome() {
  return `
    <div class="center" style="margin-top:8px;">
      <div class="kicker">Prediction Pool</div>
      <h1 class="title" style="margin-top:6px;">World<br>Cup 26</h1>
      <div class="tagline" style="margin-top:6px;">Think you know ball? Prove it.</div>
    </div>
    <hr class="divider" />
    <div class="rules">
      <div class="rules-head">House rules</div>
      <div class="rule"><span class="emoji">💵</span><span><b>${ENTRY_FEE} to play</b> — winner takes the whole pot. We'll sort out collecting it with you.</span></div>
      <div class="rule"><span class="emoji">🔒</span><span><b>Get your picks in by ${ENTRY_DEADLINE}.</b> That's when entries lock for good.</span></div>
      <div class="rule"><span class="emoji">🔎</span><span>Research is fair game — ask your friends, ask an AI, whatever. We can't stop you anyway.</span></div>
    </div>
    <div style="display:flex; flex-direction:column; gap:9px; margin-top:4px;">
      <label class="field-label" for="name">WHAT'S YOUR NAME?</label>
      <input class="text" id="name" placeholder="e.g. Marco" autocomplete="name" maxlength="40" />
      <div class="error" id="err"></div>
      <button class="btn primary" id="go">LET'S GO →</button>
    </div>
    <div class="note">No password · no signup. Name only.</div>`;
}

function how() {
  return `
    <h2 class="title">How it works</h2>
    <div class="steps">
      <div class="step"><span class="n">1</span><span class="t">Pick the <b>winner</b> &amp; <b>runner-up</b> for all 12 groups.</span></div>
      <div class="step"><span class="n">2</span><span class="t">Choose <b>8 of 12 groups</b> whose 3rd-place team sneaks into the round of 32.</span></div>
    </div>
    <div class="points">
      <div class="ph">POINTS</div>
      <div class="pr"><span>Correct group winner</span><b>3</b></div>
      <div class="pr"><span>Correct runner-up</span><b>2</b></div>
      <div class="pr"><span>Right team, wrong spot</span><b>1</b></div>
      <div class="pr"><span>Each correct best-3rd team</span><b>2</b></div>
    </div>
    <div class="note">Max possible = 76 points</div>
    <div class="grow1"></div>
    <button class="btn ink" id="start">START PICKING</button>`;
}

function wizard() {
  const g = state.letters[state.wizIndex];
  const teams = state.groups[g];
  const pick = state.picks[g] || {};
  const idx = state.wizIndex;
  const rows = teams.map((t) => `
    <div class="team">
      <span class="fi fi-${t.iso}"></span>
      <span class="nm">${esc(t.name)}</span>
      <button class="pick-btn first ${pick.first === t.code ? 'on' : ''}" data-slot="first" data-code="${t.code}">1ST</button>
      <button class="pick-btn second ${pick.second === t.code ? 'on' : ''}" data-slot="second" data-code="${t.code}">2ND</button>
    </div>`).join('');
  const bars = state.letters.map((L, i) => {
    const cls = i === idx ? 'cur' : groupComplete(L) ? 'done' : '';
    return `<span class="${cls}"></span>`;
  }).join('');
  const ready = groupComplete(g);
  return `
    <div class="wiz-head">
      <span class="chev" id="back">‹</span>
      <span class="gname">GROUP ${g}</span>
      <span class="counter">${idx + 1} / 12</span>
    </div>
    <div class="progress">${bars}</div>
    <div class="hint">Who finishes <b style="color:var(--accent)">1st</b> &amp; <b style="color:var(--ink)">2nd</b>?</div>
    ${rows}
    <div class="grow1"></div>
    <div class="row-btns">
      <button class="btn sm ghost" id="prev">BACK</button>
      <button class="btn primary grow" id="next" ${ready ? '' : 'disabled'}>${idx === 11 ? 'BEST 3RD →' : 'NEXT GROUP →'}</button>
    </div>`;
}

function third() {
  const n = state.thirdPicks.length;
  const full = n >= 8;
  const tiles = state.letters.map((g) => {
    const on = state.thirdPicks.includes(g);
    const codes = state.groups[g].map((t) => t.code).join(' / ');
    const disabled = !on && full;
    return `<div class="tile ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}" data-g="${g}">
      <div class="tg">GROUP ${g}${on ? ' ✓' : ''}</div>
      <div class="tt">${codes}</div>
    </div>`;
  }).join('');
  return `
    <div class="wiz-head">
      <span class="chev" id="back">‹</span>
      <span class="gname" style="font-size:18px;">BEST 3RD PLACES</span>
      <span class="counter">LAST</span>
    </div>
    <div class="hint">8 of the 12 third-place teams advance. <b>Tap the 8 groups</b> whose 3rd-place team you think makes it. <b style="color:var(--olive)">2 pts each.</b></div>
    <div class="counter-chip"><span class="l">SELECTED</span><span class="v">${n} / 8</span></div>
    <div class="tiles">${tiles}</div>
    ${full ? '' : '<div class="note">Pick ' + (8 - n) + ' more</div>'}
    <button class="btn primary" id="reviewbtn" ${full ? '' : 'disabled'}>REVIEW MY PICKS →</button>`;
}

function review() {
  const rows = state.letters.map((g) => {
    const p = state.picks[g] || {};
    return `<div class="review-row" data-jump="${g}">
      <span><span class="gl">${g}</span>${esc(shortName(teamName(g, p.first)))} <span class="arr">› ${esc(shortName(teamName(g, p.second)))}</span></span>
      <span class="pencil">✎</span>
    </div>`;
  }).join('');
  const thirds = [...state.thirdPicks].sort().map((g) => `<span class="chip">${g}</span>`).join('');
  return `
    <h2 class="title">Review &amp; lock in</h2>
    <div class="sub">${esc(state.player?.name || '')} · tap any row to edit</div>
    <div class="review-list">${rows}</div>
    <div class="review-row" data-jump-third="1" style="border:1.5px solid var(--faint); border-radius:11px; padding:9px;">
      <span><span class="gl">3RD</span>8 best-3rd groups</span><span class="pencil">✎</span>
    </div>
    <div class="third-summary">${thirds}</div>
    <div class="error" id="err"></div>
    <button class="btn ink" id="lockin">🔒 LOCK IN MY PICKS</button>
    <div class="warn">Heads up — once you lock in, picks are final. No edits.</div>`;
}

function confirm() {
  const url = window.location.origin;
  return `
    <div class="center" style="margin-top:18px;">
      <div class="ball">⚽</div>
      <h2 class="title" style="margin-top:10px;">You're in,<br>${esc(state.player?.name || '')}!</h2>
      <div class="sub" style="margin-top:8px;">Your picks are locked &amp; saved.</div>
    </div>
    <div class="rules" style="border-style:dashed;">
      <div class="rule"><span class="emoji">💵</span><span>Heads up — it's <b>${ENTRY_FEE}</b> to play. We'll sort out payment details with you.</span></div>
    </div>
    <div class="invite">
      <label class="field-label">INVITE YOUR FRIENDS</label>
      <div class="url"><div class="u" id="poolurl">${esc(url)}</div><button class="btn sm ghost" id="copy" style="background:var(--gold);">COPY</button></div>
    </div>
    <div class="grow1"></div>
    <button class="btn ghost" id="viewbtn">VIEW MY PICKS · <span class="locked-badge">locked</span></button>`;
}

function viewpicks() {
  const p = state.player;
  const rows = state.letters.map((g) => {
    const pk = p.picks?.[g] || {};
    return `<div class="review-row" style="cursor:default;">
      <span><span class="gl">${g}</span>${esc(teamName(g, pk.first))} <span class="arr">› ${esc(teamName(g, pk.second))}</span></span>
    </div>`;
  }).join('');
  const thirds = [...(p.thirdPicks || [])].sort().map((g) => `<span class="chip">${g}</span>`).join('');
  return `
    <div class="wiz-head"><span class="chev" id="back">‹</span><span class="gname" style="font-size:20px;">MY PICKS</span><span class="counter"></span></div>
    <div class="sub">${esc(p.name)} · <span class="locked-badge">locked</span></div>
    <div class="review-list">${rows}</div>
    <div class="best3rd-box"><div class="bh">MY 8 BEST-3RD GROUPS</div><div class="third-summary">${thirds}</div></div>`;
}

function closed() {
  return `
    <div class="center" style="margin-top:30px;">
      <div class="ball">🔒</div>
      <h2 class="title" style="margin-top:12px;">Entries are closed</h2>
      <div class="sub" style="margin-top:8px;">The deadline has passed and picks are locked for everyone. Check back for the leaderboard.</div>
    </div>
    <div class="grow1"></div>
    <a class="btn ghost" href="/leaderboard" style="text-decoration:none;">VIEW LEADERBOARD</a>`;
}

// ---------- event binding ----------
function bind() {
  const s = state.screen;
  if (s === 'welcome') {
    const input = document.getElementById('name');
    const submit = async () => {
      const name = input.value.trim();
      const err = document.getElementById('err');
      if (!name) { err.textContent = 'Enter your name to start.'; return; }
      try {
        const r = await api('/api/player', { method: 'POST', body: JSON.stringify({ name }) });
        state.player = r.player;
        if (state.player.submitted) { go('confirm'); return; }
        loadDraft();
        go('how');
      } catch (e) { err.textContent = e.message; }
    };
    document.getElementById('go').onclick = submit;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    input.focus();
  }

  if (s === 'how') {
    document.getElementById('start').onclick = () => { state.wizIndex = 0; go('wizard'); };
  }

  if (s === 'wizard') {
    const g = state.letters[state.wizIndex];
    app.querySelectorAll('.pick-btn').forEach((b) => {
      b.onclick = () => { pick(g, b.dataset.slot, b.dataset.code); saveDraft(); render(); };
    });
    document.getElementById('back').onclick = goBackFromWizard;
    document.getElementById('prev').onclick = goBackFromWizard;
    document.getElementById('next').onclick = () => {
      if (!groupComplete(g)) return;
      if (state.wizIndex === 11) { go('third'); }
      else { state.wizIndex++; saveDraft(); render(); }
    };
  }

  if (s === 'third') {
    app.querySelectorAll('.tile').forEach((t) => {
      t.onclick = () => {
        const g = t.dataset.g;
        const i = state.thirdPicks.indexOf(g);
        if (i >= 0) state.thirdPicks.splice(i, 1);
        else if (state.thirdPicks.length < 8) state.thirdPicks.push(g);
        saveDraft(); render();
      };
    });
    document.getElementById('back').onclick = () => { state.wizIndex = 11; go('wizard'); };
    document.getElementById('reviewbtn').onclick = () => { if (state.thirdPicks.length === 8) go('review'); };
  }

  if (s === 'review') {
    app.querySelectorAll('[data-jump]').forEach((r) => {
      r.onclick = () => { state.wizIndex = state.letters.indexOf(r.dataset.jump); go('wizard'); };
    });
    const tj = app.querySelector('[data-jump-third]');
    if (tj) tj.onclick = () => go('third');
    document.getElementById('lockin').onclick = lockIn;
  }

  if (s === 'confirm') {
    document.getElementById('copy').onclick = async (e) => {
      try { await navigator.clipboard.writeText(window.location.origin); e.target.textContent = 'COPIED'; }
      catch { const r = document.createRange(); r.selectNode(document.getElementById('poolurl')); window.getSelection().removeAllRanges(); window.getSelection().addRange(r); e.target.textContent = 'SELECT+COPY'; }
      setTimeout(() => { e.target.textContent = 'COPY'; }, 1500);
    };
    document.getElementById('viewbtn').onclick = () => go('viewpicks');
  }

  if (s === 'viewpicks') {
    document.getElementById('back').onclick = () => go('confirm');
  }
}

function goBackFromWizard() {
  if (state.wizIndex === 0) { go('how'); }
  else { state.wizIndex--; render(); }
}

function pick(g, slot, code) {
  let { first = null, second = null } = state.picks[g] || {};
  if (slot === 'first') {
    if (first === code) first = null;
    else { first = code; if (second === code) second = null; }
  } else {
    if (second === code) second = null;
    else { second = code; if (first === code) first = null; }
  }
  state.picks[g] = { first, second };
}

async function lockIn() {
  const err = document.getElementById('err');
  if (!allGroupsComplete()) { err.textContent = 'Finish all 12 groups first.'; return; }
  if (state.thirdPicks.length !== 8) { err.textContent = 'Pick exactly 8 best-3rd groups.'; return; }
  try {
    const r = await api('/api/submit', {
      method: 'POST',
      body: JSON.stringify({ picks: state.picks, thirdPicks: state.thirdPicks }),
    });
    state.player = r.player;
    localStorage.removeItem(LS_KEY);
    go('confirm');
  } catch (e) { err.textContent = e.message; }
}
