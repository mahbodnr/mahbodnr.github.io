/* Bankroll · card packs: each pack has its own face design, court art, aces and back.
   Classic uses public-domain court art (Byron Knoll's Vector Playing Cards, see img/classic/SOURCE.md);
   the other packs are drawn here as SVG and coloured through CSS variables set per pack. */
'use strict';

const PACKS = [
  { id:'classic',   name:'Classic',   level:1, back:['#93303d', '#6e1f2b'], note:'Traditional English courts' },
  { id:'clear',     name:'Clear',     level:1, back:['#2f6db5', '#173f73'], note:'Big, easy-to-read corners for small screens' },
  { id:'deco',      name:'Deco',      level:2, back:['#3a5ca8', '#1a2b5c'], note:'Art-deco gold and navy' },
  { id:'botanical', name:'Botanical', level:3, back:['#26876a', '#0f4a36'], note:'Laurels and engraved ink' },
  { id:'onyx',      name:'Onyx',      level:4, back:['#4a4a52', '#141417'], note:'Black cards, gold monograms' },
  { id:'royal',     name:'Royal',     level:5, back:['#7b4bb0', '#3d1f63'], note:'Baroque cameos in purple' },
];
// earlier versions picked a card back; map it to the matching pack
const BACK_TO_PACK = { burgundy:'classic', midnight:'deco', emerald:'botanical', onyx:'onyx', royal:'royal' };
const packById = id => PACKS.find(p => p.id === id);
function currentPack(){
  const p = packById(prefs.pack);
  return p && bestLevel() >= p.level ? p.id : 'classic';
}

/* ---------- SVG building blocks ---------- */
const F = (v, n = 1) => +v.toFixed(n);
// sunburst rays fanning up from the bottom centre of a half panel
function rays(cx, cy, r, from, to, n){
  let d = '';
  for (let i = 0; i < n; i++){
    const a1 = (from + (to - from) * (i / n)) * Math.PI / 180, a2 = (from + (to - from) * ((i + .5) / n)) * Math.PI / 180;
    d += `M${cx} ${cy}L${F(cx + r * Math.cos(a1))} ${F(cy + r * Math.sin(a1))}L${F(cx + r * Math.cos(a2))} ${F(cy + r * Math.sin(a2))}Z`;
  }
  return d;
}
// leaves along an arc: used for the laurel wreaths
function laurel(cx, cy, r, from, to, n, side){
  let out = '';
  for (let i = 0; i < n; i++){
    const t = from + (to - from) * (i / (n - 1)), a = t * Math.PI / 180;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const tilt = t + (side > 0 ? 90 : -90) + (i % 2 ? 38 : -38) * side;
    const off = (i % 2 ? 3.2 : -3.2);
    const lx = x + off * Math.cos(a), ly = y + off * Math.sin(a);
    out += `<ellipse cx="${F(lx)}" cy="${F(ly)}" rx="5.6" ry="2.3" transform="rotate(${F(tilt)} ${F(lx)} ${F(ly)})"/>`;
  }
  return out;
}
function beads(cx, cy, rx, ry, n, r){
  let out = '';
  for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; out += `<circle cx="${F(cx + rx * Math.cos(a))}" cy="${F(cy + ry * Math.sin(a))}" r="${r}"/>`; }
  return out;
}

const G = 'style="fill:var(--gold)"', LN = 'style="fill:var(--line)"', SK = 'style="fill:var(--skin)"';
const strokeG = w => `style="fill:none;stroke:var(--gold);stroke-width:${w}"`;
const eyes = y => `<path d="M43.6 ${y}h4M52.4 ${y}h4" style="stroke:var(--line);stroke-width:1.5;stroke-linecap:round"/>`;

