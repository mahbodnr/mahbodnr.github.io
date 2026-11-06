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
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmtFit(Math.abs(n));
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
  const box = el.parentElement || el;
  box.classList.remove('rolled'); void box.offsetWidth; box.classList.add('rolled');
  const step = t => {
    const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmtFit(Math.round(from + (to - from) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = fmtFit(to);
  };
  requestAnimationFrame(step);
}

// a number that counts from its old value to its new one (the coins in the ledger)
function rollNumber(el, from, to){
  if (!el || reduceMotion() || from === to) return;
  const t0 = performance.now(), T = dur(Math.min(900, 380 + Math.abs(to - from) * 2));
  const step = t => {
    const k = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - k, 3);
    if (!el.isConnected) return;
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  el.textContent = fmt(from); requestAnimationFrame(step);
}

/* Big screens: the desktop layout is made for about 1300×840. On a larger window the whole game (and its dialogs,
   toasts and floating numbers) is zoomed up evenly to fill it. Positions read from the screen (getBoundingClientRect)
   are in screen pixels, so code that turns them into lengths inside the zoomed game divides by ZK. */
const FIT_W = 1300, FIT_H = 840;
let ZK = 1;
function fitScreen(){
  const w = innerWidth, h = innerHeight;
  const z = w >= 1080 && h > 560 ? Math.max(1, Math.min(w / FIT_W, h / FIT_H, 3)) : 1;
  ZK = Math.floor(z * 100) / 100;
  const r = document.documentElement;
  r.classList.toggle('zoomed', ZK > 1);
  r.style.setProperty('--z', String(ZK));
}
fitScreen();
window.addEventListener('resize', fitScreen);

function floatDelta(id, text, cls, shake){
  const el = $(id); if (!el) return;
  el.classList.remove('hit', 'bump'); void el.offsetWidth; el.classList.add(shake);
  if (reduceMotion()) return;          // without motion the number just changes; a frozen float would cover it
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'float ' + cls; f.setAttribute('aria-hidden', 'true');
  const [num, ...label] = text.split(' ');
  f.innerHTML = `<b>${num}</b>${label.length ? `<small>${label.join(' ')}</small>` : ''}`;
  f.style.left = (r.left + r.width * (label.length ? 0.5 : 0.66)) / ZK + 'px'; f.style.top = (r.top + r.height * 0.28) / ZK + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 1500);
}
let toastTimer = null;
function toast(html){
  const t = $('toast'); t.innerHTML = html; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- card flights ---------- */
const deckRect = () => { const d = document.querySelector('#pit .stack .card:last-child') || document.querySelector('#pit .deckbtn'); return d && d.getBoundingClientRect(); };

// every dealt card flies from the deck to the center, turning face up on the way
function runDealFx(id, delay = 0){
  if (reduceMotion()) return;
  const el = document.querySelector(`#pit .stage [data-cid="${id}"]`), a = deckRect();
  if (!el || !a) return;
  const b = el.getBoundingClientRect();
  el.animate([
    { transform:`translate(${(a.left - b.left) / ZK}px, ${(a.top - b.top) / ZK}px) scale(${a.width / b.width}) rotateY(90deg)`, filter:'brightness(.6)' },
    { transform:'translate(0,-12px) scale(1.05) rotateY(0deg)', filter:'brightness(1)', offset:.7 },
    { transform:'none' }
  ], { duration:dur(560), easing:'cubic-bezier(.25,.8,.3,1)', delay, fill:'backwards' });
}

// a card that skips the center (Joker, open seat) flies straight into the hand
function runFly(f, delay = 0){
  const el = document.querySelector(`#hand [data-cid="${f.id}"]`); if (!el) return;
  let sources = [], label;
  if (f.kind === 'joker'){ sources = [...document.querySelectorAll('#hand .card.joker')].filter(j => j !== el); label = '★ Joker seat'; }
  else if (f.kind === 'five'){ sources = [...document.querySelectorAll('#powers .pu[data-type="5"]')]; label = 'Extra seat'; }
  else label = '★ Joker · +1 seat';
  setTimeout(() => {
    sources.forEach(sv => { sv.classList.remove('jpulse'); void sv.offsetWidth; sv.classList.add('jpulse'); setTimeout(() => sv.classList.remove('jpulse'), 1700); });
    el.classList.add('seated'); setTimeout(() => el.classList.remove('seated'), 1700);
  }, delay);
  const a = deckRect();
  if (a && !reduceMotion()){
    const b = el.getBoundingClientRect();
    el.animate([
      { transform:`translate(${(a.left - b.left) / ZK}px, ${(a.top - b.top) / ZK}px) rotate(-12deg) scale(.9)`, opacity:delay ? 0 : .3 },
      { transform:'translate(0,-18px) rotate(3deg) scale(1.08)', opacity:1, offset:.72 },
      { transform:'none', opacity:1 }
    ], { duration:dur(780), easing:'cubic-bezier(.25,.8,.3,1)', delay, fill:'backwards' });
  }
  if (reduceMotion()) return;
  setTimeout(() => {
    const r = el.getBoundingClientRect();
    const t = document.createElement('div');
    t.className = 'float seat'; t.setAttribute('aria-hidden', 'true'); t.textContent = label;
    t.style.left = (r.left + r.width / 2) / ZK + 'px'; t.style.top = (r.top - 4) / ZK + 'px';
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  }, reduceMotion() ? 0 : delay + dur(520));
}

// A card bought as a power-up rises, glows and flies into its new chip, which then flashes and says what it does.
const PU_SAY = { A:'Ace boost · +1 multipliers', '2':'Two-tone · red/black suits', '5':'Extra seat · +1 seat' };
function runPowerFx(from, type){
  const chip = document.querySelector(`#powers .pu[data-type="${type}"]`); if (!chip) return;
  const flash = () => {
    chip.classList.remove('pu-got'); void chip.offsetWidth; chip.classList.add('pu-got'); setTimeout(() => chip.classList.remove('pu-got'), 1400);
    const r = chip.getBoundingClientRect(), t = document.createElement('div');
    t.className = 'float seat pu-say'; t.setAttribute('aria-hidden', 'true'); t.textContent = PU_SAY[type] || '';
    t.style.left = (r.left + r.width / 2) / ZK + 'px'; t.style.top = (r.top - 2) / ZK + 'px';
    document.body.appendChild(t); setTimeout(() => t.remove(), 1500);
  };
  if (reduceMotion()) return flash();
  chip.classList.remove('pop');
  const r = from.rect, W = r.width / ZK, H = r.height / ZK;
  const g = document.createElement('div'); g.className = 'pfly'; g.setAttribute('aria-hidden', 'true'); g.innerHTML = from.html;
  const card = g.firstElementChild;
  card.classList.remove('enter', 'flip', 'coach-on', 'intro-ok', 'intro-hl');
  g.style.cssText = `left:${r.left / ZK}px;top:${r.top / ZK}px;width:${W}px;height:${H}px;--cw:${W}px;--ch:${H}px`;
  document.body.appendChild(g);
  const em = (chip.querySelector('.pu-cards .card:last-of-type') || chip).getBoundingClientRect();
  const dx = (em.left + em.width / 2 - (r.left + r.width / 2)) / ZK, dy = (em.top + em.height / 2 - (r.top + r.height / 2)) / ZK;
  const T = dur(700);
  g.animate([
    { transform:'none', filter:'brightness(1)' },
    { transform:'translateY(-16px) scale(1.08) rotate(-4deg)', filter:'brightness(1.35) drop-shadow(0 0 16px rgba(245,217,140,.95))', offset:.28 },
    { transform:`translate(${dx}px, ${dy}px) scale(${Math.max(.12, em.height / r.height)})`, filter:'brightness(1.6) drop-shadow(0 0 14px rgba(245,217,140,1))', opacity:.6 }
  ], { duration:T, easing:'cubic-bezier(.5,0,.25,1)', fill:'forwards' }).onfinish = () => g.remove();
  chip.animate([{ opacity:0, transform:'scale(.4)' }, { opacity:0, transform:'scale(.4)', offset:.82 }, { opacity:1, transform:'scale(1.18)', offset:.93 }, { opacity:1, transform:'none' }],
    { duration:T + dur(260), easing:'ease-out' });
  setTimeout(flash, T);
}

// swapping trades places: the hand card goes to the center and the center card to the hand
function runSwapFx(f){
  if (reduceMotion()) return;
  const inEl = document.querySelector(`#hand [data-cid="${f.inId}"]`), outEl = document.querySelector(`#pit .stage [data-cid="${f.outId}"]`);
  const fly = (el, from) => {
    if (!el || !from) return;
    const to = el.getBoundingClientRect();
    el.animate([{ transform:`translate(${(from.left - to.left) / ZK}px, ${(from.top - to.top) / ZK}px) scale(${from.width / to.width})` }, { transform:'none' }],
      { duration:dur(380), easing:'cubic-bezier(.25,.8,.3,1)' });
  };
  fly(inEl, f.fromStage); fly(outEl, f.fromHand);
}

// a discarded card flies from where it was (the center or the hand) onto the pile
function runDiscardFx(el, from){
  if (reduceMotion() || !from) return;
  const to = el.getBoundingClientRect(), end = getComputedStyle(el).transform;
  const settled = end === 'none' ? 'none' : end;
  el.animate([
    { transform:`translate(${(from.left - to.left) / ZK}px, ${(from.top - to.top) / ZK}px) scale(${from.width / to.width})`, offset:0 },
    { transform:`translate(${(from.left - to.left) * .35 / ZK}px, ${(from.top - to.top) * .35 / ZK - 14}px) rotate(-8deg) scale(${(from.width / to.width + 1) / 2})`, offset:.5 },
    { transform: settled }
  ], { duration:dur(460), easing:'cubic-bezier(.3,.7,.3,1)' });
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
    const base = (Math.max(...rowCards.map(el => el.getBoundingClientRect().bottom)) - hr.top) / ZK + 6;
    ks.forEach((k, j) => {
      const it = items[k], col = LINK_COLORS[it.cb.kind] || '#f5d98c';
      const here = it.els.filter(el => rowOf(el) === r);
      const xs = here.map(el => { const b = el.getBoundingClientRect(); return (b.left - hr.left + b.width / 2) / ZK; });
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
  const HW = hr.width / ZK;
  wrap.innerHTML = `<svg width="${HW}" height="${H}" viewBox="0 0 ${HW} ${H}">${paths}</svg>${labels}`;
  hand.appendChild(wrap);
}
let linkTimer = null;
function scheduleComboLinks(){
  // draw now, and again once the deal/flip animations have settled
  requestAnimationFrame(drawComboLinks);
  clearTimeout(linkTimer); linkTimer = setTimeout(drawComboLinks, dur(650));
}
window.addEventListener('resize', () => { if (S) scheduleComboLinks(); });

/* ---------- fire behind a big multiplier ----------
   A small particle fire drawn on a canvas behind the number (render.js puts the canvas in .ro-mult for ×10 and up;
   .blaze from ×100). Particles rise from the base of the digits, cooling from white-yellow through orange to deep
   red, with a little turbulence; the blaze is taller and denser and throws sparks. The particles live here, so the
   fire carries on smoothly when the readout is redrawn. It stops as soon as there is no fire to draw. */
const fire = { parts:[], sparks:[], running:false, sprites:null, last:0 };
function fireSprites(){
  // pre-drawn soft discs along the colour ramp: drawing these is much cheaper than a gradient per particle
  const ramp = [[255,250,225],[255,236,150],[255,205,90],[255,165,50],[255,120,30],[240,80,20],[200,45,15],[140,25,10]];
  return ramp.map(([r, g, b]) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.35, `rgba(${r},${g},${b},.55)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  });
}
function startFire(){
  if (fire.running || reduceMotion()) return;
  if (!document.querySelector('.ro-mult .firecv')) return;
  fire.running = true; fire.last = performance.now();
  requestAnimationFrame(fireFrame);
}
function fireFrame(now){
  const cv = document.querySelector('.ro-mult .firecv');
  if (!cv || reduceMotion()){ fire.running = false; fire.parts = []; fire.sparks = []; return; }
  if (document.hidden){ fire.last = now; requestAnimationFrame(fireFrame); return; }
  const dt = Math.min(50, now - fire.last) / 16.7; fire.last = now;
  const big = cv.parentElement.classList.contains('blaze');
  const dpr = Math.min(3, (window.devicePixelRatio || 1) * ZK), W = cv.clientWidth, H = cv.clientHeight;   // sharp when zoomed
  if (!W || !H){ requestAnimationFrame(fireFrame); return; }
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!fire.sprites) fire.sprites = fireSprites();
  // the canvas is centred on the number; flames start at the digits' baseline and are sized from the font
  const el = cv.parentElement, tw = el.clientWidth, th = el.clientHeight;
  const scale = (parseFloat(getComputedStyle(el).fontSize) || 30) / 30;
  const x0 = (W - tw) / 2 + tw * .06, x1 = (W + tw) / 2 - tw * .04, base = H + parseFloat(getComputedStyle(cv).bottom || 0) - th * .12;
  const rate = (big ? 5.5 : 2.6) * dt;
  for (let i = 0; i < rate + (Math.random() < rate % 1 ? 1 : 0); i++) {
    const x = x0 + Math.random() * (x1 - x0), edge = 1 - Math.abs((x - W / 2) / ((x1 - x0) / 2));   // taller in the middle
    fire.parts.push({ x, y: base - Math.random() * 4 * scale, vx: (Math.random() - .5) * .35 * scale, vy: -(0.8 + Math.random() * .8 + edge * 1.1) * scale * (big ? 1.35 : 1),
      r: (big ? 13 : 10) * scale * (0.6 + Math.random() * .6) * (0.7 + edge * .5), life: 0, max: (big ? 34 : 28) + Math.random() * 22, seed: Math.random() * 6.28 });
  }
  if (big && Math.random() < .3 * dt) fire.sparks.push({ x: x0 + Math.random() * (x1 - x0), y: base - 10 * scale, vx: (Math.random() - .5) * 1.2 * scale, vy: -(2 + Math.random() * 2) * scale, life: 0, max: 40 + Math.random() * 30 });
  const t = now / 1000;
  g.globalCompositeOperation = 'lighter';
  fire.parts = fire.parts.filter(p => {
    p.life += dt; const k = p.life / p.max; if (k >= 1) return false;
    p.vx += Math.sin(t * 3 + p.seed + p.y * .05) * .045 * dt;            // turbulence
    p.vx += ((W / 2) - p.x) * .0009 * dt;                                // flames lean in toward the middle
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= Math.pow(.99, dt);
    const r = p.r * (1 - k * .75), si = Math.min(7, Math.floor(k * 8));
    g.globalAlpha = Math.min(1, (1 - k) * 1.6) * (k < .1 ? k / .1 : 1) * .5;
    g.drawImage(fire.sprites[si], p.x - r, p.y - r, r * 2, r * 2);
    return true;
  });
  fire.sparks = fire.sparks.filter(s => {
    s.life += dt; const k = s.life / s.max; if (k >= 1) return false;
    s.vx += Math.sin(t * 7 + s.max) * .06 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    g.globalAlpha = (1 - k) * .95; g.drawImage(fire.sprites[1], s.x - 2.2, s.y - 2.2, 4.4, 4.4);
    return true;
  });
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (fire.parts.length > 500) fire.parts.splice(0, fire.parts.length - 500);
  requestAnimationFrame(fireFrame);
}
