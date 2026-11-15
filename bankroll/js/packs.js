/* Bankroll · card packs. Classic uses public-domain court art (Byron Knoll's Vector Playing Cards, see img/classic/SOURCE.md)
   on the game's own drawn cards; Clear is drawn by the game for small screens. The other packs are pictures: one SVG
   per card and a back (img/packs/<pack>/, from SVG kits: img/packs/SOURCE.md, tools/build-packs.mjs), unlocked by
   level. Tarot puts a Rider–Waite–Smith picture on every card (img/tarot/SOURCE.md; off for now). */
'use strict';

const PACKS = [
  { id:'classic',   name:'Classic',      level:1,  back:['#b8282f', '#8e1b22'], note:'Traditional English courts' },
  { id:'clear',     name:'Clear',        level:1,  back:['#2f6db5', '#173f73'], note:'Big, easy-to-read corners for small screens' },
  { id:'arcade',    name:'Retro Arcade', level:2,  back:['#2a2350', '#120e2a'], img:true, note:'Pixel heroes in neon' },
  { id:'sketch',    name:'Hand Drawn',   level:5,  back:['#efe2c4', '#c9b48a'], img:true, note:'Inked birds, foxes and plants' },
  { id:'seasons',   name:'Four Seasons', level:10, back:['#5b7c4a', '#2f4426'], img:true, note:'A suit for every season' },
  { id:'clockwork', name:'Clockmaker',   level:15, back:['#3b2f22', '#1e1710'], img:true, note:'Gears, springs and brass' },
  { id:'deco',      name:'Art Deco',     level:20, back:['#1a1813', '#100f0d'], img:true, note:'Black and gold casino' },
];
// The Tarot pack is off for now (its pictures, img/tarot/, are left out of every build: tools/build-site.mjs,
// tools/build-crazygames.mjs). To bring it back: TAROT_ON = true and remove those exclusions.
const TAROT_ON = typeof window !== 'undefined' && window.BANKROLL_TAROT === true;   // (tests turn it on)
if (TAROT_ON) PACKS.push({ id:'tarot', name:'Tarot', level:4, back:['#2b5d78', '#0f2a3a'], note:'The 1909 Rider–Waite–Smith pictures' });
// earlier versions picked a card back, or a pack that has since gone: the Classic pack
const BACK_TO_PACK = { burgundy:'classic' };
const packById = id => PACKS.find(p => p.id === id);
function currentPack(){
  const p = packById(prefs.pack);
  return p && bestLevel() >= p.level ? p.id : 'classic';
}
const isImgPack = pk => !!(packById(pk) || {}).img;
// a picture pack's file for a card (S01 … C13) or its back
const packSrc = (pk, c) => `img/packs/${pk}/${c ? c.suit + String(c.rank).padStart(2, '0') : 'back'}.svg`;
// a card of a picture pack: the whole face is the picture (corners included). Jokers are the game's own (the kits have none)
function imgCardInner(c, pk){ return `<img class="cimg" src="${packSrc(pk, c)}" alt="" draggable="false" decoding="async">`; }

const RANK_LETTER = { 11:'J', 12:'Q', 13:'K' };

// The centre panel of a J, Q or K in the given pack. The panel is 100 × 176 (it matches the card's centre area),
// split into two mirrored halves of 100 × 88 for the double-headed designs.
// Clear: the rank, very large, with its suit once under it: the corner index does it all
const CROWN = '<svg class="cl-crown" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 20 L1 5 L11 12 L20 1 L29 12 L39 5 L37 20 Z"/><rect x="3" y="20" width="34" height="4" rx="1"/></svg>';
function clearMid(c){ return ''; }                                   // (the crown on court cards was dropped: the big J/Q/K says it)
// The Classic pack's face-card art downloads quietly as soon as the game is up, so a J, Q or K never arrives blank
// in the middle of a hand (the images otherwise load only when the first one is dealt).
const COURT_IMGS = [];
// the Tarot pack's picture for a card: suit + rank (H01 … S13), or JR / JB for the Jokers (The Fool, The Magician)
const tarotSrc = c => `img/tarot/${isJoker(c) ? (c.suit === 'JR' ? 'JR' : 'JB') : c.suit + String(c.rank).padStart(2, '0')}.webp`;
function tarotHTML(c){ return `<div class="tart"><img src="${tarotSrc(c)}" alt="" draggable="false" decoding="async"></div>`; }
let preloaded = '';
function preloadCourts(){
  const pk = currentPack();
  if (preloaded === pk || (pk !== 'classic' && pk !== 'tarot' && !isImgPack(pk))) return;
  preloaded = pk; COURT_IMGS.length = 0;
  const all = f => ['S', 'H', 'D', 'C'].flatMap(s => Array.from({ length:13 }, (_, i) => f({ rank:i + 1, suit:s })));
  const srcs = pk === 'tarot' ? all(tarotSrc).concat(['img/tarot/JR.webp', 'img/tarot/JB.webp'])
    : isImgPack(pk) ? all(c => packSrc(pk, c)).concat([packSrc(pk)])        // a picture pack: every card and its back
    : ['J', 'Q', 'K'].flatMap(R => ['S', 'H', 'D', 'C'].map(s => `img/classic/${R}${s}.webp`));
  const go = () => srcs.forEach(src => {
    const im = new Image(); im.decoding = 'async'; im.src = src;
    if (im.decode) im.decode().catch(() => {});
    COURT_IMGS.push(im);                               // kept, so the decoded pictures stay ready
  });
  if (window.requestIdleCallback) requestIdleCallback(go, { timeout:1500 }); else setTimeout(go, 300);
}
function courtHTML(c, pk){
  if (pk === 'clear') return clearMid(c);
  return `<div class="court"><img src="img/classic/${RANK_LETTER[c.rank]}${c.suit}.webp" alt="" draggable="false" decoding="async"></div>`;
}
function aceHTML(c, pk){
  if (pk === 'clear') return clearMid(c);
  return `<div class="pips ace">${suitSVG(c.suit, 'pp')}</div>`;
}