/* Deco: geometric half figures (100 × 78), drawn twice, the second turned upside down */
const DECO = {
  K: `<path d="${rays(50, 80, 92, 196, 344, 14)}" style="fill:var(--gold);opacity:.16"/>
    <rect x="80" y="7" width="3.6" height="71" ${G}/><rect x="74" y="19" width="15.6" height="3.4" rx="1" ${G}/><circle cx="81.8" cy="6" r="2.8" ${G}/>
    <path d="M9 78 L18 55 Q50 44 82 55 L91 78 Z" fill="currentColor"/>
    <path d="M19 55.5 Q9.5 62 11 78 L25 78 Q23.5 66 27.5 58.5 Z" ${LN}/><path d="M81 55.5 Q90.5 62 89 78 L75 78 Q76.5 66 72.5 58.5 Z" ${LN}/>
    <path d="M28 78 L50 57 L72 78" ${strokeG(2.4)}/><path d="M38 78 L50 66.5 L62 78" ${strokeG(2.4)}/>
    <rect x="11" y="73" width="14" height="2.6" ${G}/><rect x="75" y="73" width="14" height="2.6" ${G}/>
    <circle cx="81.8" cy="69" r="4.2" ${SK}/><circle cx="18" cy="69" r="4" ${SK}/>
    <rect x="45" y="39" width="10" height="11" ${SK}/>
    <path d="M33 50.5 L50 62 L67 50.5 L60.5 46.5 L50 53.5 L39.5 46.5 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.8"/>
    <ellipse cx="50" cy="28" rx="10.6" ry="12.6" style="fill:var(--skin);stroke:var(--line);stroke-width:.8"/>
    <path d="M39.4 29 Q40 47 50 50.5 Q60 47 60.6 29 Q55.5 35.5 50 35 Q44.5 35.5 39.4 29 Z" ${LN}/>
    <path d="M45 37.6 Q50 36 55 37.6" style="fill:none;stroke:var(--skin);stroke-width:1.1"/>
    ${eyes(25.2)}<path d="M50 25.6v5" style="stroke:var(--line);stroke-width:.9"/>
    <path d="M37.4 18.6 V6 L42.6 11.4 L46 2.6 L50 9.4 L54 2.6 L57.4 11.4 L62.6 6 V18.6 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.9;stroke-linejoin:round"/>
    <rect x="37.4" y="15.6" width="25.2" height="4" fill="currentColor"/>
    <circle cx="46" cy="4" r="1.4" fill="currentColor"/><circle cx="54" cy="4" r="1.4" fill="currentColor"/>`,
  Q: `<path d="${rays(50, 80, 92, 196, 344, 14)}" style="fill:var(--gold);opacity:.16"/>
    <path d="M25.6 66 C25.6 63 26 60 26.5 58" ${strokeG(1.8)}/>
    ${[0, 72, 144, 216, 288].map(a => `<circle cx="${F(26.5 + 3.6 * Math.cos(a * Math.PI / 180))}" cy="${F(53 + 3.6 * Math.sin(a * Math.PI / 180))}" r="2.9" ${G}/>`).join('')}<circle cx="26.5" cy="53" r="2" fill="currentColor"/>
    <path d="M34.5 24 Q34.5 7 50 7 Q65.5 7 65.5 24 L68.5 55 Q50 59 31.5 55 Z" ${LN}/>
    <path d="M13 78 L22 57 Q50 48 78 57 L87 78 Z" fill="currentColor"/>
    <path d="M22 57.5 Q12.5 64 14 78 L27 78 Q26 67 30 60 Z" ${LN}/><path d="M78 57.5 Q87.5 64 86 78 L73 78 Q74 67 70 60 Z" ${LN}/>
    <path d="M30 78 Q50 61 70 78" ${strokeG(2.4)}/><path d="M40 78 Q50 69.5 60 78" ${strokeG(2.4)}/>
    <rect x="14" y="73" width="13" height="2.6" ${G}/><rect x="73" y="73" width="13" height="2.6" ${G}/>
    <circle cx="25.6" cy="66.5" r="4" ${SK}/><circle cx="76" cy="69" r="3.8" ${SK}/>
    <rect x="45.2" y="38" width="9.6" height="12" ${SK}/>
    <path d="M40.5 50.5 Q50 58.5 59.5 50.5" ${strokeG(2.2)}/><circle cx="50" cy="57" r="2.1" fill="currentColor" style="stroke:var(--gold);stroke-width:.8"/>
    <ellipse cx="50" cy="28" rx="9.6" ry="12" style="fill:var(--skin);stroke:var(--line);stroke-width:.8"/>
    <path d="M40.4 25 Q41.5 14 50 13 Q58.5 14 59.6 25 Q55 18.5 50 18.6 Q45 18.5 40.4 25 Z" ${LN}/>
    ${eyes(26.2)}<ellipse cx="50" cy="34.6" rx="2.6" ry="1.2" fill="currentColor"/>
    <path d="M39.6 15.4 Q50 1.5 60.4 15.4 Q50 10.5 39.6 15.4 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.8"/>
    <path d="M50 11.5 V3 M44.5 12.5 L42 6 M55.5 12.5 L58 6" style="stroke:var(--gold);stroke-width:1.2"/><circle cx="50" cy="9.6" r="2" fill="currentColor"/>`,
  J: `<path d="${rays(50, 80, 92, 196, 344, 14)}" style="fill:var(--gold);opacity:.16"/>
    <path d="M21.5 78 L27 5" style="stroke:var(--gold);stroke-width:2.6"/>
    <path d="M26.3 11 C16.5 9 14.5 20 16.8 24.5 C20.5 20.5 23.5 19.5 25.6 19.4 Z" ${G}/><path d="M27 5 L25.3 -1 L29 4 Z" ${G}/>
    <path d="M11 78 L20 57 Q50 48 80 57 L89 78 Z" fill="currentColor"/>
    <path d="M20 57.5 Q10.5 64 12 78 L26 78 Q25 67 29 60 Z" ${LN}/><path d="M80 57.5 Q89.5 64 88 78 L74 78 Q75 67 71 60 Z" ${LN}/>
    <path d="M43 78 V61 M57 78 V61" ${strokeG(2.6)}/>
    <rect x="12" y="73" width="14" height="2.6" ${G}/><rect x="74" y="73" width="14" height="2.6" ${G}/>
    <circle cx="23.2" cy="64" r="4" ${SK}/><circle cx="80" cy="69" r="3.8" ${SK}/>
    <rect x="45.2" y="39" width="9.6" height="11" ${SK}/>
    <path d="M35.5 51 L38.5 56.5 L41.5 51 L44.5 56.5 L47.5 51 L50.5 56.5 L53.5 51 L56.5 56.5 L59.5 51 L62.5 56.5 L64.5 51 Q50 46.5 35.5 51 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.7"/>
    <ellipse cx="50" cy="29.5" rx="9.6" ry="11.6" style="fill:var(--skin);stroke:var(--line);stroke-width:.8"/>
    <path d="M40.4 30 Q38.6 17 50 16 Q61.4 17 59.6 30 L58.2 23 Q50 19.6 41.8 23 Z" ${LN}/>
    ${eyes(28)}<path d="M46.2 35.2 Q50 33.6 53.8 35.2" style="fill:none;stroke:var(--line);stroke-width:1"/>
    <path d="M37 20.6 L63 20.6 L60 9 Q50 4.6 40 9 Z" style="fill:currentColor;stroke:var(--line);stroke-width:.8"/>
    <rect x="35" y="18.6" width="30" height="3.6" rx="1.6" ${G}/>
    <path d="M60 11.5 C68 2.5 78 .8 85 3.6 C77 5 69 9 62 14.5 Z" ${G}/>`,
};

