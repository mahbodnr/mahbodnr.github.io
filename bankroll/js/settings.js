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
    ${toggle('haptics', 'Vibration', 'On phones that support it')}
    <h3>Look</h3>
    <div class="srow"><span>Theme</span>${seg('theme', [['system','System'],['dark','Dark'],['light','Light']], 'Theme')}</div>
    <div class="srow"><span>Animations</span>${seg('speed', [['normal','Normal'],['fast','Fast'],['off','Off']], 'Animations')}</div>
    ${toggle('fourColor', 'Four-colour deck', 'Diamonds blue, clubs green')}
    <h3>Card pack</h3>
    <div class="packs">${PACKS.map(p => {
      const ok = isUnlocked(p), on = currentPack() === p.id;
      const demo = [{ id:'pv-k-' + p.id, rank:13, suit:'S' }, { id:'pv-q-' + p.id, rank:12, suit:'H' }, { id:'pv-a-' + p.id, rank:1, suit:'D' }]
        .map(c => cardHTML(c, { pack:p.id, track:false })).join('');
      const back = cardHTML(null, { back:true, pack:p.id, style:`--back-hi:${p.back[0]};--back:${p.back[1]}` });
      return `<button class="pk" data-act="setPref" data-k="pack" data-v="${p.id}" ${ok ? '' : 'disabled'} aria-pressed="${on}" title="${ok ? p.name : `Reach level ${p.level} to unlock`}">
        <span class="pkcards">${demo}${back}</span>
        <span class="pkname"><b>${p.name}</b><small>${ok ? p.note : `${LOCK_SVG}Level ${p.level}`}</small></span></button>`;
    }).join('')}</div>
    <h3>Table felt</h3>
    ${swatches('felt', FELTS, 'felt')}
    <p class="snote">More designs unlock as your best level goes up. Your best so far: level ${bestLevel()}.</p>
    <h3>Run seed</h3>
    <div class="srow"><span>This run<small>The seed fixes the order of every deck in the run.</small></span><code class="seed">${S.seed}</code></div>
    <form class="seedform" data-form="seed"><input id="seedInput" placeholder="ABCD-1234" maxlength="9" autocomplete="off" spellcheck="false" aria-label="Seed to play">
      <button class="btn" type="submit">Start a new run with this seed</button></form>
    <p class="snote" id="seedMsg">Starting a seeded run ends the current one. Share a seed so friends can play the same cards.</p>
    <h3>Help</h3>
    <div class="srow"><span>Tutorial<small>Walk through a hand step by step</small></span><button class="btn" data-act="replayTutorial">Replay</button></div>
    <div class="srow kbrow"><span>Keyboard shortcuts<small>1–9 swap a card · D discard / deal · C cash out · N next card · T throw away · P power-up · W 10-swap · ↑↓ bet · K card tracker (or tap the deck) · Y history · ? help · , settings</small></span></div>
    <div class="actions"><button class="btn gold" data-act="close">Done</button></div>`;
}
