/* Bankroll · Telegram Mini App. When the page is opened from the @TheBankrollBot (Telegram adds its signed launch
   data to the URL hash), this loads Telegram's SDK, matches the app's colours, uses Telegram's haptics and back
   button, and hands the launch data to the leaderboard so the player is signed in with their Telegram account.
   Anywhere else it does nothing. */
'use strict';

const BankrollTG = (() => {
  let initData = '';
  try {
    initData = new URLSearchParams(location.hash.slice(1)).get('tgWebAppData') || sessionStorage.getItem('bankroll-tg') || '';
    if (initData) sessionStorage.setItem('bankroll-tg', initData);   // survives a reload inside Telegram
  } catch(e){}
  if (!initData) return null;
  let user = null;
  try { user = JSON.parse(new URLSearchParams(initData).get('user')); } catch(e){}
  let startParam = null;
  try { startParam = new URLSearchParams(initData).get('start_param') || new URLSearchParams(location.hash.slice(1)).get('tgWebAppStartParam'); } catch(e){}
  const tg = { initData, user, app:null, startParam };
  document.documentElement.classList.add('in-telegram');

  const setup = app => {
    const at = v => typeof app.isVersionAtLeast === 'function' && app.isVersionAtLeast(v);
    try { app.ready(); app.expand(); } catch(e){}
    try { if (at('7.7')) app.disableVerticalSwipes(); } catch(e){}       // dragging cards shouldn't close the app
    try { if (at('6.1')){ app.setHeaderColor('#082621'); app.setBackgroundColor('#082621'); } } catch(e){}
    try { if (at('7.10')) app.setBottomBarColor('#082621'); } catch(e){}
    try { if (at('6.1')) app.BackButton.onClick(() => { if (ui.modal && CLOSABLE.includes(ui.modal)){ closeModal(); render(); } }); } catch(e){}
  };
  tg.ready = new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-web-app.js?59';
    s.async = true;
    s.onload = () => { tg.app = (window.Telegram && window.Telegram.WebApp) || null; if (tg.app) setup(tg.app); resolve(tg.app); if (S) render(); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return tg;
})();

if (BankrollTG){
  // Telegram's back button closes whichever dialog can be closed
  const baseRender = render;
  render = function(){
    baseRender();
    const app = BankrollTG.app;
    if (!app || !app.BackButton || !app.isVersionAtLeast || !app.isVersionAtLeast('6.1')) return;
    try { (ui.modal && CLOSABLE.includes(ui.modal)) ? app.BackButton.show() : app.BackButton.hide(); } catch(e){}
  };
  // navigator.vibrate doesn't work in Telegram on iPhone; its own haptics do
  const baseBuzz = buzz;
  buzz = function(pattern){
    const hf = BankrollTG.app && BankrollTG.app.HapticFeedback;
    if (!hf || !BankrollTG.app.isVersionAtLeast('6.1')) return baseBuzz(pattern);
    if (!prefs.haptics) return;
    const ms = Array.isArray(pattern) ? pattern.reduce((a, b) => a + b, 0) : +pattern || 0;
    try { Array.isArray(pattern) && pattern.length > 2 ? hf.notificationOccurred('error') : hf.impactOccurred(ms <= 15 ? 'light' : ms <= 40 ? 'medium' : 'heavy'); } catch(e){}
  };
}