/* Royal: profile cameos in a beaded gold frame (100 × 78) */
const PROFILE = 'M66 76 C64 68 61 61 62 57 C68 51 70 41 66 31 C62 21 52 18 45 21 C40 24 39 29 40 33 L35 39.5 C35 41 37 41.5 39 42 L38 44.2 L40 45.6 L38.6 47.4 C39 51 40 53 43 54.5 C45 55.5 47 56 48 57 L47 63 C42 67 35 71 31 78 L70 78 Z';
const cameo = (id, extra) => `<defs><clipPath id="cp-${id}"><ellipse cx="50" cy="40" rx="30" ry="33.5"/></clipPath></defs>
    <ellipse cx="50" cy="40" rx="30" ry="33.5" style="fill:var(--cameo)"/>
    <g clip-path="url(#cp-${id})"><path d="${PROFILE}" fill="currentColor"/>${extra}</g>
    <ellipse cx="50" cy="40" rx="31.6" ry="35.1" ${strokeG(2.6)}/><ellipse cx="50" cy="40" rx="27.6" ry="31" ${strokeG(.7)}/>
    <g ${G}>${beads(50, 40, 34.4, 37.6, 28, 1.1)}</g>
    <path d="M44 1.5 L50 6 L56 1.5 L54 7.5 L46 7.5 Z" ${G}/>`;
