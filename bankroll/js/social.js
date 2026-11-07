/* Bankroll · playing with others: sharing a run as a challenge on the same cards, opening a shared challenge, the daily
   challenge (everyone gets the same deck each day) and copying a seed. */
'use strict';

const TG_APP = 'https://t.me/TheBankrollBot/app';     // the Mini App's direct link; ?startapp=<seed> opens a challenge

/* ---------- the daily challenge ----------
   Switched off for now (DAILY_ON): no buttons, no board. The server side (a seed filter on the boards) stays in place. */
const DAILY_ON = false;
// The same seed for everyone on a UTC day: DY + yymmdd, shown as DY26-1107.
function dailySeed(d = new Date()){
  const p = n => String(n).padStart(2, '0');
  return cleanSeed('DY' + p(d.getUTCFullYear() % 100) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()));
}
const isDaily = seed => !!seed && seed === dailySeed();
// mid-run the player is asked first (their run would end); on a fresh table or after a run it starts straight away
function playDaily(){ ui.modal = null; offerChallenge(dailySeed()); render(); }

/* ---------- sharing a run ---------- */
// A link that opens the game on this run's cards: inside Telegram the Mini App link, otherwise this page with ?seed=
function challengeLink(seed){
  if (telegramLaunch()) return TG_APP + '?startapp=' + encodeURIComponent(seed);
  const host = location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://mahbod.me/bankroll/';
  return host + '?seed=' + encodeURIComponent(seed);
}
function challengeText(){
  const over = S.phase === 'over' && S.over && S.over.run, L = over ? over.level : lvl(), peak = S.stats.peak || 0;
  const best = S.stats.bestMult ? ` and a ×${fmtFit(S.stats.bestMult)} hand` : '';
  const day = isDaily(S.seed) ? 'today\'s Bankroll challenge' : 'Bankroll';
  return `I reached level ${L} with ${fmtFit(peak)} coins${best} in ${day}. Can you beat me on the same cards?`;
}
async function shareRun(){
  const link = challengeLink(S.seed), text = challengeText();
  const tg = telegramLaunch();
  try {
    if (tg && tg.app && tg.app.openTelegramLink && tg.app.isVersionAtLeast && tg.app.isVersionAtLeast('6.1')){
      tg.app.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text));
      return;
    }
    if (navigator.share){ await navigator.share({ title:'Bankroll', text, url:link }); return; }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  if (await copyText(text + ' ' + link)) toast('Challenge link copied');
  else toast('Share this link: ' + esc(link));
}

/* ---------- copying ---------- */
async function copyText(t){
  try { if (navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(t); return true; } } catch(e){}
  try {
    const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok;
  } catch(e){ return false; }
}
async function copySeed(){ toast(await copyText(S.seed) ? `Seed <b>${esc(S.seed)}</b> copied` : `Seed: <b>${esc(S.seed)}</b>`); }
const seedHTML = () => `<code class="seed">${esc(S.seed)}</code><button class="seedcopy" data-act="copySeed" aria-label="Copy the seed" title="Copy the seed">
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button>`;

