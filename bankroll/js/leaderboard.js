/* Bankroll · leaderboard: "Today" (UTC) and "All time" boards.
   Two backends, picked automatically:
   - claude.ai page: the page's shared database (window.claude.use('db')); each player keeps one document
     scores/<id> with their all-time best and today's best.
   - mahbod.me (or any host): Supabase, configured by window.BANKROLL_CONFIG; see supabase/bankroll-leaderboard.sql.
   With neither (opening index.html from disk), the leaderboard stays hidden.
   Progress is posted while a run is played (new best coins, level-ups) and when it ends. */
'use strict';

const LB = { kind:null, state:'off', period:'today', boards:{ today:[], all:[] }, me:null, myName:'', signedIn:false,
  writeFailed:false, pending:null, posting:false, backend:null, navigate: url => { location.href = url; } };
const leaderboardAvailable = () => LB.state !== 'off';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const todayUTC = () => new Date().toISOString().slice(0, 10);
const byScore = (a, b) => (b.level || 0) - (a.level || 0) || (b.peak || 0) - (a.peak || 0) || (b.biggestWin || 0) - (a.biggestWin || 0);
function refreshBoard(){ if (ui.modal === 'history' || ui.modal === 'over') render(); const t = $('boardBtn'); if (t) t.hidden = !leaderboardAvailable(); }

/* ---------- backend: claude.ai shared database ---------- */
const claudeBackend = {
  docs: [],
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
      let names = {};
      if (this.user && this.docs.length){ try { names = await this.user.profiles(this.docs.map(r => r.id)); } catch(e){} }
      const row = (r, f) => ({ id:r.id, name:(names[r.id] && names[r.id].name) || 'Player', avatar:names[r.id] && names[r.id].avatarUrl, ...f });
      const day = todayUTC();
      LB.boards.all = this.docs.map(r => row(r, { level:r.level || 1, peak:r.peak || 0, biggestWin:r.biggestWin || 0 })).sort(byScore).slice(0, 50);
      LB.boards.today = this.docs.filter(r => r.day === day).map(r => row(r, { level:r.dayLevel || 1, peak:r.dayPeak || 0, biggestWin:r.dayWin || 0 })).sort(byScore).slice(0, 50);
      LB.state = 'ready';
      refreshBoard();
    }, () => { clearTimeout(timer); LB.state = 'error'; refreshBoard(); });
    return true;
  },
  async submit(p){
    if (!LB.me) return 'not_signed_in';
    const cur = this.docs.find(r => r.id === LB.me) || {};
    const day = todayUTC(), same = cur.day === day;
    const body = {
      level: Math.max(cur.level || 0, p.level), peak: Math.max(cur.peak || 0, p.peak),
      biggestWin: Math.max(cur.biggestWin || 0, p.biggestWin), bestPayout: Math.max(cur.bestPayout || 0, p.bestPayout),
      runs: Math.max(cur.runs || 0, (prefs.record && prefs.record.runs) || 0, 1),
      day, dayLevel: Math.max(same ? cur.dayLevel || 0 : 0, p.level), dayPeak: Math.max(same ? cur.dayPeak || 0 : 0, p.peak),
      dayWin: Math.max(same ? cur.dayWin || 0 : 0, p.biggestWin),
    };
    if (Object.keys(body).every(k => cur[k] === body[k])) return 'ok';
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
    };
    try { const { data } = await this.client.auth.getSession(); setSession(data && data.session); } catch(e){}
    this.client.auth.onAuthStateChange((event, session) => {
      const was = LB.signedIn; setSession(session);
      if (session && !was){ this.ensureProfile(session.user); reportProgress(); }
      refreshBoard();
    });
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
    try {
      const [today, all] = await Promise.all(['today', 'all'].map(p => this.client.rpc('bankroll_leaderboard', { p_period:p, p_limit:50 })));
      if (today.error || all.error) throw today.error || all.error;
      const map = r => ({ id:r.user_id, name:r.username || 'Player', avatar:r.avatar_url, level:r.level, peak:+r.peak, biggestWin:+r.biggest_win });
      LB.boards.today = (today.data || []).map(map); LB.boards.all = (all.data || []).map(map);
      LB.state = 'ready';
    } catch(e){ LB.state = LB.boards.all.length ? 'ready' : 'error'; }
    refreshBoard();
  },
  async submit(p){
    if (!LB.signedIn) return 'not_signed_in';
    try {
      const { data, error } = await this.client.rpc('bankroll_submit', { p_run_id:p.runId, p_seed:p.seed, p_level:p.level, p_peak:p.peak,
        p_biggest_win:p.biggestWin, p_best_payout:p.bestPayout, p_hands:p.hands, p_finished:p.finished });
      if (error) return 'error';
      if (data && data.success === false) return data.error || 'error';
      this.refresh();
      return 'ok';
    } catch(e){ return 'error'; }
  },
  // the site's existing Google sign-in page (shared with Latent Space) sends the player back here afterwards
  signIn(){ LB.navigate('/latent-space/login.html?next=' + encodeURIComponent(location.pathname + location.search)); },
};

