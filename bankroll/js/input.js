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

/* drag a hand card onto the table to swap it with the center card */
const drag = { id:null, x0:0, y0:0, on:false, ghost:null, src:null };
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('#hand .card.drag'); if (!el || e.button > 0) return;
  drag.id = el.dataset.cid; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.on = false; drag.src = el;
});
document.addEventListener('pointermove', e => {
  if (!drag.id) return;
  if (!drag.on){
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 10) return;
    drag.on = true;
    const r = drag.src.getBoundingClientRect();
    drag.dx = drag.x0 - r.left; drag.dy = drag.y0 - r.top;
    drag.ghost = drag.src.cloneNode(true); drag.ghost.classList.add('ghost'); drag.ghost.classList.remove('armed', 'enter', 'flip');
    drag.ghost.querySelectorAll('.tag').forEach(t => t.remove());
    drag.ghost.style.width = r.width + 'px'; drag.ghost.style.height = r.height + 'px';
    document.body.appendChild(drag.ghost); drag.src.classList.add('dragging');
  }
  drag.ghost.style.left = (e.clientX - drag.dx) + 'px'; drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
  const st = document.querySelector('#pit .stage');
  if (st) st.classList.toggle('droppable', overPit(e));
});
function overPit(e){ const p = $('pit').getBoundingClientRect(); return e.clientY < p.bottom + 10 && e.clientY > p.top - 40; }
function endDrag(e, cancel){
  if (!drag.id) return;
  const id = drag.id, was = drag.on; drag.id = null;
  if (!was) return;
  ui.dragEnded = Date.now();
  if (drag.ghost) drag.ghost.remove(); drag.ghost = null;
  if (drag.src) drag.src.classList.remove('dragging');
  const st = document.querySelector('#pit .stage'); if (st) st.classList.remove('droppable');
  if (!cancel && overPit(e)){
    if (S.phase === 'decide') act('swap', id);
    else if (S.phase === 'swapPlace') act('place', id);
    render();
  }
}
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));

/* Bet slider: any value, with a pull toward round numbers.
   Above 50 coins the track is curved (value ∝ position²) so low bets keep fine control.
   Round numbers depend on the bet's own size: under 100 → 5s and 10s; 100–999 → 10s and 50s; 1,000+ → 100s and 500s. */
const RN = 1000;
const curved = () => S.coins > 50;
function betToPos(v){
  const max = S.coins; if (max <= 1) return 0;
  const t = Math.max(0, Math.min(1, (v - 1) / (max - 1)));
  return Math.round((curved() ? Math.sqrt(t) : t) * RN);
}
function posToBet(p){
  const max = S.coins; if (max <= 1) return 1;
  const t = p / RN;
  return 1 + (curved() ? t * t : t) * (max - 1);
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
  const num = $('betNum'), rg = $('betRange'), deal = $('dealBtn');
  if (num && skip !== 'num') num.value = b;
  if (rg && skip !== 'range') rg.value = betToPos(b);
  if (deal) deal.textContent = 'Deal · bet ' + fmt(b);
  const dn = document.querySelector('[data-hold="-1"]'), up = document.querySelector('[data-hold="1"]');
  if (dn) dn.disabled = b <= 1; if (up) up.disabled = b >= S.coins;
  renderValue();
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
  const btn = e.target.closest('[data-hold]'); if (!btn || btn.disabled) return;
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
  const action = t.dataset.act;
  if (action === 'scrimClose'){ if (e.target === t){ ui.modal = null; render(); } return; }
  const id = t.dataset.id;
  switch (action){
    case 'help': ui.modal = 'help'; break;
    case 'close': ui.modal = null; break;
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
    case 'tutorialNext': nextTutorial(); break;
    case 'tutorialSkip': endTutorial(); break;
    case 'replayTutorial': startTutorial(); ui.modal = null; break;
    case 'replaySeed': beginRun(S.seed); break;
    case 'sortRank': prefs.sort = 'rank'; store(PREF_KEY, prefs); break;
    case 'sortSuit': prefs.sort = 'suit'; store(PREF_KEY, prefs); break;
    case 'betKey': if (e.detail === 0) stepBet(+t.dataset.hold); return; // keyboard; pointer presses are handled on pointerdown
    case 'throw': act('throw'); break;
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
    case 'release': { const i = S.powerups.map(x => x.type).lastIndexOf(t.dataset.type); if (i >= 0) act('release', i); break; }
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
  if (e.key === 'Escape' && CLOSABLE.includes(ui.modal)){ ui.modal = null; render(); return; }
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
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !S) return;
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
document.addEventListener('change', e => {
  if (e.target.id === 'betRange') render();
  if (e.target.id === 'volRange') sfx('coin');
  if (e.target.id === 'betNum') setBet(e.target.value);
});
document.addEventListener('keydown', e => { if (e.target.id === 'betNum' && e.key === 'Enter') e.target.blur(); });

// Settings: start a run from a typed seed
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-form="seed"]')) return;
  e.preventDefault();
  const seed = cleanSeed($('seedInput').value);
  if (!seed){ const m = $('seedMsg'); if (m){ m.textContent = 'A seed has 4 to 8 letters or digits, like ABCD-1234.'; m.classList.add('err'); } return; }
  beginRun(seed);
});