const ROYAL = {
  K: cameo('rk', `<path d="M39 45 C36.5 53 39.5 63 49 64 C52 58.5 51 53 48.5 50.5 Z" fill="currentColor"/>
      <path d="M43.5 22 L45 9.5 L49.6 15.6 L54 7 L58 14.6 L63 9 L64.6 23.5 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.6"/>
      <path d="M31 73 Q50 63.5 70 73 L70 78 L31 78 Z" ${G}/>${beads(50, 79, 17, 6, 10, .9).replace(/<circle/g, '<circle style="fill:var(--cameo)"')}`),
  Q: cameo('rq', `<circle cx="66" cy="30.5" r="8.2" fill="currentColor"/>
      <path d="M45 21 L48.2 12.5 L52.2 17.6 L56 10 L60 17.4 L63.4 13 L64 22 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.6"/>
      <path d="M43.5 61 Q52.5 67.5 61 60.5" ${strokeG(1.5)}/><circle cx="52.4" cy="66" r="1.8" ${G}/>`),
  J: cameo('rj', `<path d="M40.5 24 C42 12.5 58 8 71 17.5 C64.5 22 54 23 40.5 24 Z" fill="currentColor"/>
      <path d="M40.5 24 C53 23 63.5 21.6 70 18.4 L71 21 C64 24.4 53.5 25.6 40.5 26.6 Z" ${G}/>
      <path d="M66 14.5 C73.5 4.5 83.5 2.5 90 4.5 C82 6.6 74.5 10.6 68.5 17.5 Z" ${G}/>
      <path d="M33 74 Q50 66 69 74" ${strokeG(2)}/>`),
};

/* Botanical: laurel wreath emblem with an italic initial (100 × 156, not mirrored) */
const WREATH = `<g style="fill:var(--leaf)">${laurel(50, 80, 33, 118, 248, 12, 1)}${laurel(50, 80, 33, 62, -68, 12, -1)}</g>
  <path d="M50 113 C35 112 22 100 18 84 M50 113 C65 112 78 100 82 84" style="fill:none;stroke:var(--leaf);stroke-width:1.1"/>
  <path d="M50 112 L42 121 L46 121.5 L50 116 L54 121.5 L58 121 Z" ${G}/><circle cx="50" cy="112.5" r="2" ${G}/>`;
const VINE = `<path d="M6 16 C6 9 10 6 16 6 M10 6 C8 9 7 11 6 16" style="fill:none;stroke:var(--leaf);stroke-width:1"/>
  <ellipse cx="13" cy="10" rx="3.2" ry="1.4" transform="rotate(-40 13 10)" style="fill:var(--leaf)"/>`;
const BOT_CROWN = {
  K: `<path d="M38 41 L36 29 L42.5 34 L50 25.5 L57.5 34 L64 29 L62 41 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.6"/>`,
  Q: `<path d="M39 41 Q50 26 61 41 Q50 36.5 39 41 Z" style="fill:var(--gold);stroke:var(--line);stroke-width:.6"/><circle cx="50" cy="31.6" r="2.2" fill="currentColor"/>`,
  J: `<path d="M50 41 C50 35 47 30 42 28 M50 41 C50 35 53 30 58 28" style="fill:none;stroke:var(--leaf);stroke-width:1.2"/><circle cx="42" cy="28" r="2.6" ${G}/><circle cx="58" cy="28" r="2.6" ${G}/><circle cx="50" cy="32" r="2.4" fill="currentColor"/>`,
};

