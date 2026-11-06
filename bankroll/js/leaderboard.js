/* Bankroll · leaderboard: "Today" (UTC) and "All time" boards, plus the biggest multipliers.
   Two backends, picked automatically:
   - mahbod.me (or any host configured by window.BANKROLL_CONFIG): Supabase. The server issues each run
     (bankroll_start_run) and the bankroll-verify function replays the run's moves to work out its score, so
     players never send scores themselves. See supabase/bankroll-leaderboard.sql and supabase/functions/.
   - claude.ai page: the page's shared database (window.claude.use('db')); each player keeps one document
     scores/<id> with their bests. Nothing checks these, so that board is labelled unverified.
   With neither (opening index.html from disk), the leaderboard stays hidden.
   Runs the player seeded themselves (typed a seed, or "Try the same cards") are left out unless the
   viewer turns on "Include seeded runs". */
'use strict';

const LB = { kind:null, state:'off', period:'today', seeded:false, boards:{ today:[], all:[] }, hands:{ today:[], all:[] },
  me:null, myName:'', signedIn:false, writeFailed:false, pending:null, posting:false, backend:null, closedRun:null,
  navigate: url => { location.href = url; } };
const leaderboardAvailable = () => LB.state !== 'off';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const todayUTC = () => new Date().toISOString().slice(0, 10);
const telegramLaunch = () => (typeof BankrollTG !== 'undefined' && BankrollTG) || null;   // js/telegram.js, inside Telegram only
const byScore = (a, b) => (b.level || 0) - (a.level || 0) || (b.peak || 0) - (a.peak || 0) || (b.biggestWin || 0) - (a.biggestWin || 0);
const byMult = (a, b) => (b.mult || 0) - (a.mult || 0) || (a.at || 0) - (b.at || 0);
function refreshBoard(){ if (ui.modal === 'history' || ui.modal === 'over') render(); const t = $('boardBtn'); if (t) t.hidden = !leaderboardAvailable(); }

