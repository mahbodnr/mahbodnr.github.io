/* Bankroll · the introduction: three practice hands with set cards. A coach bubble explains each part of the table, and
   only the one control the step asks for responds, so every new player takes the same path:
     1. the hand and the combos, a set bet (Bet and Debt highlighted), a discard, a swap and a cash-out;
     2. a Joker and the Ace boost power-up (with its upkeep);
     3. an all-in bet that chases a card, runs the debt past the hand and loses; then the level price.
   The first time it can't be skipped; replayed from Help or Settings it can. The practice run is never saved or posted,
   and the player's own run (if any) is picked up again afterwards. */
'use strict';

/* ---------- the cards, in the order they are dealt ---------- */
const INTRO_ORDER = [
  '7H', 'KS', '2D', '7C', 'KD',   '9C', 'KC',                // hand 1: two pairs; a miss, then a third King
  'QH', 'QS', '6C', '3H', '8D',   'JR', 'AC', '4C', 'QD',    // hand 2: a Joker, an Ace boost, a miss, a third Queen
  '9S', '9H', 'JC', '4S', '2C',   '5D', '3C', 'KH',          // hand 3: a pair of 9s, and no third 9
  '2S', '3S', '5S', '6S', '8S', '10S', '6H', '8H', '10H', '4H',
];
const INTRO_BET = { 1: 10, 2: 20 };      // hand 3 is all in
const icard = code => code === 'JR' ? { id:'i-JR', rank:0, suit:'JR' }
  : { id:'i-' + code, rank:{ A:1, J:11, Q:12, K:13 }[code.slice(0, -1)] || +code.slice(0, -1), suit:code.slice(-1) };
const ic = code => `#hand [data-cid="i-${code}"]`;
const cn = code => cardSpan(icard(code));
const inHand = code => S.hand.some(c => c.id === 'i-' + code);
const centre = code => !!S.pending && S.pending.id === 'i-' + code;
const introHand = () => S.stats.sets + (S.phase === 'bet' ? 1 : 0);
const multNow = () => evaluate(S.hand, S.powerups).mult;
const cashNet = () => S.coins + S.bet * multNow() - S.debt;
// what a cash-out now would leave: coins back, or how far short of the debt it falls
const leaves = () => { const n = cashNet(); return n >= 0 ? `get back ${coin}<b>${fmt(n)}</b> of your ${fmt(S.bet)}` : `fall <b>${fmt(-n)}</b> short of the debt`; };
const X = n => `<span class="x">×</span>${n}`;

let intro = null;   // { i: step, replay: started from Help/Settings (skippable) }
const introOn = () => !!(intro && S && S.intro);

function startIntro(replay){
  S = { v:SAVE_VERSION, intro:true, seed:'INTRO', history:[], runLedger:{}, uid:1, coins:START_COINS, debt:0, bet:0, betInput:1, deck:INTRO_ORDER.map(icard).reverse(),
        throwaway:[], discard:[], hand:[], faceDown:[], powerups:[], jokerSeen:[], pending:null, swapTen:null, swapCard:null, phase:'bet', result:null, over:null,
        level:1, stats:{ sets:0, cashouts:0, bestPayout:0, peak:START_COINS, shuffles:1, discards:0, biggestWin:0, biggestLoss:0, bestMult:0 }, bestHand:null,
        rng:1, rules:RULES, runId:null, official:null, log:null };
  intro = { i:0, replay:!!replay };
  ui.seen.clear(); ui.armed = null; ui.modal = null; ui.prev = null;
  newSet();
}
// back to the player's own run, or a new one
function endIntro(){
  intro = null; hideCoach();
  document.documentElement.classList.remove('intro-on', 'intro-center');
  prefs.tutDone = true; prefs.tips = Object.assign({}, prefs.tips, { joker:true }); store(PREF_KEY, prefs);
  const saved = migrate(load(SAVE_KEY));
  ui.modal = null; ui.prev = null; ui.seen.clear();
  const seed = ui.afterIntroSeed; ui.afterIntroSeed = null;            // opened from a challenge link
  const group = ui.afterIntroGroup; ui.afterIntroGroup = null;          // or a group challenge link
  if (group) setTimeout(() => { if (groupsOn()) offerGroup(group); else ui.pendingGroup = group; }, 0);
  if (saved && saved.phase !== 'over'){ S = saved; resumeModal(); render(); if (seed) offerChallenge(seed); }   // asks: a run is in progress
  else beginRun(seed || undefined);
}
function resumeModal(){
  ui.modal = { result:'result', over:'over', reshuffle:'reshuffle', swapPick:'pick' }[S.phase] || null;
  S.hand.forEach(c => ui.seen.add(c.id));
}

