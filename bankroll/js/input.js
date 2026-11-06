/* Bankroll · input: clicks, drag-to-swap, bet controls, keyboard */
'use strict';

/* ================= input ================= */
function onHandPick(id){
  // swapping with the center card (or placing a 10-swap card) is a single tap; only paid discards ask twice
  if (S.phase === 'decide'){ act('swap', id); render(); return; }
  if (S.phase === 'swapPlace'){ act('place', id); render(); return; }
  if (ui.armed !== id){ ui.armed = id; render(); return; }
  if (S.phase === 'trim') act('trim', id);
  render();
}

/* Throw away: first turn the two face-down cards over so the player sees what they're giving up, then toss the
   whole hand. Only the display waits; the move itself is the same single 'throw'. */
function throwWithReveal(){
  if (ui.throwing || S.phase !== 'bet') return;
  if (!S.faceDown.length){ act('throw'); render(); return; }
  ui.throwing = true;
  S.faceDown.forEach(id => ui.flips.add(id));
  render();
  const show = reduceMotion() ? 900 : dur(1150);
  setTimeout(() => { if (ui.throwing) document.querySelectorAll('#hand .card').forEach(el => el.classList.add('toss')); }, Math.max(0, show - dur(320)));
  setTimeout(() => { ui.throwing = false; act('throw'); render(); }, show);
}

/* Drag a hand card: onto the table to swap it with the center card (when a swap is possible), or along the hand to
   put it somewhere else (the hand then keeps the player's own order until the next hand or a sort button). */
const drag = { id:null, x0:0, y0:0, on:false, ghost:null, src:null, swap:false };
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#hand .card.mv'); if (!el || e.button > 0 || !introAllows(el) || ui.throwing) return;
  drag.id = el.dataset.cid || el.dataset.fd; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.on = false; drag.src = el;
  drag.swap = el.classList.contains('drag');
});
const handCards = () => [...document.querySelectorAll('#hand > .card')];
// where the dragged card would go: the index among the other cards, by the pointer's x
function dropIndex(e){
  const others = handCards().filter(c => c !== drag.src);
  let i = 0; others.forEach((c, k) => { const r = c.getBoundingClientRect(); if (e.clientX > r.left + r.width / 2) i = k + 1; });
  return { i, others };
}
function overHand(e){ const h = $('hand'); if (!h) return false; const r = h.getBoundingClientRect(); return e.clientY > r.top - 30 && e.clientY < r.bottom + 30 && e.clientX > r.left - 30 && e.clientX < r.right + 30; }
function clearDropMarks(){ document.querySelectorAll('#hand .drop-before, #hand .drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after')); }
document.addEventListener('pointermove', e => {
  if (!drag.id) return;
  if (!drag.on){
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
    drag.on = true;
    const r = drag.src.getBoundingClientRect();
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
    drag.ghost = drag.src.cloneNode(true); drag.ghost.classList.add('ghost'); drag.ghost.classList.remove('armed', 'enter', 'flip', 'coach-on', 'intro-ok');
    drag.ghost.querySelectorAll('.tag, .kc').forEach(t => t.remove());
    drag.ghost.style.width = r.width / ZK + 'px'; drag.ghost.style.height = r.height / ZK + 'px';   // zoomed like the game
    drag.ghost.style.setProperty('--cw', r.width / ZK + 'px'); drag.ghost.style.setProperty('--ch', r.height / ZK + 'px');
    document.body.appendChild(drag.ghost); drag.src.classList.add('dragging');
  }
  drag.ghost.style.left = (e.clientX - drag.dx) / ZK + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) / ZK + 'px';
  const toPit = drag.swap && overPit(e) && !overHand(e);
  const st = document.querySelector('#pit .stage');
  if (st) st.classList.toggle('droppable', toPit);
  clearDropMarks();
  if (!toPit && overHand(e) && !introOn()){
    const { i, others } = dropIndex(e);
    if (others[i]) others[i].classList.add('drop-before'); else if (others.length) others[others.length - 1].classList.add('drop-after');
  }
});
function overPit(e){ const p = $('pit').getBoundingClientRect(); return e.clientY < p.bottom + 10 && e.clientY > p.top - 40; }
function endDrag(e, cancel){
  if (!drag.id) return;
  const id = drag.id, was = drag.on; drag.id = null;
  if (!was) return;
  ui.dragEnded = Date.now();
  if (drag.ghost) drag.ghost.remove(); drag.ghost = null;
  if (drag.src) drag.src.classList.remove('dragging');
  clearDropMarks();
  const st = document.querySelector('#pit .stage'); if (st) st.classList.remove('droppable');
  if (cancel) return;
  if (drag.swap && overPit(e) && !overHand(e)){
    if (S.phase === 'decide') act('swap', id);
    else if (S.phase === 'swapPlace') act('place', id);
    render();
  } else if (overHand(e) && !introOn()){
    const order = sortedHand().map(c => c.id).filter(x => x !== id);
    order.splice(dropIndex(e).i, 0, id);
    S.order = order;
    render();
  }
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));