/* ---------- opening a shared challenge ---------- */
// A link with ?seed= (website) or a Telegram start parameter: play those cards. A fresh table switches straight away;
// with a run in progress the player is asked first. After the introduction, the challenge is what starts.
function incomingSeed(){
  let raw = null, group = null;
  try { const q = new URLSearchParams(location.search); raw = q.get('seed'); group = q.get('challenge'); } catch(e){}
  const tg = telegramLaunch();
  if (!raw && !group && tg && tg.startParam){ if (/^c_/i.test(tg.startParam)) group = tg.startParam.slice(2); else raw = tg.startParam; }
  try { if (location.search) history.replaceState(null, '', location.pathname + location.hash); } catch(e){}
  // only once per link: a reload (or Telegram keeping its launch data) doesn't ask again
  const once = v => { try { const key = 'bankroll-challenge-seen' + KEY_NS; if (sessionStorage.getItem(key) === v) return false; sessionStorage.setItem(key, v); } catch(e){} return true; };
  if (group){
    group = String(group).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (group && once('c_' + group)){
      if (typeof intro !== 'undefined' && intro) ui.afterIntroGroup = group;   // after the introduction
      else ui.pendingGroup = group;                                             // once the leaderboard has connected
      if (!window.BANKROLL_CONFIG) toast('Group challenges open on the website or in Telegram');
    }
    return null;
  }
  const seed = cleanSeed(raw || '');
  if (!seed || !once(seed)) return null;
  return seed;
}
function offerChallenge(seed){
  if (!seed) return;
  if (typeof intro !== 'undefined' && intro){ ui.afterIntroSeed = seed; return; }           // the introduction comes first
  const fresh = S && !S.intro && S.phase === 'bet' && !(S.stats.cashouts > 0) && !(S.stats.sets > 0);
  if (fresh || !S || S.phase === 'over'){ beginRun(seed); return; }
  ui.challengeSeed = seed; ui.modal = 'challenge'; render();
}
function challengeHTML(){
  const seed = ui.challengeSeed || '';
  return isDaily(seed) ? `<h2>Today's challenge</h2>
    <p class="lead">Start today's deck (<code class="seed">${esc(seed)}</code>)? <b>Your current run ends</b> here.</p>
    <div class="actions"><button class="btn" data-act="close">Keep playing</button><button class="btn gold" data-act="acceptChallenge">Start the challenge</button></div>`
    : `<h2>A challenge</h2>
    <p class="lead">Play the cards someone shared with you (seed <code class="seed">${esc(seed)}</code>)? <b>Your current run ends</b> here.</p>
    <div class="actions"><button class="btn" data-act="close">Not now</button><button class="btn gold" data-act="acceptChallenge">Play these cards</button></div>`;
}

/* ---------- group challenges ----------
   A challenge is a deck shared in a chat (a fresh one, or the deck of a run just played, which then counts as that
   player's entry). Everyone who opens it plays it once; the server keeps it to one run each and compares them
   (supabase/bankroll-leaderboard.sql: bankroll_create_challenge, bankroll_challenge_board). Website and Telegram only. */
