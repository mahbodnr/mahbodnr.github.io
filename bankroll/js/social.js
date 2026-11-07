/* Bankroll · playing with others: sharing a run as a challenge on the same cards, opening a shared challenge, the daily
   challenge (everyone gets the same deck each day) and copying a seed. */
'use strict';

const TG_APP = 'https://t.me/TheBankrollBot/app';     // the Mini App's direct link; ?startapp=<seed> opens a challenge

/* ---------- the daily challenge ---------- */
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
  let raw = null;
  try { raw = new URLSearchParams(location.search).get('seed'); } catch(e){}
  const tg = telegramLaunch();
  if (!raw && tg && tg.startParam) raw = tg.startParam;
  const seed = cleanSeed(raw || '');
  if (!seed) return null;
  // only once per link: a reload (or Telegram keeping its launch data) doesn't ask again
  try {
    if (raw && new URLSearchParams(location.search).has('seed')) history.replaceState(null, '', location.pathname + location.hash);
    const key = 'bankroll-challenge-seen' + KEY_NS, seen = sessionStorage.getItem(key);
    if (seen === seed) return null;
    sessionStorage.setItem(key, seed);
  } catch(e){}
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