/* Bet slider: any value, with a pull toward round numbers. The track is linear: halfway is half your coins.
   Round numbers depend on the bet's own size: under 100 → 5s and 10s; 100–999 → 10s and 50s; 1,000+ → 100s and 500s. */
const RN = 1000;
function betToPos(v){
  const max = S.coins; if (max <= 1) return 0;
  const t = Math.max(0, Math.min(1, (v - 1) / (max - 1)));
  return Math.round(t * RN);
}
function posToBet(p){
  const max = S.coins; if (max <= 1) return 1;
  const t = p / RN;
  return 1 + t * (max - 1);
}
function roundUnits(v){
  const d = Math.floor(Math.log10(Math.max(v, 1)));
  if (d <= 0) return { strong:10, weak:5 };
  if (d === 1) return { strong:10, weak:5 };
  return { strong:5 * Math.pow(10, d - 1), weak:Math.pow(10, d - 1) };
}
function snapFromPos(p, widthPx){
  const max = S.coins, v0 = posToBet(p);
  const posPerPx = RN / Math.max(120, widthPx || 240);
  const px = c => Math.abs(betToPos(c) - p) / posPerPx;
  // a round number's pull is a share of the gap to its neighbour, so in-between values stay reachable
  const gapPx = (c, u) => Math.abs(betToPos(Math.min(max, c + u)) - betToPos(Math.max(1, c - u))) / 2 / posPerPx;
  const { strong, weak } = roundUnits(v0);
  const cs = Math.round(v0 / strong) * strong, cw = Math.round(v0 / weak) * weak;
  const cand = [
    [max, Math.min(7, gapPx(max, weak) * 0.5)],
    [1,   Math.min(7, gapPx(1, weak) * 0.3)],
    [cs,  Math.min(8, gapPx(cs, strong) * 0.22)],
    [cw,  Math.min(4, gapPx(cw, weak) * 0.14)],
  ];
  let best = null;
  cand.forEach(([c, zone]) => { if (c >= 1 && c <= max && px(c) <= zone && (!best || px(c) / zone < px(best[0]) / best[1])) best = [c, zone]; });
  return best ? best[0] : Math.max(1, Math.min(max, Math.round(v0)));
}
function clampBet(v){ return Math.max(1, Math.min(Math.round(+v || 1), S.coins)); }
function setBet(v){ S.betInput = clampBet(v); render(); }
// update the bet controls in place (no full re-render while dragging or holding)
function updateBetUI(skip){
  const b = S.betInput;
  const num = $('betNum'), rg = $('betRange');
  if (num && skip !== 'num') num.value = b;
  if (num) num.style.width = Math.max(5, String(b).length + 1) + 'ch';
  document.querySelectorAll('.presets .q').forEach(q => q.setAttribute('aria-pressed', String(+q.dataset.v === b)));
  if (rg && skip !== 'range') rg.value = betToPos(b);
  const dn = document.querySelector('[data-hold="-1"]'), up = document.querySelector('[data-hold="1"]');
  if (dn) dn.disabled = b <= 1; if (up) up.disabled = b >= S.coins;
  renderValue(); renderLedger();
  if (introOn()) tutorialTick();   // the introduction waits for a set bet
}
function stepBet(dir, big){
  let v = S.betInput;
  if (big){ const u = roundUnits(v).weak; v = dir > 0 ? Math.floor(v / u) * u + u : Math.ceil(v / u) * u - u; }
  else v += dir;
  S.betInput = clampBet(v); updateBetUI();
}
const hold = { t:null, n:0 };
function stopHold(){ clearTimeout(hold.t); hold.t = null; }
document.addEventListener('pointerdown', e => {
  const btn = e.target.closest('[data-hold]'); if (!btn || btn.disabled || !introAllows(btn)) return;
  e.preventDefault();
  const dir = +btn.dataset.hold; hold.n = 0; stopHold();
  stepBet(dir);
  const tick = () => { hold.n++; stepBet(dir, hold.n > 14); hold.t = setTimeout(tick, hold.n > 14 ? 110 : 70); };
  hold.t = setTimeout(tick, 380);
});
['pointerup','pointercancel','pointerleave'].forEach(ev => document.addEventListener(ev, e => { if (hold.t && (ev !== 'pointerleave' || e.target === document.documentElement)) stopHold(); }));
document.addEventListener('pointerup', () => stopHold());