const groupsOn = () => LB.kind === 'supabase' && !!LB.backend && typeof LB.backend.createChallenge === 'function';
function groupLink(code){
  if (telegramLaunch()) return TG_APP + '?startapp=c_' + code;
  const host = location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://mahbod.me/bankroll/';
  return host + '?challenge=' + code;
}
async function shareGroup(code){
  const link = groupLink(code);
  const text = '♠ Bankroll challenge: the same deck for everyone, one try each. Can you beat us?';
  const tg = telegramLaunch();
  try {
    if (tg && tg.app && tg.app.openTelegramLink && tg.app.isVersionAtLeast && tg.app.isVersionAtLeast('6.1')){
      tg.app.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return;   // pick any chat or group
    }
    if (navigator.share){ await navigator.share({ title:'Bankroll challenge', text, url:link }); return; }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  toast(await copyText(text + ' ' + link) ? 'Challenge link copied: paste it in a chat' : 'Share this link: ' + esc(link));
}
// fromRun: make the run just played into a challenge (it's this player's entry); otherwise a fresh deck, played next
let groupBusy = false;
async function createGroup(fromRun){
  if (!groupsOn()){ shareRun(); return; }               // no server (claude.ai, offline): share the seed instead
  if (groupBusy) return;
  groupBusy = true; toast('Making a challenge…');
  const res = await LB.backend.createChallenge(fromRun && S.official ? S.runId : null);
  groupBusy = false;
  if (!res.success){ toast(res.error === 'rate_limited' ? 'Too many challenges for now. Try again later' : 'Couldn\'t make a challenge. Try again in a moment'); return; }
  if (fromRun && S.official){ S.challenge = res.code; store(SAVE_KEY, S); }
  await shareGroup(res.code);
  if (!fromRun) offerGroup(res.code, true);
  else openGroup(res.code);
}
// joining from a link (or starting your own new challenge): asked first when a run is in progress
function offerGroup(code, mine){
  if (!code) return;
  if (!groupsOn()){ toast('Group challenges need a connection to the server'); return; }
  ui.groupCode = code; ui.groupMine = !!mine;
  const fresh = S && !S.intro && S.phase === 'bet' && !(S.stats.cashouts > 0) && !(S.stats.sets > 0);
  if (mine && (fresh || S.phase === 'over')){ beginRun(null, code); return; }
  ui.modal = 'joinGroup'; render();
  loadGroup(code);
}
async function loadGroup(code){
  ui.group = ui.group && ui.group.code === code ? ui.group : { code, loading:true };
  const res = await LB.backend.challengeBoard(code);
  if (ui.groupCode !== code && (!ui.group || ui.group.code !== code)) return;
  ui.group = res.success ? { code, data:res } : { code, error:res.error || 'error' };
  if (ui.modal === 'group' || ui.modal === 'joinGroup') render();
}
function openGroup(code){ ui.groupCode = code; ui.modal = 'group'; render(); loadGroup(code); }
const groupMe = g => g && g.data && g.data.players.find(p => p.user_id === LB.me);
function joinGroupHTML(){
  const g = ui.group || {}, played = groupMe(g), host = g.data ? esc(g.data.host) : 'A friend';
  const n = g.data ? g.data.players.length : 0, inRun = S && S.phase !== 'over' && (S.stats.sets > 0 || S.stats.cashouts > 0);
  if (played) return groupHTML();
  return `<div class="rs-eyebrow">Group challenge</div><h2>${ui.groupMine ? 'Your challenge is ready' : `${host} challenged you`}</h2>
    <p class="lead">Everyone plays the same deck, <b>once</b>. Your run is then compared with the others${n ? ` (${n} played so far)` : ''}.${inRun ? ' <b>Your current run ends</b> here.' : ''}</p>
    <div class="actions"><button class="btn" data-act="close">Not now</button><button class="btn gold" data-act="playGroup">Play my one try</button></div>`;
}
function groupHTML(){
  const g = ui.group || {};
  let body;
  if (g.loading || (!g.data && !g.error)) body = `<p class="empty">Loading…</p>`;
  else if (g.error) body = `<p class="empty">${g.error === 'unknown_challenge' ? 'This challenge doesn\'t exist.' : 'The results can\'t be reached right now.'}</p>`;
  else {
    const rows = g.data.players;
    body = !rows.length ? `<p class="empty">Nobody has played yet</p>` : `<div class="board gboard" role="table" aria-label="Challenge results">
      <div class="brow bhead" role="row"><span>#</span><span>Player</span><span>Level</span><span>Coins</span><span></span></div>
      ${rows.map((r, i) => `<div class="brow ${r.user_id === LB.me ? 'me' : ''}" role="row"><span>${i + 1}</span>
        <span class="bname">${esc(r.name)}${r.user_id === LB.me ? ' <em>you</em>' : ''}</span><span>${fmtFit(r.level || 1)}</span>
        <span>${fmtFit(+r.peak || 0)}</span><span class="gstat ${r.finished ? 'done' : 'live'}">${r.finished ? (r.end_cause === 'infinite' ? '∞ won' : 'done') : 'playing'}</span></div>`).join('')}
    </div>`;
  }
  const mine = groupMe(g), host = g.data ? esc(g.data.host) : '';
  return `<div class="rs-eyebrow">Group challenge${host ? ` · by ${host}` : ''}</div><h2>Results</h2>
    <p class="snote">Same deck for everyone, one try each.${mine && !mine.finished ? ' Your run is still going.' : ''}</p>
    ${body}
    <div class="actions"><button class="btn" data-act="groupRefresh">Refresh</button><button class="btn" data-act="groupInvite">Invite more</button><button class="btn gold" data-act="close">Close</button></div>`;
}