/* ---------- backend: claude.ai shared database ---------- */
// scores/<player>: { day, runs, all:{ ever, today }, open:{ ever, today } }
//   all = every run, open = unseeded runs only; each slot is { level, peak, biggestWin, hand }
//   hand = { mult, cards:[[rank, suit]…], labels, at }; "today" slots count only while day is today (UTC).
const emptySlot = () => ({ level:0, peak:0, biggestWin:0, hand:null });
function mergeSlot(cur, p){
  cur = cur || emptySlot();
  const hand = p.hand && p.hand.mult > ((cur.hand && cur.hand.mult) || 0)
    ? { mult:p.hand.mult, cards:p.hand.cards, labels:p.hand.labels, at:Date.now() } : cur.hand || null;
  return { level:Math.max(cur.level || 0, p.level), peak:Math.max(cur.peak || 0, p.peak), biggestWin:Math.max(cur.biggestWin || 0, p.biggestWin), hand };
}
// documents written before seeded runs were tracked: nearly all of those runs were fresh shuffles, so they count as both
function readDoc(r){
  if (r.all) return r;
  const ever = { level:r.level || 1, peak:r.peak || 0, biggestWin:r.biggestWin || 0, hand:null };
  const slots = { ever, today:{ level:r.dayLevel || 1, peak:r.dayPeak || 0, biggestWin:r.dayWin || 0, hand:null } };
  return { day:r.day, runs:r.runs, all:slots, open:slots };
}
const claudeBackend = {
  docs: [], names: {},
  async init(host){
    const [db, user] = await Promise.all([host.use('db'), host.use('user')]);
    if (!db) return false;
    this.db = db; this.user = user;
    LB.me = user ? await user.id() : null;
    LB.signedIn = !!LB.me;
    const timer = setTimeout(() => { if (LB.state === 'loading'){ LB.state = 'slow'; refreshBoard(); } }, 10000);
    db.collection('scores').limit(500).onSnapshot(async snap => {
      clearTimeout(timer);
      this.docs = snap.docs.filter(d => d.exists).map(d => Object.assign({ id:d.id }, d.data()));
      const missing = this.docs.map(r => r.id).filter(id => !this.names[id]);
      if (this.user && missing.length){ try { Object.assign(this.names, await this.user.profiles(missing)); } catch(e){} }
      LB.state = 'ready';
      this.refresh();
    }, () => { clearTimeout(timer); LB.state = 'error'; refreshBoard(); });
    return true;
  },
  // builds the boards from the documents for the current "include seeded" choice
  refresh(){
    if (LB.state !== 'ready') return;
    const scope = LB.seeded ? 'all' : 'open', day = todayUTC();
    const person = id => ({ id, name:(this.names[id] && this.names[id].name) || 'Player', avatar:this.names[id] && this.names[id].avatarUrl });
    const slots = per => this.docs.map(r => { const d = readDoc(r), s = d[scope] && d[scope][per === 'today' ? 'today' : 'ever'];
      return per === 'today' && d.day !== day ? null : s ? { r, s } : null; }).filter(Boolean);
    for (const per of ['today', 'all']){
      const list = slots(per);
      LB.boards[per] = list.filter(x => x.s.level > 0).map(({ r, s }) => ({ ...person(r.id), level:s.level || 1, peak:s.peak || 0, biggestWin:s.biggestWin || 0 })).sort(byScore).slice(0, 50);
      LB.hands[per] = list.filter(x => x.s.hand && x.s.hand.mult > 0).map(({ r, s }) => ({ ...person(r.id), ...s.hand })).sort(byMult).slice(0, 10);
    }
    checkTopHand();
    refreshBoard();
  },
  async submit(p){
    if (!LB.me) return 'not_signed_in';
    const raw = this.docs.find(r => r.id === LB.me), cur = raw ? readDoc(raw) : { all:{}, open:{} };
    const day = todayUTC(), same = cur.day === day;
    const upd = (scope, on) => ({ ever: on ? mergeSlot(scope.ever, p) : scope.ever || emptySlot(),
      today: on ? mergeSlot(same ? scope.today : null, p) : same ? scope.today || emptySlot() : emptySlot() });
    const body = { day, runs:Math.max(cur.runs || 0, (prefs.record && prefs.record.runs) || 0, 1),
      all:upd(cur.all || {}, true), open:upd(cur.open || {}, !p.seeded) };
    const strip = o => JSON.stringify(o, (k, v) => k === 'at' ? undefined : v);
    if (raw && raw.all && strip({ day:raw.day, runs:raw.runs, all:raw.all, open:raw.open }) === strip(body)) return 'ok';
    try { await this.db.doc('scores/' + LB.me).set(body); return 'ok'; }
    catch(e){ LB.writeFailed = true; return 'denied'; }
  },
};