/* ---------- the steps ----------
   text: what the bubble says (a function, so numbers come from the table)
   target: what the bubble points at (none: a card in the middle of the screen); hl: also highlighted
   ok: the only controls that respond; until: the step is done when this is true (else it has a Next button) */
const INTRO = [
  // ---- hand 1 ----
  { title:'Welcome to Bankroll', center:true,
    text:() => 'Let\'s learn how to play the game.' },
  { target:'#hand', title:'Your hand',
    text:() => 'Five cards: three face up, two face down. The hidden ones flip when you deal.' },
  { title:'Combos multiply your bet', center:true, panel:() => `<div class="combo-ex intro-combos">
      ${exHand('7H 7S 2C 9D KS', [0, 1])}<span>Pair<small>two of a rank</small></span><b>${X(2)}</b>
      ${exHand('QH QS QD 4C 9S', [0, 1, 2])}<span>Three of a kind<small>four of a kind ${X(8)}</small></span><b>${X(4)}</b>
      ${exHand('5C 6D 7H 8S 9C', [0, 1, 2, 3, 4])}<span>Straight<small>5 in a row</small></span><b>${X(5)}</b>
      ${exHand('2H 6H 9H JH KH', [0, 1, 2, 3, 4])}<span>Flush<small>5 of a suit</small></span><b>${X(5)}</b>
    </div>
    <div class="intro-mix">
      <div class="im-head">Combos multiply each other</div>
      <div class="im-row">${exHand('KH KS KD 4C 4S', [0, 1, 2, 3, 4])}
        <div class="im-sum"><span>Three Kings <b>${X(4)}</b></span><span>Pair of 4s <b>${X(2)}</b></span></div></div>
      <div class="im-total">${X(4)} × ${X(2)} = <b>${X(8)}</b></div>
    </div>`,
    text:() => 'Cash out pays <b>bet × multiplier</b>. No combo pays nothing.' },
  { target:'.betbox', hl:['#st-bet', '#st-debt'], ok:['.betbox'], title:'Place a bet', until:() => S.betInput === INTRO_BET[1] || S.phase !== 'bet',
    text:() => `Set your bet to <b>${INTRO_BET[1]}</b>. Watch <b>Bet</b> and <b>Debt</b>: dealing adds half the bet to the debt, and the first card dealt adds the whole bet.` },
  { target:'[data-act="deal"]', hl:['#st-bet', '#st-debt'], ok:['[data-act="deal"]'], title:'Deal', until:() => S.phase !== 'bet',
    text:() => `Bet ${coin}<b>${INTRO_BET[1]}</b>. Deal flips your hidden cards and deals a card to the center.` },
  { target:'#hand', title:'Two pairs', delay:true,
    text:() => `Your hidden cards were ${cn('7C')} and ${cn('KD')}: two pairs, ${X(2)} × ${X(2)} = <b>${X(4)}</b>.` },
  { target:'#st-debt', title:'Debt', text:() => `Debt <b>${fmt(S.debt)}</b>: half your bet to deal (${Math.ceil(S.bet / 2)}), plus your bet (${S.bet}) for the center card. Cashing out pays it back.` },
  { target:'#pit .stage', ok:['[data-act="discard"]'], hl:['[data-act="discard"]'], title:'Discard', until:() => centre('KC'),
    text:() => `${cn('9C')} doesn't help. <b>Discard</b> it to deal the next card. Each new card raises the card debt ×1.5, so this one adds <b>${fmt(nextCardCost())}</b>.` },
  { target:ic('2D'), ok:[ic('2D')], hl:['#pit .stage'], title:'Swap', until:() => inHand('KC'), delay:true,
    text:() => `${cn('KC')}! Tap your ${cn('2D')} to swap it with the center card. Swapping is free.` },
  { target:'[data-act="cash"]', ok:['[data-act="cash"]'], title:'Cash out', until:() => S.phase === 'result',
    text:() => `Three Kings ${X(4)} and two 7s ${X(2)}: <b>${X(8)}</b>. Cash out: ${S.bet} × 8 = ${fmt(S.bet * 8)}, minus ${fmt(S.debt)} debt.` },
  { target:'#modalRoot [data-act="nextSet"]', ok:['#modalRoot [data-act="nextSet"]'], title:'You won', until:() => introHand() >= 2 && S.phase === 'bet',
    text:() => `You have ${coin}<b>${fmt(S.coins)}</b>. On to the next hand.` },
  // ---- hand 2 ----
  { target:'.betbox', hl:['#st-bet', '#st-debt'], ok:['.betbox'], title:'Hand 2', until:() => S.betInput === INTRO_BET[2] || S.phase !== 'bet',
    text:() => `Bet <b>${INTRO_BET[2]}</b> this time. Bet and Debt show what dealing will cost.` },
  { target:'[data-act="deal"]', ok:['[data-act="deal"]'], title:'Deal', until:() => S.phase !== 'bet', text:() => 'Deal.' },
  { target:ic('JR'), title:'A Joker!', delay:true,
    text:() => 'A Joker goes straight into your hand and adds a <b>seat</b>: you now hold 6 cards. It never makes a combo, but if you swap it out the extra seat stays.' },
  { target:'[data-act="power"]', ok:['[data-act="power"]'], hl:['#pit .stage'], title:'A power-up', until:() => S.powerups.length > 0,
    text:() => `An Ace in the center can be a power-up. <b>Ace boost</b> adds +1 to every combo's multiplier. It costs ${coin}${fmt(powerCost(1))} now, then keeping it costs 2, 4, 8 … for each new card. Buy it.` },
  { target:'#powers', title:'Upkeep', delay:true,
    text:() => `Power-ups have their own place. Your Ace boost shows the Ace you bought it with, and what keeping it costs on the next card (${coin}${fmt(upkeep())}). ✕ releases it.` },
  { target:'#pit .stage', ok:['[data-act="discard"]'], hl:['[data-act="discard"]'], title:'Discard', until:() => centre('QD'),
    text:() => `${cn('4C')} doesn't help. Discard: the Ace boost costs ${coin}${fmt(upkeep())} and the card debt goes up again.` },
  { target:ic('JR'), ok:[ic('JR')], hl:['#pit .stage'], title:'Swap out the Joker', until:() => inHand('QD'), delay:true,
    text:() => `${cn('QD')} makes three Queens. Swap it for the Joker: you keep its seat.` },
  { target:'[data-act="cash"]', ok:['[data-act="cash"]'], title:'Cash out', until:() => S.phase === 'result',
    text:() => `Three Queens ${X(4)}, +1 from the Ace boost: <b>${X(multNow())}</b>. Cash out.` },
  { target:'#modalRoot [data-act="nextSet"]', ok:['#modalRoot [data-act="nextSet"]'], title:'Nice', until:() => introHand() >= 3 && S.phase === 'bet',
    text:() => `${coin}<b>${fmt(S.coins)}</b>. One more hand.` },
  // ---- hand 3 ----
  { target:'.betbox', hl:['#st-bet', '#st-debt'], ok:['.presets .q:last-child'], title:'Go big', until:() => S.betInput === S.coins || S.phase !== 'bet',
    text:() => `Feeling lucky? Bet everything: tap <b>Max</b>. Look how much debt that brings.` },
  { target:'[data-act="deal"]', hl:['#st-debt'], ok:['[data-act="deal"]'], title:'All in', until:() => S.phase !== 'bet', text:() => `Deal ${coin}<b>${fmt(S.betInput)}</b>.` },
  { target:'[data-act="discard"]', ok:['[data-act="discard"]'], hl:['#hand', '#st-debt'], title:'Chase it?', until:() => centre('3C'), delay:true,
    text:() => `A pair of 9s, ${X(2)}. Cashing out now would ${leaves()}. A third 9 would make it ${X(4)}. Discard to chase it (+${fmt(nextCardCost())} debt).` },
  { target:'[data-act="discard"]', ok:['[data-act="discard"]'], hl:['#st-debt'], title:'No 9', until:() => centre('KH'),
    text:() => `Cashing out now would ${leaves()}. One more try (+${fmt(nextCardCost())} debt).` },
  { target:'[data-act="cash"]', ok:['[data-act="cash"]'], hl:['#st-debt'], title:'Out of luck', until:() => ui.modal === 'bust' || S.phase === 'over',
    text:() => `Debt <b>${fmt(S.debt)}</b> is more than this hand pays (${fmt(S.bet * multNow())}), and you bet all your coins. Cash out.` },
  { target:'#modalRoot [data-act="bustConfirm"]', ok:['#modalRoot [data-act="bustConfirm"]'], title:'Busted', until:() => S.phase === 'over',
    text:() => 'A cash-out that can\'t cover the debt ends the run.' },
  { target:'#st-debt', title:'Run over', text:() => 'A big bet, then chasing cards, ran the debt past what the hand could pay. Keep coins back, and cash out a good hand.' },
  { target:'#levelbar', title:'Levels', text:() => `The other way to lose: each deck is a level. When it runs out, pay the level price to reshuffle: ${coin}<b>100</b> for level 2, then 1,000, 20,000 … Short of it, the run ends. This bar shows how close you are.` },
  { title:'You\'re ready', center:true, done:true,
    text:() => `That's the game. You start with ${coin}<b>${START_COINS}</b>. Help (?) has the rules any time. Good luck!` },
];

