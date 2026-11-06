/* Bankroll · boot: load saved game and start */
'use strict';

/* ================= boot ================= */
function start(data){
  const savedPrefs = load(PREF_KEY) || {};
  prefs = Object.assign({}, PREF_DEFAULTS, prefs, savedPrefs);
  if (prefs.sort !== 'rank' && prefs.sort !== 'suit') prefs.sort = 'rank';
  if (!prefs.themeChosen) prefs.theme = 'dark';   // dark unless the player picked a theme
  if (!savedPrefs.pack && savedPrefs.back) prefs.pack = BACK_TO_PACK[savedPrefs.back] || 'classic';   // older saves chose a card back
  // first visit: a guided first hand instead of the rules page; returning players skip it
  if (prefs.tutDone === undefined) prefs.tutDone = !!load('bankroll-seen-help' + KEY_NS);
  applyPrefs();
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
  // first visit: the introduction (three practice hands), which can't be skipped; the player's run starts after it
  if (!prefs.tutDone) startIntro(false);
  store(PREF_KEY, prefs);
  window.claude?.hot?.snapshot?.(() => ({ S }));
  render();
  refreshBoard();
  initLeaderboard();
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});

// On the website only (it has a manifest; the claude.ai page doesn't): keep a copy of the game for offline play.
if ('serviceWorker' in navigator && window.isSecureContext && location.protocol !== 'file:' && !window.claude && document.querySelector('link[rel="manifest"]'))
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
