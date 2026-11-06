/* Bankroll · settings: sound, vibration, animation speed, theme, four-colour deck, cosmetics, seeds */
'use strict';

const PREF_DEFAULTS = { sound:true, volume:0.8, haptics:true, speed:'normal', theme:'dark', fourColor:false, pack:'classic', felt:'green', sort:'rank' };

// Card packs (js/packs.js) and table felts unlock as your best level climbs.
const FELTS = [
  { id:'green',    name:'Classic',  level:1, c1:'#17574b', c2:'#0f3d35' },
  { id:'ocean',    name:'Ocean',    level:2, c1:'#1f5a86', c2:'#123a5c' },
  { id:'crimson',  name:'Crimson',  level:3, c1:'#7d2a35', c2:'#561a22' },
  { id:'charcoal', name:'Charcoal', level:4, c1:'#3d424a', c2:'#23262b' },
  { id:'plum',     name:'Plum',     level:5, c1:'#5d3674', c2:'#3a1f4a' },
];
const bestLevel = () => Math.max((prefs.record && prefs.record.level) || 1, S ? lvl() : 1);
const isUnlocked = item => !!item && bestLevel() >= item.level;

function effectiveTheme(){
  if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
  const dt = document.documentElement.getAttribute('data-theme');
  if (dt === 'light' || dt === 'dark') return dt;
  try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch(e){ return 'dark'; }
}
function applyPrefs(){
  const r = document.documentElement;
  const light = effectiveTheme() === 'light';
  r.classList.toggle('light', light);
  r.style.colorScheme = light ? 'light' : 'dark';
  r.classList.toggle('four-color', !!prefs.fourColor);
  r.classList.toggle('speed-fast', prefs.speed === 'fast');
  r.classList.toggle('speed-off', prefs.speed === 'off');
  const pack = packById(currentPack());
  const felt = FELTS.find(f => f.id === prefs.felt && isUnlocked(f)) || FELTS[0];
  r.style.setProperty('--back-hi', pack.back[0]); r.style.setProperty('--back', pack.back[1]);
  r.style.setProperty('--table-hi', felt.c1); r.style.setProperty('--table', felt.c2);
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = light ? '#efe9dc' : '#082621';
}
try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyPrefs); } catch(e){}
try { new MutationObserver(applyPrefs).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] }); } catch(e){}

function setPref(k, v){
  if (!(k in PREF_DEFAULTS)) return;
  if (k === 'volume') v = Math.max(0, Math.min(1, +v));
  if (k === 'sound' || k === 'fourColor' || k === 'haptics') v = v === true || v === 'true';
  if (k === 'pack' && !isUnlocked(packById(v))) return;
  if (k === 'felt' && !isUnlocked(FELTS.find(x => x.id === v))) return;
  prefs[k] = v; if (k === 'theme') prefs.themeChosen = true;
  store(PREF_KEY, prefs); applyPrefs();
  if (k === 'sound' && v) sfx('coin');
  if (k === 'haptics' && v) buzz(20);
}