/* ---------- backend: Supabase (mahbod.me) ---------- */
const supabaseBackend = {
  async init(cfg){
    if (!window.supabase || !window.supabase.createClient) return false;
    this.cfg = cfg;
    this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
    const setSession = session => {
      LB.signedIn = !!session; LB.me = session ? session.user.id : null;
      const md = (session && session.user.user_metadata) || {};
      LB.myName = md.full_name || md.name || (session && session.user.email ? session.user.email.split('@')[0] : '');
      LB.tgId = md.telegram_id || null;
    };
    try { const { data } = await this.client.auth.getSession(); setSession(data && data.session); } catch(e){}
    this.client.auth.onAuthStateChange((event, session) => {
      const was = LB.signedIn; setSession(session);
      if (session && !was){ this.ensureProfile(session.user); if (LB.backend) upgradeFreshRun(); }
      refreshBoard();
    });
    // inside Telegram: sign in with the Telegram account (Google sign-in doesn't work in Telegram's browser)
    const tg = telegramLaunch();
    if (tg && tg.user && !(LB.signedIn && LB.tgId === tg.user.id)){
      if (await this.telegramSignIn()){ try { const { data } = await this.client.auth.getSession(); setSession(data && data.session); } catch(e){} }
    }
    if (LB.signedIn){ const { data } = await this.client.auth.getSession(); this.ensureProfile(data.session.user); }
    await this.refresh();
    return true;
  },
  // same profile row Latent Space creates, so names and avatars match across the site
  async ensureProfile(user){
    try {
      await this.client.rpc('ensure_user_exists', { p_user_id:user.id, p_email:user.email,
        p_username:(user.user_metadata && user.user_metadata.full_name) || (user.email || 'player').split('@')[0],
        p_avatar_url:(user.user_metadata && user.user_metadata.avatar_url) || null });
    } catch(e){}
  },
  async refresh(){
    const seeded = LB.seeded;
    try {
      const calls = [];
      for (const p of ['today', 'all']){
        calls.push(this.client.rpc('bankroll_leaderboard', { p_period:p, p_include_seeded:seeded, p_limit:50 }));
        calls.push(this.client.rpc('bankroll_top_hands', { p_period:p, p_include_seeded:seeded, p_limit:10 }));
      }
      const [today, todayHands, all, allHands] = await Promise.all(calls);
      const bad = [today, todayHands, all, allHands].find(r => r.error);
      if (bad) throw bad.error;
      if (seeded !== LB.seeded) return;                       // the toggle changed while this was loading
      const row = r => ({ id:r.user_id, name:r.username || 'Player', avatar:r.avatar_url, level:r.level, peak:+r.peak, biggestWin:+r.biggest_win, seeded:!!r.seeded });
      const hand = r => ({ id:r.user_id, name:r.username || 'Player', avatar:r.avatar_url, mult:+r.mult, seeded:!!r.seeded,
        cards:(r.hand && r.hand.cards) || [], labels:(r.hand && r.hand.labels) || [], at:Date.parse(r.achieved_at) || 0 });
      LB.boards.today = (today.data || []).map(row); LB.boards.all = (all.data || []).map(row);
      LB.hands.today = (todayHands.data || []).map(hand); LB.hands.all = (allHands.data || []).map(hand);
      LB.state = 'ready';
      checkTopHand();
    } catch(e){ LB.state = LB.boards.all.length ? 'ready' : 'error'; }
    refreshBoard();
  },
  // asks the server for a run: it picks the seed unless the player chose one
  async startRun(seed){
    try {
      const { data, error } = await this.client.rpc('bankroll_start_run', { p_seed:seed || null });
      if (error || !data) return { error:'error' };
      return data.success ? data : { error:data.error || 'error' };
    } catch(e){ return { error:'error' }; }
  },
  // sends the run's moves; the verify function replays them and stores what the replay scored
  async submit(p){
    if (!LB.signedIn) return 'not_signed_in';
    if (!p.official) return 'unofficial';
    try {
      const { data, error } = await this.client.functions.invoke('bankroll-verify', { body:{ run_id:p.runId, moves:p.moves } });
      if (error){
        const res = error.context, status = res && res.status;
        let code = '';
        try { code = (await res.json()).error || ''; } catch(e){}
        if (status === 401) return 'not_signed_in';
        if (status >= 400 && status < 500){ LB.closedRun = p.runId; return code || 'closed'; }   // this run can't be posted
        return 'error';
      }
      if (data && data.success === false) return data.error || 'error';
      this.refresh();
      return 'ok';
    } catch(e){ return 'error'; }
  },
  // Telegram's signed launch data → the bankroll-telegram function → a one-time token → a Supabase session
  async telegramSignIn(){
    const tg = telegramLaunch();
    if (!tg) return false;
    try {
      const { data, error } = await this.client.functions.invoke('bankroll-telegram', { body:{ initData:tg.initData } });
      if (error || !data || !data.token_hash) return false;
      const res = await this.client.auth.verifyOtp({ token_hash:data.token_hash, type:'magiclink' });
      return !res.error;
    } catch(e){ return false; }
  },
  // the site's existing Google sign-in page (shared with Latent Space) sends the player back here afterwards
  async signIn(){
    if (telegramLaunch()){
      if (await this.telegramSignIn()) refreshBoard(); else toast('Couldn’t sign in');
      return;
    }
    LB.navigate('/latent-space/login.html?next=' + encodeURIComponent(location.pathname + location.search));
  },
};

