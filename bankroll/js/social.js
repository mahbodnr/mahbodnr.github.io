/* Bankroll · playing with others: sharing a run as a challenge on the same cards, opening a shared challenge, the daily
   challenge (everyone gets the same deck each day) and copying a seed. */
'use strict';

const TG_APP = 'https://t.me/TheBankrollBot';     // the bot's main Mini App; ?startapp=<seed> (or c_<code>) opens it on a challenge

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

/* ---------- group challenges and duels ----------
   A challenge is a deck shared in a chat (a fresh one, or the deck of a run just played, which then counts as that
   player's entry). A group challenge is for everyone in the chat; a duel is its maker against one friend. Each player
   plays it once; the server keeps it to one run each and compares them (supabase/bankroll-leaderboard.sql:
   bankroll_create_challenge, bankroll_challenge_board). In Telegram the challenge goes out as the bot's card (a short
   video, a description, the scoreboard and a Play button) which the bot keeps up to date. Website and Telegram only. */
const groupsOn = () => LB.kind === 'supabase' && !!LB.backend && typeof LB.backend.createChallenge === 'function';
const isDuel = g => !!(g && g.data && g.data.kind === 'duel');
function groupLink(code){
  if (telegramLaunch()) return TG_APP + '?startapp=c_' + code;
  const host = location.protocol.startsWith('http') ? location.origin + location.pathname : 'https://mahbod.me/bankroll/';
  return host + '?challenge=' + code;
}
const GROUP_TEXT = {
  group: '♠️ Bankroll group challenge: everyone plays the same deck, once. Bet, chase combos that multiply each other, and cash out before the debt catches you. Can you top the table?',
  duel: '⚔️ I challenge you to a Bankroll duel: one deck, one try each. Bet, chase combos that multiply each other, and cash out before the debt catches you. Think you can beat me?',
};
async function shareGroup(code, kind){
  const link = groupLink(code), text = GROUP_TEXT[kind === 'duel' ? 'duel' : 'group'];
  const tg = telegramLaunch();
  try {
    // Telegram 8.0+: the bot's card, sent through Telegram's own chat picker
    if (tg && tg.app && tg.app.shareMessage && tg.app.isVersionAtLeast && tg.app.isVersionAtLeast('8.0') && LB.backend && LB.backend.shareCard){
      const id = await LB.backend.shareCard(code);
      if (id){ tg.app.shareMessage(id, sent => { if (sent) toast('Sent! The scores there update as people play'); }); return; }
    }
    if (tg && tg.app && tg.app.openTelegramLink && tg.app.isVersionAtLeast && tg.app.isVersionAtLeast('6.1')){
      tg.app.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return;   // pick any chat or group
    }
    if (navigator.share){ await navigator.share({ title: kind === 'duel' ? 'Bankroll duel' : 'Bankroll challenge', text, url:link }); return; }
  } catch(e){ if (e && e.name === 'AbortError') return; }
  toast(await copyText(text + ' ' + link) ? 'Challenge link copied: paste it in a chat' : 'Share this link: ' + esc(link));
}
// The "Challenge friends" choice: a group challenge or a duel. fromRun: the run just played becomes the maker's entry.
function pickChallenge(fromRun){
  if (!groupsOn()){ shareRun(); return; }               // no server (claude.ai, offline): share the seed instead
  ui.newFromRun = !!fromRun; ui.modal = 'newChallenge'; render();
}
function newChallengeHTML(){
  const run = ui.newFromRun && S.official;
  return `<div class="rs-eyebrow">Play with friends</div><h2>Challenge friends</h2>
    <p class="snote">${run ? 'Your friends get the deck you just played, and your run is your entry.' : 'A new deck. Send it, then play it yourself.'}</p>
    <div class="pickch">
      <button class="pickopt" data-act="makeChallenge" data-v="group"><span class="po-ico" aria-hidden="true">♠</span><span><b>Group challenge</b><small>Send it to a group: everyone plays the same deck once, with a live scoreboard in the chat.</small></span></button>
      <button class="pickopt" data-act="makeChallenge" data-v="duel"><span class="po-ico" aria-hidden="true">⚔</span><span><b>Duel</b><small>You against one friend on the same deck. The winner is announced, then rematch!</small></span></button>
      ${telegramLaunch() ? `<button class="pickopt" data-act="shareChatGame"><span class="po-ico" aria-hidden="true">🏆</span><span><b>Chat leaderboard</b><small>A scoreboard that stays in the group: everyone's best run, any time, on any deck.</small></span></button>` : ''}
    </div>
    <div class="actions"><button class="btn" data-act="close">Cancel</button></div>`;
}
let groupBusy = false;
async function createGroup(fromRun, kind = 'group'){
  if (!groupsOn()){ shareRun(); return; }
  if (groupBusy) return;
  groupBusy = true; ui.modal = null; render(); toast(kind === 'duel' ? 'Setting up the duel…' : 'Making a challenge…');
  const res = await LB.backend.createChallenge(fromRun && S.official ? S.runId : null, kind);
  groupBusy = false;
  if (!res.success){ toast(res.error === 'rate_limited' ? 'Too many challenges for now. Try again later' : 'Couldn\'t make a challenge. Try again in a moment'); return; }
  const made = res.kind || kind;
  ui.madeChallenge = { code:res.code, kind:made };
  if (fromRun && S.official){ S.challenge = res.code; S.chInfo = challengeInfo(res.code); store(SAVE_KEY, S); }
  await shareGroup(res.code, made);
  if (!fromRun) offerGroup(res.code, true);
  else openGroup(res.code);
}
// joining from a link (or starting your own new challenge): the challenge page first, with the scores so far
function offerGroup(code, mine){
  if (!code) return;
  if (!groupsOn()){ toast('Group challenges need a connection to the server'); return; }
  ui.groupCode = code; ui.groupMine = !!mine;
  const fresh = S && !S.intro && S.phase === 'bet' && !(S.stats.cashouts > 0) && !(S.stats.sets > 0);
  if (mine && (fresh || S.phase === 'over')){ beginRun(null, code); return; }
  ui.modal = 'joinGroup'; render();
  loadGroup(code);
}
// opened from a link while the game is still connecting: the page shows straight away and fills in
function showGroupEarly(code){ ui.groupCode = code; ui.groupMine = false; ui.group = { code, loading:true }; ui.modal = 'joinGroup'; }
async function loadGroup(code){
  ui.group = ui.group && ui.group.code === code && (ui.group.data || ui.group.loading) ? ui.group : { code, loading:true };
  const res = await LB.backend.challengeBoard(code);
  if (ui.groupCode !== code && (!ui.group || ui.group.code !== code)) return;
  ui.group = res.success ? { code, data:res } : { code, error:res.error || 'error' };
  if (ui.modal === 'group' || ui.modal === 'joinGroup' || ui.modal === 'over') render();
}
function openGroup(code){ ui.groupCode = code; ui.modal = 'group'; render(); loadGroup(code); }
const groupMe = g => g && g.data && g.data.players.find(p => p.user_id === LB.me);
// a duel already has its two players (and this player isn't one of them)
const duelFull = g => isDuel(g) && !groupMe(g) && g.data.host_id !== LB.me && g.data.players.some(p => p.user_id !== g.data.host_id);
function groupBoardHTML(g, empty){
  if (g.loading || (!g.data && !g.error)) return `<p class="empty">Loading the scores…</p>`;
  if (g.error) return `<p class="empty">${g.error === 'unknown_challenge' ? 'This challenge doesn\'t exist.' : 'The scores can\'t be reached right now.'}</p>`;
  const rows = g.data.players;
  if (!rows.length) return `<p class="empty">${empty}</p>`;
  return `<div class="board gboard" role="table" aria-label="Challenge results">
      <div class="brow bhead" role="row"><span>#</span><span>Player</span><span>Level</span><span>Coins</span><span></span></div>
      ${rows.map((r, i) => `<div class="brow ${r.user_id === LB.me ? 'me' : ''}" role="row"><span>${i + 1}</span>
        <span class="bname">${esc(r.name)}${r.user_id === LB.me ? ' <em>you</em>' : ''}</span><span>${fmtFit(r.level || 1)}</span>
        <span>${r.peak === 'Infinity' || +r.peak === Infinity ? '∞' : fmtFit(+r.peak || 0)}</span><span class="gstat ${r.finished ? 'done' : 'live'}">${r.finished ? (r.end_cause === 'infinite' ? '∞ won' : 'done') : 'playing'}</span></div>`).join('')}
    </div>`;
}
function joinGroupHTML(){
  const g = ui.group || {}, played = groupMe(g), duel = isDuel(g), host = g.data ? esc(g.data.host) : 'A friend';
  const inRun = S && !S.intro && S.phase !== 'over' && (S.stats.sets > 0 || S.stats.cashouts > 0);
  if (played) return groupHTML();
  if (duelFull(g)) return `<div class="rs-eyebrow">Duel</div><h2>This duel is taken</h2>
    <p class="lead">${host} already has an opponent. Here's how it stands, or start a duel of your own.</p>
    ${groupBoardHTML(g, '')}
    <div class="actions"><button class="btn" data-act="close">Close</button><button class="btn gold" data-act="makeChallenge" data-v="duel">Start my own duel</button></div>`;
  const ready = groupsOn() && !!g.data;
  const title = ui.groupMine ? (duel ? 'Your duel is ready' : 'Your challenge is ready') : duel ? `${host} challenged you to a duel` : `${host} challenged you`;
  return `<div class="rs-eyebrow">${duel ? 'Duel' : 'Group challenge'}${g.data && g.data.round > 1 ? ` · round ${g.data.round}` : ''}</div><h2>${title}</h2>
    <p class="lead">${duel ? 'You and your friend play <b>the same deck, once each</b>.' : 'Everyone in the chat plays <b>the same deck, once</b>.'}
      Highest level wins, then most coins.${inRun ? ' <b>Your current run ends</b> here.' : ''}</p>
    <ul class="ghow"><li>Bet, then swap cards in until your hand pays.</li><li>Pairs, straights and flushes <b>multiply each other</b>.</li>
      <li>Every card adds debt: cash out before it costs more than the hand is worth.</li></ul>
    <h3 class="gsub">${duel ? 'The duel so far' : 'Leaderboard so far'}</h3>
    ${groupBoardHTML(g, duel ? 'Nobody has played yet' : 'Nobody has played yet. Be the first!')}
    <div class="actions"><button class="btn" data-act="groupHow">How to play</button><button class="btn gold" data-act="playGroup"${ready ? '' : ' disabled'}>${duel ? 'Play the duel' : 'Play'}</button></div>`;
}
function groupHTML(){
  const g = ui.group || {}, duel = isDuel(g);
  const mine = groupMe(g), host = g.data ? esc(g.data.host) : '';
  const rows = g.data ? g.data.players : [];
  const done = duel && rows.length >= 2 && rows.every(p => p.finished);
  const verdict = done ? (rows[0].user_id === LB.me ? 'You won the duel! 🏆' : mine ? `${esc(rows[0].name)} won this one` : `${esc(rows[0].name)} won`) : 'Results';
  return `<div class="rs-eyebrow">${duel ? 'Duel' : 'Group challenge'}${host ? ` · by ${host}` : ''}${g.data && g.data.round > 1 ? ` · round ${g.data.round}` : ''}</div><h2>${verdict}</h2>
    <p class="snote">${duel ? 'One deck, one try each.' : 'Same deck for everyone, one try each.'}${mine && !mine.finished ? ' Your run is still going.' : ''}${duel && !done && rows.length < 2 ? ' Waiting for the other player.' : ''}</p>
    ${groupBoardHTML(g, 'Nobody has played yet')}
    <div class="actions"><button class="btn" data-act="groupRefresh">Refresh</button>${done && mine
      ? '<button class="btn" data-act="makeChallenge" data-v="duel">Rematch</button>'
      : `<button class="btn" data-act="groupInvite">${duel ? 'Send again' : 'Invite more'}</button>`}<button class="btn gold" data-act="close">Close</button></div>`;
}

/* ---------- while playing a challenge, and when it ends ----------
   A strip above the level bar says what is being played (a group challenge or a duel, whose deck, one try) with a
   button to the scores; the run-over window opens with the challenge's result: the placing, the board, what next. */
// what a challenge run is (kept with the run, so it survives a reload): its kind and who made it
function challengeInfo(code){
  const g = ui.group && ui.group.code === code && ui.group.data;
  if (g) return { kind:g.kind || 'group', host:g.host || 'A friend', mine:!!(LB.me && g.host_id === LB.me), round:g.round || 1 };
  if (ui.madeChallenge && ui.madeChallenge.code === code) return { kind:ui.madeChallenge.kind, host:LB.myName || 'You', mine:true, round:1 };
  return { kind:'group', host:'', mine:false, round:1 };
}
const chTitle = i => i.kind === 'duel' ? (i.mine ? 'Your duel' : `Duel with ${esc(i.host || 'a friend')}`)
  : i.mine ? 'Your group challenge' : i.host ? `${esc(i.host)}'s group challenge` : 'Group challenge';
// the strip above the level bar
function playBarHTML(){
  if (!S || S.intro) return '';
  if (S.challenge){
    const i = S.chInfo || challengeInfo(S.challenge), over = S.phase === 'over';
    return `<div class="playbar ${i.kind}"><span class="pb-ico" aria-hidden="true">${i.kind === 'duel' ? '⚔' : '♠'}</span>
      <span class="pb-txt"><b>${chTitle(i)}${i.round > 1 ? ` · round ${i.round}` : ''}</b><small>${over ? 'Your try is done' : i.kind === 'duel' ? (i.mine ? 'Same deck as your opponent · your one try' : `Same deck as ${esc(i.host || 'your friend')} · your one try`) : 'Same deck as everyone · your one try'}</small></span>
      <button class="pb-btn" data-act="groupResults">Scores</button></div>`;
  }
  if (gameToken && !S.seedChosen) return `<div class="playbar game"><span class="pb-ico" aria-hidden="true">🏆</span>
      <span class="pb-txt"><b>Chat leaderboard</b><small>Your best run goes to the chat</small></span>
      <button class="pb-btn" data-act="chatScores">Scores</button></div>`;
  return '';
}
// the top of the run-over window for a challenge (or a chat leaderboard) run
function overPlayHTML(){
  if (S.challenge){
    const i = S.chInfo || challengeInfo(S.challenge), g = ui.group && ui.group.code === S.challenge ? ui.group : null;
    if (!g && groupsOn()) setTimeout(() => loadGroup(S.challenge), 0);
    const rows = g && g.data ? g.data.players : [], me = rows.findIndex(p => p.user_id === LB.me), mine = rows[me];
    let headline = 'Posting your result…', sub = '';
    if (mine && mine.finished){
      if (i.kind === 'duel'){
        const other = rows.find(p => p.user_id !== LB.me);
        headline = !other ? 'Waiting for your opponent' : !other.finished ? `${esc(other.name)} is still playing` : me === 0 ? 'You won the duel! 🏆' : `${esc(other.name)} won this one`;
        sub = !other ? 'The duel card in the chat shows the result when they\'ve played.' : '';
      } else { headline = `You placed <b>#${me + 1}</b> of ${rows.length}`; sub = me === 0 ? 'Top of the table, for now.' : ''; }
    } else if (g && g.error) headline = 'The results can\'t be reached right now';
    const duelDone = i.kind === 'duel' && rows.length >= 2 && rows.every(p => p.finished);
    return `<div class="ro-ch ${i.kind}"><div class="rs-eyebrow">${chTitle(i)}${i.round > 1 ? ` · round ${i.round}` : ''}</div>
      <div class="roc-head">${headline}</div>${sub ? `<p class="snote">${sub}</p>` : ''}
      ${rows.length ? groupBoardHTML(g, '') : ''}
      <div class="roc-actions"><button class="btn" data-act="groupResults">Full results</button>${duelDone && mine
        ? '<button class="btn gold" data-act="makeChallenge" data-v="duel">Rematch</button>'
        : `<button class="btn gold" data-act="groupInvite">${i.kind === 'duel' ? 'Send the duel again' : 'Invite more friends'}</button>`}</div></div>`;
  }
  if (gameToken && !S.seedChosen){
    const p = ui.gamePosted;
    const line = !p ? 'Posting your best coins to the chat leaderboard…' : p.error ? 'Couldn\'t post to the chat leaderboard' :
      p.posted ? `Posted to the chat leaderboard: <b>${fmtFit(p.score)}</b>` : `On the chat leaderboard your best is still higher than ${fmtFit(p.score)}`;
    return `<div class="ro-ch game"><div class="rs-eyebrow">Chat leaderboard</div><div class="roc-head">${line}</div>
      <div class="roc-actions"><button class="btn gold" data-act="chatScores">See the chat's scores</button></div></div>`;
  }
  return '';
}

/* ---------- the chat leaderboard (a Telegram game) ----------
   Opened from the game message in a chat (?game=TOKEN): every finished run on a deck the server dealt posts its best
   coins to that message's scoreboard (tools/telegram-core.mjs: postGameScore). */
const GAME_KEY = 'bankroll-game' + KEY_NS;
let gameToken = null;
(function(){
  try {
    const q = new URLSearchParams(location.search).get('game');
    // kept for this visit only (a reload keeps it; opening the game later from elsewhere doesn't post to the chat)
    if (q && /^[a-z0-9]{8,20}$/.test(q)){ gameToken = q; sessionStorage.setItem(GAME_KEY, q); return; }
    const g = sessionStorage.getItem(GAME_KEY);
    if (g && /^[a-z0-9]{8,20}$/.test(g)) gameToken = g;
  } catch(e){}
})();
async function postGameRun(runId){
  if (!gameToken || !LB.backend || !LB.backend.postGameScore) return;
  ui.gamePosted = null;
  const r = await LB.backend.postGameScore(gameToken, runId);
  ui.gamePosted = r && r.success ? r : { error:true };
  if (r && r.success && r.posted) toast(`Posted to the chat leaderboard: ${fmtFit(r.score)}`);
  if (ui.modal === 'over') render();
}
async function openChatScores(){
  ui.chatScores = { loading:true }; ui.modal = 'chatScores'; render();
  const r = LB.backend && LB.backend.gameScores ? await LB.backend.gameScores(gameToken) : null;
  ui.chatScores = r && r.success ? { rows:r.scores } : { error:true };
  if (ui.modal === 'chatScores') render();
}
function chatScoresHTML(){
  const c = ui.chatScores || {};
  const body = c.loading ? '<p class="empty">Loading…</p>' : c.error ? '<p class="empty">The chat\'s scores can\'t be reached right now.</p>'
    : !c.rows.length ? '<p class="empty">No scores yet. Finish a run to be the first!</p>'
    : `<div class="board cboard" role="table" aria-label="Chat leaderboard"><div class="brow bhead" role="row"><span>#</span><span>Player</span><span>Best coins</span></div>
      ${c.rows.map(r => `<div class="brow ${r.me ? 'me' : ''}" role="row"><span>${r.position}</span><span class="bname">${esc(r.name)}${r.me ? ' <em>you</em>' : ''}</span><span>${r.score >= 2147483647 ? '∞' : fmtFit(r.score)}</span></div>`).join('')}</div>`;
  return `<div class="rs-eyebrow">Telegram chat</div><h2>Chat leaderboard</h2>
    <p class="snote">Everyone's best run in this chat (most coins). Telegram keeps the scoreboard on the game message too.</p>
    ${body}<div class="actions"><button class="btn gold" data-act="close">Close</button></div>`;
}
// Telegram: send the chat leaderboard game to a group (Telegram's own picker)
async function shareChatGame(){
  const tg = telegramLaunch();
  ui.modal = null; render();
  if (tg && tg.app && tg.app.shareMessage && tg.app.isVersionAtLeast && tg.app.isVersionAtLeast('8.0') && LB.backend && LB.backend.shareGame){
    const id = await LB.backend.shareGame();
    if (id){ tg.app.shareMessage(id, sent => { if (sent) toast('Sent! Everyone\'s best run shows on that message'); }); return; }
  }
  toast('In a group with the bot, send /play to post the chat leaderboard');
}