const LOCK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
function settingsHTML(){
  const seg = (k, opts, label) => `<div class="sg" role="group" aria-label="${label}">${opts.map(([v, t]) =>
    `<button data-act="setPref" data-k="${k}" data-v="${v}" aria-pressed="${String(prefs[k]) === String(v)}">${t}</button>`).join('')}</div>`;
  const toggle = (k, label, note) => `<div class="srow"><span>${label}${note ? `<small>${note}</small>` : ''}</span>
    <button class="switch" role="switch" data-act="setPref" data-k="${k}" data-v="${!prefs[k]}" aria-checked="${!!prefs[k]}" aria-label="${label}"><i></i></button></div>`;
  const swatches = (k, list, kind) => `<div class="swatches">${list.map(it => {
    const ok = isUnlocked(it), on = (prefs[k] || list[0].id) === it.id;
    return `<button class="sw sw-${kind}" data-act="setPref" data-k="${k}" data-v="${it.id}" ${ok ? '' : 'disabled'} aria-pressed="${on}" style="--c1:${it.c1};--c2:${it.c2}" title="${ok ? it.name : `Reach level ${it.level} to unlock`}">
      <span class="swv"></span><b>${it.name}</b>${ok ? '' : `<small>${LOCK_SVG}Level ${it.level}</small>`}</button>`; }).join('')}</div>`;
  return `<h2>Settings</h2>
    <h3>Sound</h3>
    ${toggle('sound', 'Sound effects')}
    <div class="srow"><span>Volume</span><input type="range" id="volRange" min="0" max="100" value="${Math.round((prefs.volume ?? .8) * 100)}" aria-label="Volume" ${prefs.sound ? '' : 'disabled'}></div>
    ${toggle('haptics', 'Vibration')}
    <h3>Look</h3>
    <div class="srow"><span>Theme</span>${seg('theme', [['system','System'],['dark','Dark'],['light','Light']], 'Theme')}</div>
    <div class="srow"><span>Animations</span>${seg('speed', [['normal','Normal'],['fast','Fast'],['off','Off']], 'Animations')}</div>
    ${toggle('fourColor', 'Four-colour deck')}
    <h3>Card pack</h3>
    <div class="packs">${PACKS.map(p => {
      const ok = isUnlocked(p), on = currentPack() === p.id;
      const demo = [{ id:'pv-k-' + p.id, rank:13, suit:'S' }, { id:'pv-q-' + p.id, rank:12, suit:'H' }, { id:'pv-a-' + p.id, rank:1, suit:'D' }]
        .map(c => cardHTML(c, { pack:p.id, track:false })).join('');
      const back = cardHTML(null, { back:true, pack:p.id, style:`--back-hi:${p.back[0]};--back:${p.back[1]}` });
      return `<button class="pk" data-act="setPref" data-k="pack" data-v="${p.id}" ${ok ? '' : 'disabled'} aria-pressed="${on}" title="${ok ? p.name : `Reach level ${p.level} to unlock`}">
        <span class="pkcards">${demo}${back}</span>
        <span class="pkname"><b>${p.name}</b>${ok ? '' : `<small>${LOCK_SVG}Level ${p.level}</small>`}</span></button>`;
    }).join('')}</div>
    <h3>Table felt</h3>
    ${swatches('felt', FELTS, 'felt')}
    <h3>Seed</h3>
    <div class="srow"><span>This run</span><code class="seed">${S.seed}</code></div>
    <form class="seedform" data-form="seed"><input id="seedInput" placeholder="ABCD-1234" maxlength="9" autocomplete="off" spellcheck="false" aria-label="Seed to play">
      <button class="btn" type="submit">Play</button></form>
    <p class="snote" id="seedMsg"></p>
    <h3>Help</h3>
    <div class="srow"><span>Introduction</span><button class="btn" data-act="replayTutorial">Replay</button></div>
    <div class="srow kbrow"><span>Keys<small>1–9 swap · D discard/deal · C cash out · N next · T throw away · P power-up · W 10-swap · ↑↓ bet · K tracker · Y history · ? help</small></span></div>
    <div class="actions"><button class="btn gold" data-act="close">Done</button></div>`;
}

/* ---------- unlock announcements ---------- */
// The first time a level is reached (beyond any earlier run), the card packs and felts it unlocks are announced,
// with a button to start using each one. prefs.unlockedUpTo remembers the highest level already announced.
function checkUnlocks(){
  const seen = Math.max(prefs.unlockedUpTo || 0, (prefs.record && prefs.record.level) || 1);
  const L = lvl();
  if (L <= seen) return;
  prefs.unlockedUpTo = L; store(PREF_KEY, prefs);
  const items = PACKS.filter(p => p.level > seen && p.level <= L).map(p => ({ kind:'pack', item:p }))
    .concat(FELTS.filter(f => f.level > seen && f.level <= L).map(f => ({ kind:'felt', item:f })));
  if (!items.length) return;
  ui.unlocks = items; ui.modal = 'unlock';
  sfx('power'); buzz([20, 30, 20]);
  setTimeout(celebrate, dur(250));
  announce('Unlocked: ' + items.map(x => x.item.name + (x.kind === 'pack' ? ' card pack' : ' table felt')).join(', '));
}
function unlockHTML(){
  const list = ui.unlocks || [];
  const tiles = list.map(({ kind, item }) => {
    const k = kind === 'pack' ? 'pack' : 'felt', on = (kind === 'pack' ? currentPack() : (prefs.felt || 'green')) === item.id;
    const look = kind === 'pack'
      ? `<span class="pkcards ul-cards">${[{ rank:13, suit:'S' }, { rank:12, suit:'H' }, { rank:1, suit:'D' }].map((c, i) => cardHTML({ id:'ul-' + item.id + i, ...c }, { pack:item.id, track:false })).join('')}${cardHTML(null, { back:true, pack:item.id, style:`--back-hi:${item.back[0]};--back:${item.back[1]}` })}</span>`
      : `<span class="swv ul-felt" style="--c1:${item.c1};--c2:${item.c2}"></span>`;
    return `<div class="ul-item">${look}<b>${item.name}</b><small>${kind === 'pack' ? 'Card pack' : 'Table felt'}</small>
      <button class="btn ${on ? '' : 'gold'}" data-act="setPref" data-k="${k}" data-v="${item.id}" ${on ? 'disabled' : ''}>${on ? 'In use' : 'Use it'}</button></div>`;
  }).join('');
  return `<div class="ul-head"><svg class="ul-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 7.6-1.7"/></svg>
      <div class="rs-eyebrow">Level ${lvl()} reached</div><h2>Unlocked!</h2></div>
    <div class="ul-list">${tiles}</div>
    <p class="snote" style="text-align:center">You can switch any time in Settings.</p>
    <div class="actions"><button class="btn" data-act="close">Continue</button></div>`;
}