function introStep(){
  let st = INTRO[intro.i];
  while (st && st.until && st.until()){ intro.i++; st = INTRO[intro.i]; }
  return st;
}
function introNext(){ if (!introOn()) return; const st = INTRO[intro.i]; if (st && st.done) return endIntro(); intro.i++; }
function introAllows(el){ return !introOn() || !!(el && el.closest && el.closest('.intro-ok, #coach')); }

function introTick(){
  const root = document.documentElement;
  document.querySelectorAll('.intro-ok, .intro-hl, .coach-on').forEach(n => n.classList.remove('intro-ok', 'intro-hl', 'coach-on'));
  root.classList.toggle('intro-on', introOn());
  if (!introOn()){ root.classList.remove('intro-center'); return; }
  const st = introStep();
  if (!st) return endIntro();
  (st.ok || []).forEach(sel => document.querySelectorAll(sel).forEach(n => n.classList.add('intro-ok')));
  (st.hl || []).forEach(sel => document.querySelectorAll(sel).forEach(n => n.classList.add('intro-hl')));
  root.classList.toggle('intro-center', !!st.center);
  const c = $('coach'), key = String(intro.i), fresh = c.hidden || c.dataset.step !== key;
  c.dataset.step = key; c.dataset.tip = '';
  c.classList.toggle('wide', !!st.center);
  const h = Math.min(3, introHand());
  c.innerHTML = `<div class="ch-step">${st.center && intro.i === 0 ? 'Introduction' : `Practice hand ${h} of 3`}</div><b>${st.title}</b>${st.panel ? st.panel() : ''}<p>${st.text()}</p>
    <div class="ch-actions">${intro.replay ? '<button class="ch-skip" data-act="introSkip">Skip</button>' : '<span></span>'}
    ${st.until ? '' : `<button class="btn gold ch-next" data-act="introNext">${st.done ? 'Start playing' : 'Next'}</button>`}</div>`;
  const target = st.target && document.querySelector(st.target);
  if (target) target.classList.add('coach-on');
  const place = () => { if (!introOn() || c.dataset.step !== key) return; const t = st.target && document.querySelector(st.target); if (t) placeCoach(c, t); else centerCoach(c); };
  place();
  if (fresh && st.delay) setTimeout(place, dur(800));   // after the cards land
}
function centerCoach(c){
  const z = typeof ZK === 'number' ? ZK : 1;
  c.hidden = false; c.dataset.side = 'center';
  const cw = Math.min(460 * z, innerWidth - 24);
  c.style.width = cw / z + 'px';
  const ch = c.offsetHeight * z;
  c.style.left = (innerWidth - cw) / 2 / z + 'px'; c.style.top = Math.max(12, (innerHeight - ch) / 2) / z + 'px';
}

