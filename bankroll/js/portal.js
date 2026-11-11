/* Bankroll · games portals (CrazyGames). Only active in the portal build (tools/build-crazygames.mjs sets
   BANKROLL_CONFIG.portal = 'crazygames'); everywhere else every call here does nothing.
   - the CrazyGames SDK (loaded by the portal page): loading and gameplay start/stop events, the portal's mute setting,
     a celebration on a new leaderboard place, the logged-in CrazyGames user's name for the boards
   - no outside sign-in, links or sharing on the portal (their rules): see onPortal() in leaderboard.js and social.js
   - the privacy page in Settings */
'use strict';

const PORTAL = (window.BANKROLL_CONFIG && window.BANKROLL_CONFIG.portal) || null;
const onPortal = () => !!PORTAL;
const Portal = {
  sdk: null, ready: null, playing: null, muted: false,
  init(){
    if (PORTAL !== 'crazygames') return Promise.resolve(null);
    if (!this.ready) this.ready = (async () => {
      try {
        const C = window.CrazyGames && window.CrazyGames.SDK;
        if (!C) return null;
        await C.init();
        this.sdk = C;
        const apply = s => { this.muted = !!(s && s.muteAudio); if (typeof applyMusic === 'function') applyMusic(); };
        apply(C.game.settings);
        try { C.game.addSettingsChangeListener(apply); } catch(e){}
        // logging in or out on CrazyGames mid-game: the leaderboard name follows (their username, or the guest name)
        try { C.user.addAuthListener(user => { if (LB.backend && LB.backend.portalProfile) LB.backend.portalProfile(user || null).then(ok => { if (ok){ LB.myName = LB.backend.portalName; LB.backend.refresh(); } }); }); } catch(e){}
        return C;
      } catch(e){ return null; }
    })();
    return this.ready;
  },
  call(fn){ try { if (this.sdk) fn(this.sdk); } catch(e){} },
  loadingStart(){ this.init().then(() => this.call(C => C.game.loadingStart())); },
  // loaded: from here on, gameplay start/stop follow the game (the first start marks the end of the initial download)
  loadingStop(){ this.init().then(() => { this.call(C => C.game.loadingStop()); this.loaded = true; this.gameplay(portalPlaying()); }); },
  // playing: a hand on the table with no window over it (menus, the run's end and the leaderboard are breaks)
  gameplay(on){
    if (!this.sdk || !this.loaded || this.playing === on) return;
    this.playing = on;
    this.call(C => on ? C.game.gameplayStart() : C.game.gameplayStop());
  },
  happytime(){ this.call(C => C.game.happytime()); },
  // the logged-in CrazyGames player ({ username, profilePictureUrl }), or null for a guest
  async user(){
    await this.init();
    try { return this.sdk && this.sdk.user && this.sdk.user.isUserAccountAvailable ? await this.sdk.user.getUser() : null; } catch(e){ return null; }
  },
};
// a guest's name on the boards, made once on this device: "Guest 4821"
function guestName(){
  let n = load('bankroll-guest-name');
  if (!n){ n = 'Guest ' + String(1000 + Math.floor(Math.random() * 9000)); store('bankroll-guest-name', n); }
  return n;
}
const portalPlaying = () => !!(S && !ui.modal && S.phase !== 'over');
if (onPortal()) Portal.loadingStart();

/* ---------- privacy ---------- */
function privacyHTML(){
  if (PORTAL === 'reddit') return `<div class="rs-eyebrow">Bankroll</div><h2>Privacy</h2>
    <div class="privacy">
      <p>Bankroll keeps a leaderboard, so this Reddit app stores a little about your play in its own storage on Reddit:</p>
      <ul>
        <li><b>Your Reddit username and account ID</b>, to put your runs on the boards. Nothing else from your account.</li>
        <li><b>Your runs</b>: the moves, levels, coins and best hands, used for the leaderboards and the daily challenge, and to check scores are real.</li>
      </ul>
      <p>Your settings and your game in progress stay in this browser. Nothing is sold or shared, and there are no ads.</p>
      <p>Logged out of Reddit, you can still play; nothing is stored about you.</p>
    </div>
    <div class="actions"><button class="btn gold" data-act="close">OK</button></div>`;
  return `<div class="rs-eyebrow">Bankroll</div><h2>Privacy</h2>
    <div class="privacy">
      <p>Bankroll keeps a leaderboard, so it stores a little about your play on its own server (Supabase):</p>
      <ul>
        <li><b>A random player ID</b> for this browser, made when you first play. No email, password or real name.</li>
        <li><b>Your name on the boards</b>: your CrazyGames username if you're logged in there, otherwise a guest name like "Guest 4821".</li>
        <li><b>Your runs</b>: the moves, levels, coins and best hands, used for the leaderboards and the daily challenge, and to check scores are real.</li>
        <li><b>Basic visit counts</b>: the day, whether it's a phone or a computer, the browser language and your time zone. No cookies for advertising, and nothing is sold or shared.</li>
      </ul>
      <p>Your settings and your game in progress are saved through CrazyGames: on your CrazyGames account if you're logged in, otherwise in this browser.</p>
      <p>Bankroll does not use your data for anything else, and you can ask for your runs to be removed through the game's page on CrazyGames.</p>
    </div>
    <div class="actions"><button class="btn gold" data-act="close">OK</button></div>`;
}