async function initLeaderboard(){
  const host = window.claude, cfg = window.BANKROLL_CONFIG;
  let backend = null;
  if (host && typeof host.use === 'function') backend = claudeBackend;
  else if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) backend = supabaseBackend;
  if (!backend) return;
  LB.state = 'loading'; LB.kind = backend === claudeBackend ? 'claude' : 'supabase';
  refreshBoard();
  let ok = false;
  try { ok = await backend.init(backend === claudeBackend ? host : cfg); } catch(e){}
  // posting starts only once the backend (and the player's sign-in) is ready
  if (ok) LB.backend = backend; else LB.state = 'off';
  refreshBoard();
  if (LB.backend){ await upgradeFreshRun(); reportProgress(); }
}

/* ---------- starting runs ---------- */
const officialPossible = () => !!(LB.backend && LB.backend.startRun && LB.signedIn);
const isFresh = () => !!S && !S.official && Array.isArray(S.log) && S.log.length === 0 && S.phase === 'bet' && !(S.stats.cashouts > 0);
function useServerRun(run){
  newGame(run.seed);
  S.seedChosen = !!run.seeded;
  S.official = { runId:run.run_id, seeded:!!run.seeded };
  S.runId = run.run_id;
}
// Every new run goes through here. Signed in on the website, the server issues the run first so it can be
// verified later; if the server can't be reached, the run is dealt locally and simply isn't posted.
let runStarting = false;
async function beginRun(seed){
  const chosen = cleanSeed(seed || '');
  if (!officialPossible()){ newGame(chosen || undefined); render(); return; }
  if (runStarting) return;
  runStarting = true;
  ui.modal = null; render();
  let run = await LB.backend.startRun(chosen || null);
  if (run.error === 'rate_limited'){ await new Promise(r => setTimeout(r, 2100)); run = await LB.backend.startRun(chosen || null); }
  runStarting = false;
  if (run.run_id) useServerRun(run);
  else {
    newGame(chosen || undefined);
    toast(run.error === 'banned' ? 'Posting disabled for this account' : 'Offline: this run won’t be posted');
  }
  render();
}
// After the page loads or the player signs in: a run that hasn't been touched yet is swapped for a server-issued one.
async function upgradeFreshRun(){
  if (!officialPossible() || !isFresh() || runStarting) return;
  const before = S;
  runStarting = true;
  const run = await LB.backend.startRun(S.seedChosen ? S.seed : null);
  runStarting = false;
  if (!run.run_id || S !== before || !isFresh()) return;
  const keep = ui.modal;
  useServerRun(run);
  if (keep === 'history' || keep === 'settings' || keep === 'help') ui.modal = keep;
  render();
}