document.addEventListener('click', e => {
  if (ui.dragEnded && Date.now() - ui.dragEnded < 400) return;
  const t = e.target.closest('[data-act]');
  if (!t){ if (ui.armed){ ui.armed = null; render(); } return; }
  if (!introAllows(t)) return;                     // the introduction: only the control it asks for works
  const action = t.dataset.act;
  if (action === 'scrimClose'){ if (e.target === t){ closeModal(); render(); } return; }
  const id = t.dataset.id;
  switch (action){
    case 'help': ui.modal = 'help'; break;
    case 'close': closeModal(); break;
    case 'recordBoard': ui.modalBack = null; ui.histTab = 'board'; ui.modal = 'history'; LB.period = 'today'; if (LB.backend && LB.backend.refresh) LB.backend.refresh(); break;
    case 'restart':
      if (S.phase === 'over' || (S.phase === 'bet' && S.stats.sets === 0)) { beginRun(); break; }
      ui.modal = 'restart'; break;
    case 'restartNow': beginRun(); break;
    case 'history': ui.modal = 'history'; break;
    case 'settings': ui.modal = 'settings'; break;
    case 'histTab': ui.histTab = t.dataset.v; if (t.dataset.v === 'board' && LB.backend && LB.backend.refresh) LB.backend.refresh(); break;
    case 'openBoard': ui.histTab = 'board'; ui.modal = 'history'; if (LB.backend && LB.backend.refresh) LB.backend.refresh(); break;
    case 'lbPeriod': LB.period = t.dataset.v; break;
    case 'lbSeeded': LB.seeded = !LB.seeded; if (LB.backend && LB.backend.refresh) LB.backend.refresh(); break;
    case 'lbSignIn': if (LB.backend && LB.backend.signIn) LB.backend.signIn(); return;
    case 'setPref': setPref(t.dataset.k, t.dataset.v); break;
    case 'preset': setBet(+t.dataset.v); return;
    case 'bustConfirm': act('cash', 1); break;
    case 'introNext': introNext(); if (!intro) return; break;
    case 'introSkip': if (intro && intro.replay) endIntro(); return;
    case 'tipDone': tipDone(t.dataset.v); break;
    case 'replayTutorial': ui.modal = null; startIntro(true); break;
    case 'replaySeed': beginRun(S.seed); break;
    case 'sortRank': prefs.sort = 'rank'; S.order = null; store(PREF_KEY, prefs); break;
    case 'sortSuit': prefs.sort = 'suit'; S.order = null; store(PREF_KEY, prefs); break;
    case 'betKey': if (e.detail === 0) stepBet(+t.dataset.hold); return; // keyboard; pointer presses are handled on pointerdown
    case 'throw': throwWithReveal(); return;
    case 'deal': act('deal', S.betInput); break;
    case 'discard': act('discard'); break;
    case 'power': act('power'); break;
    case 'swap': act('swap10'); break;
    case 'cancelSwap': act('cancel10'); break;
    case 'openPick': ui.modal = 'pick'; break;
    case 'pickDiscard': act('pick', id); break;
    case 'viewOut': ui.modal = 'tracker'; break;
    case 'viewDiscard': if (S.phase === 'swapPick') ui.modal = 'pick'; else ui.modal = 'view'; break;
    case 'handPick': onHandPick(id); return;
    case 'bestSwap': act('swap', id); break;
    case 'release': {
      const i = S.powerups.map(x => x.type).lastIndexOf(t.dataset.type); if (i < 0) break;
      // giving up a seat with a full hand means a card has to go: say so first
      if (t.dataset.type === '5' && S.hand.length > capacity() - 1){ ui.releaseIdx = i; ui.modal = 'release5'; break; }
      act('release', i); break;
    }
    case 'releaseConfirm': ui.modal = null; if (Number.isInteger(ui.releaseIdx)) act('release', ui.releaseIdx); ui.releaseIdx = null; break;
    case 'next':
      if (S.deck.length && S.coins < upkeep()){ ui.upkeepFx = true; break; }   // can't pay upkeep: explain instead of dealing
      act('next'); break;
    case 'cash': act('cash'); break;
    case 'nextSet': act('nextSet'); break;
    case 'openReshuffle': ui.modal = 'reshuffle'; break;
    case 'reshuffle': act('level'); break;
    default: return;
  }
  render();
});

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-act]')){ e.preventDefault(); e.target.click(); return; }
  if (e.key === 'Escape' && CLOSABLE.includes(ui.modal) && !introOn()){ closeModal(); render(); return; }
  // keep keyboard focus inside an open dialog
  if (e.key === 'Tab' && ui.modal){
    const f = [...document.querySelectorAll('#modalRoot .modal button:not([disabled]), #modalRoot .modal input:not([disabled]), #modalRoot .modal [tabindex="0"]')];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!document.querySelector('#modalRoot .modal').contains(document.activeElement)){ e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});

