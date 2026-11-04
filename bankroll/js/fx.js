/* Bankroll · effects: card flights, floating numbers, celebrations, combo links, haptics, announcements */
'use strict';

/* Animation speed comes from Settings (Normal / Fast / Off) and the OS reduced-motion setting. */
const reduceMotion = () => {
  if (prefs.speed === 'off') return true;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){ return false; }
};
const dur = ms => Math.round(ms * (prefs.speed === 'fast' ? 0.5 : 1));

/* ---------- screen reader + haptics ---------- */
function announce(text){
  const el = $('sr'); if (!el || !text) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 40);
}
function buzz(pattern){
  if (!prefs.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
}

/* ---------- numbers ---------- */
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
function countUp(el, to){
  if (reduceMotion() || !to) return;
  const t0 = performance.now(), T = dur(750);
  const step = t => {
    const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
    el.textContent = signed(Math.round(to * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = signed(to);
  };
  requestAnimationFrame(step);
}
// the multiplier in the value bar rolls from its old value to the new one
function rollMult(el, from, to){
  if (!el || reduceMotion() || from === to) return;
  const t0 = performance.now(), T = dur(480);
  el.classList.remove('rolled'); void el.offsetWidth; el.classList.add('rolled');
  const step = t => {
    const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
    el.textContent = '×' + fmt(Math.round(from + (to - from) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = '×' + fmt(to);
  };
  requestAnimationFrame(step);
}

function floatDelta(id, text, cls, shake){
  const el = $(id); if (!el) return;
  el.classList.remove('hit', 'bump'); void el.offsetWidth; el.classList.add(shake);
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + cls; f.setAttribute('aria-hidden', 'true');
  const [num, ...label] = text.split(' ');
  f.innerHTML = `<b>${num}</b>${label.length ? `<small>${label.join(' ')}</small>` : ''}`;
  f.style.left = (r.left + r.width * (label.length ? 0.5 : 0.66)) + 'px'; f.style.top = (r.top + r.height * 0.28) + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1500);
}
let toastTimer = null;
function toast(html){
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function bump(which){ requestAnimationFrame(() => { const el = $('st-' + which); if (el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }); }

/* ---------- card flights ---------- */
const deckRect = () => { const d = document.querySelector('#pit .stack .card:last-child') || document.querySelector('#pit .deckbtn'); return d && d.getBoundingClientRect(); };

// every dealt card flies from the deck to the center, turning face up on the way
function runDealFx(id){
  if (reduceMotion()) return;
  const el = document.querySelector(`#pit .stage [data-cid="${id}"]`), a = deckRect();
  if (!el || !a) return;
  const b = el.getBoundingClientRect();
  el.animate([
    { transform:`translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}) rotateY(90deg)`, filter:'brightness(.6)' },
    { transform:'translate(0,-12px) scale(1.05) rotateY(0deg)', filter:'brightness(1)', offset:.7 },
    { transform:'none' }
  ], { duration:dur(560), easing:'cubic-bezier(.25,.8,.3,1)' });
}

// a card that skips the center (Joker, open seat) flies straight into the hand
function runFly(f){
  const el = document.querySelector(`#hand [data-cid="${f.id}"]`); if (!el) return;
  let sources = [], label;
  if (f.kind === 'joker'){ sources = [...document.querySelectorAll('#hand .card.joker')].filter(j => j !== el); label = '★ Joker seat'; }
  else if (f.kind === 'five'){ sources = [...document.querySelectorAll('#powers .pu[data-type="5"]')]; label = 'Extra seat'; }
  else label = '★ Joker · +1 seat';
  sources.forEach(sv => { sv.classList.remove('jpulse'); void sv.offsetWidth; sv.classList.add('jpulse'); setTimeout(() => sv.classList.remove('jpulse'), 1700); });
  el.classList.add('seated'); setTimeout(() => el.classList.remove('seated'), 1700);
  const a = deckRect();
  if (a && !reduceMotion()){
    const b = el.getBoundingClientRect();
    el.animate([
      { transform:`translate(${a.left - b.left}px, ${a.top - b.top}px) rotate(-12deg) scale(.9)`, opacity:.3 },
      { transform:'translate(0,-18px) rotate(3deg) scale(1.08)', opacity:1, offset:.72 },
      { transform:'none', opacity:1 }
    ], { duration:dur(780), easing:'cubic-bezier(.25,.8,.3,1)' });
  }
  setTimeout(() => {
    const r = el.getBoundingClientRect();
    const t = document.createElement('div');
    t.className = 'float seat'; t.setAttribute('aria-hidden', 'true'); t.textContent = label;
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top - 4) + 'px';
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }, reduceMotion() ? 0 : dur(520));
}

// swapping trades places: the hand card goes to the center and the center card to the hand
function runSwapFx(f){
  if (reduceMotion()) return;
  const inEl = document.querySelector(`#hand [data-cid="${f.inId}"]`), outEl = document.querySelector(`#pit .stage [data-cid="${f.outId}"]`);
  const fly = (el, from) => {
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    el.animate([{ transform:`translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` }, { transform:'none' }],
      { duration:dur(380), easing:'cubic-bezier(.25,.8,.3,1)' });
  };
  fly(inEl, f.fromStage); fly(outEl, f.fromHand);
}

/* ---------- can't pay upkeep ---------- */
function jitter(els){
  els.forEach(el => { if (!el) return; el.classList.remove('jitter'); void el.offsetWidth; el.classList.add('jitter'); setTimeout(() => el.classList.remove('jitter'), 700); });
}
function upkeepShortFx(){
  jitter([...document.querySelectorAll('#powers .pu'), $('st-coins'), $('upkeepNote')]);
  const n = $('upkeepNote'); if (n){ n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }
  buzz([40, 30, 40]); sfx('debt');
  announce(`Not enough coins to deal. Upkeep is ${upkeep()} and you have ${S.coins}. Release a power-up or cash out.`);
}

/* ---------- celebrations ---------- */
// a coin shower with confetti for a ×10 (or bigger) cash-out
function celebrate(){
  if (reduceMotion()) return;
  const c = document.createElement('canvas'); c.className = 'fxcanvas'; c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const hues = ['#f5d98c', '#93e7a8', '#ff8a92', '#6fd3c1', '#fff3c4'];
  const parts = Array.from({ length: Math.min(140, Math.round(W / 6)) }, (_, i) => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.7, vx: (Math.random() - .5) * 1.6, vy: 2 + Math.random() * 3.5,
    r: 5 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, coin: i % 3 !== 0, hue: hues[i % hues.length] }));
  const t0 = performance.now(), T = dur(2400);
  const step = t => {
    const k = (t - t0) / T;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = Math.max(0, 1 - Math.max(0, k - .72) / .28);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += .05; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      if (p.coin){
        g.scale(Math.max(.15, Math.abs(Math.cos(p.rot * 2))), 1);
        const gr = g.createRadialGradient(-p.r * .3, -p.r * .3, 1, 0, 0, p.r);
        gr.addColorStop(0, '#fff6d2'); gr.addColorStop(.5, '#f5d98c'); gr.addColorStop(1, '#a87d28');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, p.r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(107,76,18,.6)'; g.lineWidth = 1; g.stroke();
      } else { g.fillStyle = p.hue; g.fillRect(-p.r * .55, -p.r * .25, p.r * 1.1, p.r * .5); }
      g.restore();
    });
    if (k < 1) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
function shakeApp(){
  if (reduceMotion()) return;
  const a = $('app'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
  setTimeout(() => a.classList.remove('shake'), 700);
}

/* ---------- combo links ---------- */
// Brackets under the hand join the cards of each combo, with the combo's name and multiplier.
// When the hand wraps onto several rows, each row gets its own brackets (and room for them);
// a combo split across rows is drawn on every row it touches, and labelled on its last one.
const LINK_COLORS = { pair:'#f5d98c', straight:'#6fd3c1', flush:'#ff9aa2' };
const LINK_STEP = 17;
function drawComboLinks(){
  const hand = $('hand'); if (!hand) return;
  hand.querySelectorAll('.links').forEach(n => n.remove());
  const visible = S.hand.filter(c => !S.faceDown.includes(c.id));
  const ev = S.phase === 'over' ? { combos:[] } : evaluate(visible, S.powerups);
  const items = ev.combos.map(cb => ({ cb, els: cb.ids.map(id => hand.querySelector(`[data-cid="${id}"]`)).filter(Boolean) }))
    .filter(x => x.els.length > 1 || x.cb.kind !== 'pair');
  hand.style.rowGap = ''; hand.style.paddingBottom = '';
  if (!items.length) return;

  // group the hand's cards into rows by their vertical position
  const rowsOf = () => {
    const tops = [...hand.children].filter(el => el.matches('.card, .emptyslot')).map(el => el.offsetTop);
    const rows = [...new Set(tops)].sort((a, b) => a - b).reduce((acc, t) => (acc.length && t - acc[acc.length - 1] < 8 ? acc : acc.concat(t)), []);
    return el => { const t = el.offsetTop; let r = 0; rows.forEach((rt, i) => { if (t >= rt - 4) r = i; }); return r; };
  };
  let rowOf = rowsOf();
  const nRows = Math.max(...[...hand.children].filter(el => el.matches('.card, .emptyslot')).map(rowOf)) + 1;
  const perRow = Array.from({ length: nRows }, () => []);
  items.forEach((it, k) => new Set(it.els.map(rowOf)).forEach(r => perRow[r].push(k)));
  const room = n => (n ? n * LINK_STEP + 12 : 0);
  // make room under the upper rows, then measure again (the layout moved)
  const upper = Math.max(0, ...perRow.slice(0, -1).map(a => room(a.length)));
  if (upper) hand.style.rowGap = `calc(var(--hg) + ${upper}px)`;
  hand.style.paddingBottom = room(perRow[nRows - 1].length) + 'px';
  rowOf = rowsOf();

  const hr = hand.getBoundingClientRect();
  let paths = '', labels = '';
  perRow.forEach((ks, r) => {
    if (!ks.length) return;
    const rowCards = [...hand.children].filter(el => el.matches('.card, .emptyslot') && rowOf(el) === r);
    const base = Math.max(...rowCards.map(el => el.getBoundingClientRect().bottom)) - hr.top + 6;
    ks.forEach((k, j) => {
      const it = items[k], col = LINK_COLORS[it.cb.kind] || '#f5d98c';
      const here = it.els.filter(el => rowOf(el) === r);
      const xs = here.map(el => { const b = el.getBoundingClientRect(); return b.left - hr.left + b.width / 2; });
      const x1 = Math.min(...xs), x2 = Math.max(...xs), y = base + 6 + j * LINK_STEP;
      const lastRow = Math.max(...it.els.map(rowOf)) === r;
      // a combo that continues on another row gets an open end pointing that way
      const cont = !lastRow ? `<path d="M${x2} ${y}h7" style="stroke:${col};stroke-dasharray:2 3"/>` : '';
      const lead = Math.min(...it.els.map(rowOf)) < r ? `<path d="M${x1 - 7} ${y}h7" style="stroke:${col};stroke-dasharray:2 3"/>` : '';
      paths += `<path d="M${x1} ${y}H${x2}" style="stroke:${col}"/>${cont}${lead}` +
        xs.map(x => `<path d="M${x} ${base - 2}V${y}" style="stroke:${col}"/><circle cx="${x}" cy="${base - 2}" r="2.2" style="fill:${col}"/>`).join('');
      if (lastRow) labels += `<span class="lk" style="left:${(x1 + x2) / 2}px;top:${y}px;--lc:${col}">${it.cb.label} ×${fmt(it.cb.factor)}</span>`;
    });
  });
  const H = hand.scrollHeight;
  const wrap = document.createElement('div');
  wrap.className = 'links'; wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<svg width="${hr.width}" height="${H}" viewBox="0 0 ${hr.width} ${H}">${paths}</svg>${labels}`;
  hand.appendChild(wrap);
}
let linkTimer = null;
function scheduleComboLinks(){
  // draw now, and again once the deal/flip animations have settled
  requestAnimationFrame(drawComboLinks);
  clearTimeout(linkTimer); linkTimer = setTimeout(drawComboLinks, dur(650));
}
window.addEventListener('resize', () => { if (S) scheduleComboLinks(); });