/* ---------- posting progress ---------- */
// Called after cash-outs, level-ups and when a run ends. Posts only when something improved,
// one request at a time; a newer report replaces one that is still waiting.
const SCORE_KEYS = ['level', 'peak', 'biggestWin', 'bestPayout', 'bestMult'];
function reportProgress(finished){
  if (!S || !S.runId || !(S.stats.cashouts > 0)) return;
  if (LB.kind === 'supabase' && (!S.official || !Array.isArray(S.log) || LB.closedRun === S.runId)) return;
  const p = { runId:S.runId, seed:S.seed, seeded:!!S.seedChosen, official:!!S.official, level:lvl(), peak:S.stats.peak || 0,
    biggestWin:S.stats.biggestWin || 0, bestPayout:S.stats.bestPayout || 0, bestMult:S.stats.bestMult || 0, hands:S.stats.cashouts || 0,
    hand:S.bestHand || null, finished:!!finished || S.phase === 'over' };
  const last = S.lbSent || {};
  if (last.runId === p.runId && (last.finished || (!p.finished && SCORE_KEYS.every(k => (last[k] || 0) >= p[k])))) return;
  if (LB.kind === 'supabase') p.moves = S.log.slice();
  LB.pending = p;
  flushProgress();
}
async function flushProgress(){
  if (LB.posting || !LB.pending || !LB.backend || LB.state === 'off') return;
  LB.posting = true;
  const p = LB.pending; LB.pending = null;
  const res = await LB.backend.submit(p);
  LB.posting = false;
  if (res === 'ok' && S && S.runId === p.runId){
    S.lbSent = { runId:p.runId, finished:p.finished };
    SCORE_KEYS.forEach(k => { S.lbSent[k] = p[k]; });
    store(SAVE_KEY, S);
  }
  if (LB.pending) return flushProgress();                         // a newer report arrived meanwhile
  if (res === 'error') LB.pending = p;                            // a network hiccup: keep it for the next try
}

/* ---------- top hand of the day ---------- */
// When the board comes back with this player on top of today's hands, for the hand they just made in this run,
// a celebration opens (once per day and multiplier). It shows over whatever dialog is open and returns to it.
function checkTopHand(){
  const top = LB.hands.today[0];
  if (!top || !LB.me || top.id !== LB.me || !S || !S.bestHand || top.mult !== S.bestHand.mult) return;
  const key = todayUTC() + ':' + top.mult;
  if (prefs.topHandSeen === key) return;
  prefs.topHandSeen = key; store(PREF_KEY, prefs);
  ui.record = { mult:top.mult, cards:top.cards, labels:top.labels || [], name:top.name, second:LB.hands.today[1] || null };
  if (ui.modal !== 'record') ui.modalBack = ui.modal;
  ui.modal = 'record';
  render();
  sfx('win'); buzz([30, 40, 30, 40, 60]);
  setTimeout(celebrate, dur(200));
  announce(`Top hand of the day: times ${top.mult}. Your name is first on today's leaderboard.`);
}
function recordHTML(){
  const r = ui.record; if (!r) return '';
  return `<div class="rec">
      <div class="rec-rays" aria-hidden="true"></div>
      <svg class="rec-crown" viewBox="0 0 64 48" aria-hidden="true"><path d="M6 40 2 10l16 12L32 2l14 20 16-12-4 30z"/><path class="band" d="M7 40h50v6H7z"/><circle cx="32" cy="27" r="4"/></svg>
      <div class="rs-eyebrow">Top hand of the day</div>
      <h2 class="rec-title">Nobody has beaten it today!</h2>
      <div class="rec-mult"><span class="x">×</span>${fmtFit(r.mult)}</div>
      <div class="minihand rec-cards">${lbCards(r.cards)}</div>
      ${r.labels.length ? `<p class="rec-labels">${r.labels.map(esc).join(' <span>×</span> ')}</p>` : ''}
      <div class="rec-name"><span>Your name is on top of today’s leaderboard</span><b>${esc(r.name || LB.myName || 'You')}</b></div>
    </div>
    <div class="actions"><button class="btn" data-act="recordBoard">See leaderboard</button><button class="btn gold" data-act="close">Keep playing</button></div>`;
}