/* Ace ornaments (100 × 100), drawn behind the big pip */
const ACE_ORN = {
  deco: `<path d="${rays(50, 50, 50, 0, 360, 24)}" style="fill:var(--gold);opacity:.22"/>
    <rect x="22" y="22" width="56" height="56" transform="rotate(45 50 50)" ${strokeG(1.4)}/><rect x="27" y="27" width="46" height="46" transform="rotate(45 50 50)" ${strokeG(.6)}/>`,
  botanical: `<g style="fill:var(--leaf)">${laurel(50, 50, 33, 115, 250, 9, 1)}${laurel(50, 50, 33, 65, -70, 9, -1)}</g>`,
  onyx: `<circle cx="50" cy="50" r="40" ${strokeG(.8)}/><circle cx="50" cy="50" r="36" ${strokeG(.4)}/>
    <path d="M50 4 V12 M50 88 V96 M4 50 H12 M88 50 H96" style="stroke:var(--gold);stroke-width:.8"/>`,
  royal: `<g ${G}>${Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<circle cx="${F(50 + 37 * Math.cos(a))}" cy="${F(52 + 37 * Math.sin(a))}" r="6.5" style="fill:none;stroke:var(--gold);stroke-width:1.2"/>`; }).join('')}</g>
    <circle cx="50" cy="52" r="33" style="fill:var(--cameo)"/><circle cx="50" cy="52" r="33" ${strokeG(1.4)}/>
    <path d="M40 15 L38.5 5 L44 9 L50 1.5 L56 9 L61.5 5 L60 15 Z" ${G}/>`,
};

// Builds the sprite of court, wreath and ornament symbols once, on boot.
(function injectSprite(){
  const sym = (id, vb, body) => `<symbol id="${id}" viewBox="${vb}">${body}</symbol>`;
  let s = '';
  for (const r of ['K', 'Q', 'J']){
    s += sym(`ct-deco-${r}`, '0 0 100 78', DECO[r]);
    s += sym(`ct-royal-${r}`, '0 0 100 78', ROYAL[r]);
  }
  s += sym('bot-wreath', '0 0 100 156', WREATH) + sym('bot-vine', '0 0 30 30', VINE);
  for (const k in ACE_ORN) s += sym(`ace-${k}`, '0 0 100 100', ACE_ORN[k]);
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0'); holder.setAttribute('aria-hidden', 'true');
  holder.style.position = 'absolute';
  holder.innerHTML = `<defs>${s}</defs>`;
  document.body.appendChild(holder);
})();

const RANK_LETTER = { 11:'J', 12:'Q', 13:'K' };

// The centre panel of a J, Q or K in the given pack. The panel is 100 × 176 (it matches the card's centre area),
// split into two mirrored halves of 100 × 88 for the double-headed designs.
// Clear: the rank, very large, with its suit once under it: the corner index does it all
const CROWN = '<svg class="cl-crown" viewBox="0 0 40 24" aria-hidden="true"><path d="M3 20 L1 5 L11 12 L20 1 L29 12 L39 5 L37 20 Z"/><rect x="3" y="20" width="34" height="4" rx="1"/></svg>';
function clearMid(c){ return ''; }                                   // (the crown on court cards was dropped: the big J/Q/K says it)
function courtHTML(c, pk){
  if (pk === 'clear') return clearMid(c);
  const R = RANK_LETTER[c.rank], suit = `<use href="#su-${c.suit}"`;
  const flip = 'transform="rotate(180 50 88)"';
  if (pk === 'classic')
    return `<div class="court"><img src="img/classic/${R}${c.suit}.webp" alt="" draggable="false" decoding="async"></div>`;
  if (pk === 'deco' || pk === 'royal')
    return `<div class="court"><svg viewBox="0 0 100 176" aria-hidden="true">
      <use href="#ct-${pk}-${R}" y="4" width="100" height="84"/><use href="#ct-${pk}-${R}" y="4" width="100" height="84" ${flip}/>
      <path d="M0 88H100" class="ct-mid"/>
      ${suit} x="82" y="4" width="14" height="14"/>${suit} x="82" y="4" width="14" height="14" ${flip}/></svg></div>`;
  if (pk === 'botanical')
    return `<div class="court"><svg viewBox="0 0 100 176" aria-hidden="true">
      <use href="#bot-vine" width="34" height="34"/><use href="#bot-vine" width="34" height="34" ${flip}/>
      <g transform="translate(-14 2) scale(1.28)"><use href="#bot-wreath" width="100" height="156"/>${BOT_CROWN[R]}
      <text x="50" y="96" class="ct-letter">${R}</text>${suit} x="43.5" y="99" width="13" height="13"/></g></svg></div>`;
  // onyx: a monogram between hairlines
  return `<div class="court"><svg viewBox="0 0 100 176" aria-hidden="true">
      <rect x="3" y="3" width="94" height="170" class="ct-hair"/><rect x="7" y="7" width="86" height="162" class="ct-hair thin"/>
      <path d="M7 169 L93 7" class="ct-hair thin"/>
      ${suit} x="42" y="16" width="16" height="16"/>${suit} x="42" y="16" width="16" height="16" ${flip}/>
      <text x="50" y="121" class="ct-mono">${R}</text></svg></div>`;
}
function aceHTML(c, pk){
  if (pk === 'clear') return clearMid(c);
  const orn = ACE_ORN[pk] ? `<svg class="ace-orn" viewBox="0 0 100 100" aria-hidden="true"><use href="#ace-${pk}"/></svg>` : '';
  return `<div class="pips ace">${orn}${suitSVG(c.suit, 'pp')}</div>`;
}
