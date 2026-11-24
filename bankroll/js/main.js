/* Bankroll · boot: load saved game and start */
'use strict';

/* ================= boot ================= */
function start(data){
  const savedPrefs = load(PREF_KEY) || {};
  prefs = Object.assign({}, PREF_DEFAULTS, prefs, savedPrefs);
  if (prefs.sort !== 'rank' && prefs.sort !== 'suit') prefs.sort = 'rank';
  if (!prefs.themeChosen) prefs.theme = 'dark';   // dark unless the player picked a theme
  // where audio must be opted into (Reddit: js/reddit-inline.js), no sound or music until the player turns it on
  if (typeof AUDIO_OPT_IN !== 'undefined' && AUDIO_OPT_IN && !savedPrefs.audioChosen){ prefs.sound = false; prefs.music = false; }
  if (!savedPrefs.pack && savedPrefs.back) prefs.pack = BACK_TO_PACK[savedPrefs.back] || 'classic';   // older saves chose a card back
  // first visit: a guided first hand instead of the rules page; returning players skip it
  if (prefs.tutDone === undefined) prefs.tutDone = !!load('bankroll-seen-help' + KEY_NS);
  applyPrefs(); musicBtnState();
  const saved = migrate((data && data.S) || load(SAVE_KEY));
  if (saved){
    S = saved;
    if (S.phase === 'result') ui.modal = 'result';
    else if (S.phase === 'over') ui.modal = 'over';
    else if (S.phase === 'reshuffle') ui.modal = 'reshuffle';
    else if (S.phase === 'swapPick') ui.modal = 'pick';
    S.hand.forEach(c => ui.seen.add(c.id));
  } else {
    if (prefs.tutDone) newGame();
    store('bankroll-seen-help' + KEY_NS, true);
  }
  // opened from a group challenge or duel link: straight to the challenge page (the introduction waits for a later visit)
  const incoming = incomingSeed();
  const toGroup = !!ui.pendingGroup || !!(saved && saved.challenge && saved.phase !== 'over');
  if (ui.pendingGroup && window.BANKROLL_CONFIG) showGroupEarly(ui.pendingGroup);
  // a new player starts a real run straight away, with a Tutorial button on the table until their first hand is over
  // (and, if that hand loses, an offer to take it); the tutorial is three practice hands that can be skipped
  if (!S) newGame();
  if (!prefs.tutDone && prefs.tutHint === undefined) prefs.tutHint = true;
  store(PREF_KEY, prefs);
  window.claude?.hot?.snapshot?.(() => ({ S }));
  render();
  refreshBoard();
  initLeaderboard();
  revealWhenReady();
  preloadCourts();
  offerChallenge(incoming);   // opened from a shared challenge link (js/social.js)
  if (onPortal()) Portal.loadingStop();
}
/* ---------- a smooth start ----------
   The table stays invisible (css: html:not(.ready)) until what would make it jump is in: the fonts, the account's own
   state (its card packs, a run from another device) and the pictures of the cards on screen. Then it fades in. Usually
   that's a moment; a small spinner shows only if it takes longer, and after 1.8 seconds the game shows regardless. */
function cardPictures(root){
  const urls = new Set();
  root.querySelectorAll('img').forEach(im => { if (im.src) urls.add(im.src); });
  root.querySelectorAll('[style*="background-image"]').forEach(el => { const m = /url\(["']?([^"')]+)/.exec(el.style.backgroundImage || ''); if (m) urls.add(m[1]); });
  return Promise.all([...urls].map(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = res; im.src = u; if (im.complete) res(); })));
}
async function revealWhenReady(){
  const root = document.documentElement, wait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
  try {
    const t0 = Date.now();
    await wait(Promise.all([document.fonts ? document.fonts.ready : null, typeof accountReady !== 'undefined' ? accountReady : null]), 1800);
    render();                                              // (the account's packs or run may have changed the table)
    await wait(cardPictures(document.getElementById('app')), Math.max(150, 1800 - (Date.now() - t0)));
  } catch(e){}
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));
}
const boot = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
// CrazyGames: the SDK first (it loads the player's saved data), then the game, from the data module. If the SDK doesn't
// answer in 6 seconds the game starts anyway, on localStorage.
if (typeof onPortal === 'function' && onPortal()){
  let booted = false;
  const go = () => { if (booted) return; booted = true; if (Portal.sdk && Portal.sdk.data) SAVE_AREA = Portal.sdk.data; boot(); };
  Portal.init().then(go, go); setTimeout(go, 6000);
} else boot();

// On the website only (it has a manifest; the claude.ai page doesn't): keep a copy of the game for offline play.
if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:' && !window.claude && document.querySelector('link[rel="manifest"]'))
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