/* ---------- view ---------- */
function resetIn(){
  const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const m = Math.round((next - now) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
const lbName = r => `<span class="bname">${r.avatar ? `<img src="${esc(r.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="bn">${esc(r.name || 'Player')}</span>${r.id === LB.me ? ' <em>you</em>' : ''}${r.seeded ? ' <i class="seedtag" title="The player chose this run’s seed">seeded</i>' : ''}</span>`;
const lbCards = cards => (cards || []).filter(c => Array.isArray(c)).map(([rank, suit], i) => cardHTML({ id:'lb' + i, rank:+rank, suit:String(suit) }, { track:false })).join('');
function handsHTML(per){
  const list = LB.hands[per];
  const title = `<h3 class="lbh">Top hand</h3>`;
  if (!list.length) return `${title}<p class="empty">None yet</p>`;
  const [top, ...rest] = list;
  const best = `<div class="tophand ${top.id === LB.me ? 'me' : ''}">
      <div class="th-head"><b class="th-mult"><small>×</small>${fmtFit(top.mult)}</b>${lbName(top)}</div>
      <div class="minihand th-cards">${lbCards(top.cards)}</div>
      <p class="th-labels">${top.labels.map(esc).join(' <span>×</span> ')}</p></div>`;
  const others = rest.length ? `<div class="board hboard" role="table" aria-label="Runner-up hands">${rest.map((r, i) => `<div class="brow ${r.id === LB.me ? 'me' : ''}" role="row">
      <span>${i + 2}</span>${lbName(r)}<span class="hm">×${fmtFit(r.mult)}</span><span class="hlab">${r.labels.map(esc).join(' + ')}</span></div>`).join('')}</div>` : '';
  return title + best + others;
}
function leaderboardHTML(){
  if (LB.state === 'loading') return `<p class="empty">Loading the leaderboard…</p>`;
  if (LB.state === 'slow') return `<p class="empty">The leaderboard can't be reached right now. It will appear once it loads.</p>`;
  if (LB.state === 'error') return `<p class="empty">The leaderboard isn't available right now. Try again in a moment.</p>`;
  const per = LB.period === 'all' ? 'all' : 'today';
  const rows = LB.boards[per];
  const toggle = `<div class="lbbar"><div class="sg lbper" role="group" aria-label="Leaderboard period">
      <button data-act="lbPeriod" data-v="today" aria-pressed="${per === 'today'}">Today</button>
      <button data-act="lbPeriod" data-v="all" aria-pressed="${per === 'all'}">All time</button></div>
</div>`;
  const seeded = `<button class="lbseed" data-act="lbSeeded" aria-pressed="${LB.seeded}" title="${LB.seeded ? 'Hide' : 'Include'} runs where the player chose the seed" aria-label="${LB.seeded ? 'Hide' : 'Include'} seeded runs">${LB.seeded ? '− seeded' : '+ seeded'}</button>`;
  const sub = per === 'today' ? `<p class="snote lbsub">Resets in ${resetIn()}</p>` : '';
  let foot;
  if (LB.kind === 'supabase' && !LB.signedIn)
    foot = `<div class="lbsign"><button class="btn gold" data-act="lbSignIn">Sign in to post scores</button></div>`;
  else if (LB.kind === 'supabase'){
    const note = !S.official ? 'This run isn’t posted (started signed out, or under older rules)' : LB.closedRun === S.runId ? 'This run can’t be posted' : '';
    foot = note ? `<p class="snote">${note}</p>` : '';
  }
  else foot = `<p class="snote">Unverified scores${!LB.me ? ' · sign in to post' : LB.writeFailed ? ' · view only' : ''}</p>`;
  const list = !rows.length
    ? `<p class="empty">No runs yet</p>`
    : `<div class="board" role="table" aria-label="Leaderboard, ${per === 'today' ? 'today' : 'all time'}">
      <div class="brow bhead" role="row"><span>#</span><span>Player</span><span>Level</span><span>Most coins</span><span>Biggest win</span></div>
      ${rows.map((r, i) => `<div class="brow ${r.id === LB.me ? 'me' : ''}" role="row"><span>${i + 1}</span>${lbName(r)}
        <span>${fmtFit(r.level || 1)}</span><span>${fmtFit(r.peak || 0)}</span><span class="pos">${r.biggestWin ? '+' + fmtFit(r.biggestWin) : '—'}</span></div>`).join('')}
    </div>`;
  return `${toggle}${sub}${list}${handsHTML(per)}${foot}${seeded}`;
}