/* keyboard shortcuts (desktop) */
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !S || introOn()) return;   // no shortcuts in the introduction
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if ((k === 'Enter' || k === ' ') && e.target.closest && e.target.closest('button, [role="button"], a')) return; // let the focused control handle it
  const press = sel => { const b = document.querySelector(sel); if (b && !b.disabled){ e.preventDefault(); b.click(); return true; } return false; };
  if (ui.modal){
    if (k === 'Enter' && ui.modal === 'result') press('#modalRoot [data-act="nextSet"]');
    return;
  }
  if (/^[1-9]$/.test(k) && ['decide', 'swapPlace', 'trim'].includes(S.phase)){
    const cards = [...document.querySelectorAll('#hand .card[data-act="handPick"]')];
    if (cards[+k - 1]){ e.preventDefault(); cards[+k - 1].click(); }
    return;
  }
  switch (k){
    case 'd': press(S.phase === 'bet' ? '[data-act="deal"]' : '[data-act="discard"]'); break;
    case 'Enter': press(S.phase === 'bet' ? '[data-act="deal"]' : '[data-act="nextSet"]'); break;
    case 'c': press('[data-act="cash"]'); break;
    case 'n': press('[data-act="next"]'); break;
    case 't': press('[data-act="throw"]'); break;
    case 'p': press('[data-act="power"]'); break;
    case 'w': press('[data-act="swap"]'); break;
    case 'k': press('.deckbtn'); break;
    case 'y': press('[data-act="history"]'); break;
    case ',': press('[data-act="settings"]'); break;
    case '?': case 'h': press('[data-act="help"]'); break;
    case 'ArrowUp': case 'ArrowDown':
      if (S.phase === 'bet'){ e.preventDefault(); stepBet(k === 'ArrowUp' ? 1 : -1, e.shiftKey); }
      break;
  }
});

document.addEventListener('input', e => {
  if ((e.target.id === 'betRange' || e.target.id === 'betNum') && !introAllows(e.target)){ render(); return; }
  if (e.target.id === 'betRange'){
    const v = snapFromPos(+e.target.value, e.target.offsetWidth);
    S.betInput = v; e.target.value = betToPos(v); updateBetUI('range');
  } else if (e.target.id === 'volRange'){
    prefs.volume = +e.target.value / 100; store(PREF_KEY, prefs);
  } else if (e.target.id === 'betNum'){
    const v = Math.round(+e.target.value);
    if (v >= 1 && v <= S.coins){ S.betInput = v; updateBetUI('num'); }
  }
});
// in place, not a full render: leaving the bet box by tapping Deal must not swap the Deal button mid-tap
document.addEventListener('change', e => {
  if (e.target.id === 'betRange') updateBetUI();
  if (e.target.id === 'volRange') sfx('coin');
  if (e.target.id === 'betNum'){ S.betInput = clampBet(e.target.value); updateBetUI(); }
});
document.addEventListener('keydown', e => { if (e.target.id === 'betNum' && e.key === 'Enter') e.target.blur(); });

// Settings: start a run from a typed seed
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-form="seed"]')) return;
  e.preventDefault();
  const seed = cleanSeed($('seedInput').value);
  if (!seed){ const m = $('seedMsg'); if (m){ m.textContent = '4–8 letters or digits'; m.classList.add('err'); } return; }
  beginRun(seed);
});