// the practice run ends on the table, not in the run-over window, and leaves no records
const baseGameOver = gameOver;
gameOver = function(reason, extra){
  if (!S || !S.intro) return baseGameOver(reason, extra);
  S.phase = 'over'; S.over = Object.assign({ reason }, extra || {}); ui.modal = null; S.coins = Math.max(0, S.coins);
  sfx('lose'); ui.say = 'Run over. ' + reason;
};

/* ---------- one-time tips ---------- */
function hideCoach(){
  const c = $('coach'); if (c){ c.hidden = true; c.classList.remove('wide'); }
  document.querySelectorAll('.coach-on').forEach(n => n.classList.remove('coach-on'));
}
// Shown the first time something comes up, until the player taps "Got it" (kept in prefs.tips).
const TIPS = {
  joker:{ target:'#hand .card.joker', title:'Joker',
    text:'Adds a seat for this hand, at no cost. Swap it out anytime; the seat stays. It never pairs.' },
};
function tipDone(k){ prefs.tips = Object.assign({}, prefs.tips, { [k]:true }); store(PREF_KEY, prefs); hideCoach(); }
function tipTick(){
  const seen = prefs.tips || {};
  const k = ui.modal ? null : Object.keys(TIPS).find(t => !seen[t] && document.querySelector(TIPS[t].target));
  if (!k) return hideCoach();
  const tip = TIPS[k], target = document.querySelector(tip.target), c = $('coach');
  const fresh = c.hidden || c.dataset.tip !== k;
  c.dataset.tip = k; c.dataset.step = '';
  c.innerHTML = `<b>${tip.title}</b><p>${tip.text}</p><div class="ch-actions"><span></span><button class="btn gold ch-next" data-act="tipDone" data-v="${k}">Got it</button></div>`;
  placeCoach(c, target);
  if (fresh) setTimeout(() => { if (!c.hidden && c.dataset.tip === k && target.isConnected) placeCoach(c, target); }, dur(700));   // after the card lands
}