async function initLeaderboard(){
  const host = window.claude, cfg = window.BANKROLL_CONFIG;
  let backend = null;
  if (host && typeof host.use === 'function') backend = claudeBackend;
  else if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) backend = supabaseBackend;
  if (!backend) return;
  LB.state = 'loading'; LB.backend = backend; LB.kind = backend === claudeBackend ? 'claude' : 'supabase';
  refreshBoard();
  try {
    const ok = await backend.init(backend === claudeBackend ? host : cfg);
    if (!ok){ LB.state = 'off'; LB.backend = null; }
  } catch(e){ LB.state = 'off'; LB.backend = null; }
  refreshBoard();
  if (LB.backend) reportProgress();
}

/* ---------- posting progress ---------- */
// Called after cash-outs, level-ups and when a run ends. Posts only when something improved,
// one request at a time; a newer report replaces one that is still waiting.
function reportProgress(finished){
  if (!S || !S.runId || !(S.stats.cashouts > 0)) return;
  const p = { runId:S.runId, seed:S.seed, level:lvl(), peak:S.stats.peak || 0, biggestWin:S.stats.biggestWin || 0,
    bestPayout:S.stats.bestPayout || 0, hands:S.stats.cashouts || 0, finished:!!finished };
  const last = S.lbSent || {};
  if (!p.finished && ['level', 'peak', 'biggestWin', 'bestPayout'].every(k => last[k] >= p[k]) && last.runId === p.runId) return;
  LB.pending = p;
  flushProgress();
}
async function flushProgress(){
  if (LB.posting || !LB.pending || !LB.backend || LB.state === 'off') return;
  LB.posting = true;
  const p = LB.pending; LB.pending = null;
  let res = await LB.backend.submit(p);
  if (res === 'rate_limited'){ await new Promise(r => setTimeout(r, 1300)); res = await LB.backend.submit(p); }
  LB.posting = false;
  if (res === 'ok'){ S.lbSent = p; store(SAVE_KEY, S); }
  else if (res !== 'not_signed_in' && !LB.pending) LB.pending = p;   // keep it for the next try
  if (LB.pending && res === 'ok') flushProgress();
}

/* ---------- view ---------- */
function resetIn(){
  const now = new Date(), next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const m = Math.round((next - now) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
function leaderboardHTML(){
  if (LB.state === 'loading') return `<p class="empty">Loading the leaderboard…</p>`;
  if (LB.state === 'slow') return `<p class="empty">The leaderboard can't be reached right now. It will appear once it loads.</p>`;
  if (LB.state === 'error') return `<p class="empty">The leaderboard isn't available right now. Try again in a moment.</p>`;
  const per = LB.period === 'all' ? 'all' : 'today';
  const rows = LB.boards[per];
  const toggle = `<div class="sg lbper" role="group" aria-label="Leaderboard period">
      <button data-act="lbPeriod" data-v="today" aria-pressed="${per === 'today'}">Today</button>
      <button data-act="lbPeriod" data-v="all" aria-pressed="${per === 'all'}">All time</button></div>`;
  const sub = per === 'today' ? `Best run per player today (UTC). Resets in ${resetIn()}.` : 'Each player’s best run ever.';
  let foot;
  if (LB.kind === 'supabase' && !LB.signedIn)
    foot = `<div class="lbsign"><span>Sign in to post your runs to the leaderboard.</span><button class="btn gold" data-act="lbSignIn">Sign in with Google</button></div>`;
  else if (LB.kind === 'supabase') foot = `<p class="snote">Signed in${LB.myName ? ` as <b>${esc(LB.myName)}</b>` : ''}. Your runs are posted as you play.</p>`;
  else foot = `<p class="snote">${!LB.me ? 'Sign in to claude.ai to post your own runs.' : LB.writeFailed ? 'Your runs couldn’t be posted: this page is view-only for you.' : 'Your runs are posted as you play.'}</p>`;
  const list = !rows.length
    ? `<p class="empty">${per === 'today' ? 'No runs yet today. Play one to take the top spot.' : 'No scores yet. Play a run to post the first one.'}</p>`
    : `<div class="board" role="table" aria-label="Leaderboard, ${per === 'today' ? 'today' : 'all time'}">
      <div class="brow bhead" role="row"><span>#</span><span>Player</span><span>Level</span><span>Most coins</span><span>Biggest win</span></div>
      ${rows.map((r, i) => `<div class="brow ${r.id === LB.me ? 'me' : ''}" role="row"><span>${i + 1}</span>
        <span class="bname">${r.avatar ? `<img src="${esc(r.avatar)}" alt="" referrerpolicy="no-referrer">` : ''}${esc(r.name || 'Player')}${r.id === LB.me ? ' <em>you</em>' : ''}</span>
        <span>${fmt(r.level || 1)}</span><span>${fmt(r.peak || 0)}</span><span class="pos">${r.biggestWin ? '+' + fmt(r.biggestWin) : '—'}</span></div>`).join('')}
    </div>`;
  return `${toggle}<p class="snote lbsub">${sub}</p>${list}${foot}`;
}