// Runs after every render: the intro's current step, or a one-time tip.
function tutorialTick(){ if (intro) introTick(); else tipTick(); }

// Shows the bubble next to its target: below it when there is room, otherwise above it.
function placeCoach(c, target){
  document.querySelectorAll('.coach-on').forEach(n => { if (n !== target) n.classList.remove('coach-on'); });
  target.classList.add('coach-on');
  c.hidden = false;
  // measured in screen pixels; the bubble is zoomed with the game on big screens, so its lengths are divided by ZK
  const z = typeof ZK === 'number' ? ZK : 1;
  const r = target.getBoundingClientRect(), cw = Math.min(320 * z, innerWidth - 32);
  c.style.width = cw / z + 'px';
  const ch = c.offsetHeight * z;
  const below = r.bottom + 12 + ch < innerHeight - 8;
  const top = below ? r.bottom + 12 : Math.max(8, r.top - ch - 12);
  const left = Math.max(16, Math.min(innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
  c.style.top = top / z + 'px'; c.style.left = left / z + 'px';
  c.dataset.side = below ? 'below' : 'above';
  c.style.setProperty('--ax', Math.max(18, Math.min(cw - 18 * z, r.left + r.width / 2 - left)) / z + 'px');
}
window.addEventListener('resize', () => { if (S) tutorialTick(); });
window.addEventListener('scroll', () => { if (S && !$('coach').hidden) tutorialTick(); }, { passive:true });
