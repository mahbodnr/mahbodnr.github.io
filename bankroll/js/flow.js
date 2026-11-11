/* Bankroll · game flow: dealing, swaps, power-ups, cash-out, levels */
'use strict';

/* ================= flow ================= */
function newSet(){
  S.handLedger = null;
  S.bet = 0; S.debt = 0; S.cardSteps = []; S.hand = []; S.powerups = []; S.pending = null; S.jokerSeen = []; S.faceDown = [];
  S.swapTen = null; S.swapCard = null; S.result = null; S.pendingCharged = false; S.swapRefund = false; ui.armed = null;
  if (S.coins < 1) return gameOver('You have no coins left to bet.', { cause:'broke' });
  if (S.deck.length < 5) return deckOut();
  keepBestHand();
  for (let i = 0; i < 5; i++) S.hand.push(S.deck.pop());
  S.faceDown = [S.hand[3].id, S.hand[4].id];
  S.jokerSeen = S.hand.slice(0, 3).filter(isJoker).map(c => c.id);
  S.betInput = Math.max(1, Math.min(S.betInput || 1, S.coins));
  S.phase = 'bet';
  sfx('deal');
}

function deckOut(){
  S.throwaway.push(...S.deck); S.deck = [];
  const price = levelPrice(lvl());
  if (S.coins >= price){ keepBestHand(); S.phase = 'reshuffle'; ui.modal = 'reshuffle'; sfx('win'); }
  else gameOver(`You finished level ${lvl()}, but reaching level ${lvl() + 1} costs ${fmt(price)} coins and you have ${fmt(S.coins)}.`,
    { cause:'level', price, have:S.coins });
}

function reshuffle(){
  const price = levelPrice(lvl());
  if (S.phase !== 'reshuffle' || S.coins < price) return;
  coinChange(-price, 'level price'); S.throwaway = []; S.discard = [];
  S.level = lvl() + 1; S.deck = makeDeck(); S.stats.shuffles = S.level;
  ui.levelUp = true; ui.shuffleFx = true; buzz([30, 40, 30]); sfx('shuffle');
  ui.say = `Level ${S.level}. The deck has been reshuffled.`;
  applyPrefs(); // a new level can unlock card packs and felts
  reportProgress();
  ui.modal = null; sfx('coin'); newSet();
  if (typeof checkUnlocks === 'function') checkUnlocks();   // announce any card pack or felt this level unlocked
}

// the last cash-out's hand becomes the run's biggest multiplier once the run goes on past it
function keepBestHand(){
  const b = S.bestCandidate; S.bestCandidate = null;
  if (b && b.mult > (S.stats.bestMult || 0)){ S.stats.bestMult = b.mult; S.bestHand = b; reportProgress(); }   // post it to the boards now
}

function gameOver(reason, extra){
  if (!(extra && extra.won)) S.bestCandidate = null;   // the hand that ended the run doesn't count as its biggest multiplier (unless it won it)
  S.phase = 'over'; S.over = { reason, ...(extra || {}) }; ui.modal = 'over';
  // save the best record across runs
  const st = S.stats, rec = Object.assign({ level:0, biggestWin:0, biggestLoss:0, peak:0, bestPayout:0, hands:0, runs:0 }, prefs.record || {});
  const run = { level:lvl(), biggestWin:st.biggestWin || 0, biggestLoss:st.biggestLoss || 0, peak:st.peak, bestPayout:st.bestPayout, hands:st.cashouts };
  const isNew = {};
  ['level','biggestWin','biggestLoss','peak','bestPayout','hands'].forEach(k => { if (run[k] > rec[k] && run[k] > 0){ if (k !== 'biggestLoss') isNew[k] = true; rec[k] = run[k]; } });
  rec.runs = (rec.runs || 0) + 1;
  prefs.record = rec; store(PREF_KEY, prefs);
  S.over.run = run; S.over.isNew = isNew; S.over.firstRun = rec.runs === 1;
  sfx('lose');
  ui.say = `Run over at level ${run.level}. ${reason}`;
  reportProgress(true);
}

function throwAway(){
  if (S.phase !== 'bet') return;
  const thrown = S.hand.slice();
  S.throwaway.push(...thrown); S.hand = [];
    sfx('swish');
  newSet();
}

function deal(){
  if (S.phase !== 'bet') return;
  const bet = Math.max(1, Math.min(S.betInput, S.coins));
  S.handStart = S.coins; S.handLedger = {};
  S.bet = bet; S.lastBet = bet; coinChange(-bet, 'bet');
  S.debt += Math.ceil(bet / 2); S.cardSteps = [];   // half a bet to deal (rounded up)
  S.faceDown.forEach(id => ui.flips.add(id)); S.faceDown = [];
  S.hand.forEach(c => { if (isJoker(c) && !S.jokerSeen.includes(c.id)) S.jokerSeen.push(c.id); });
  S.stats.sets++; S.phase = 'idle';
  sfx('coin');
  drawNext();
}

// Deals until a card lands in the center: Jokers and cards that fill an open seat go straight
// to the hand, and dealing carries on. waive: a power-up was just bought; its price covers its upkeep for this deal
function drawNext(waive, why){
  if (S.phase !== 'idle') return;
  let first = true;
  ui.armed = null;
  while (S.deck.length){
    // each power-up pays its current upkeep, which then doubles. A power-up just bought (waive) rides free on every card
    // its purchase deals: an Extra seat (or a Joker) deals a card into the hand before the next one reaches the center.
    const charges = S.powerups.map((p, i) => waive && i === S.powerups.length - 1 ? 0 : upkeepOf(p));
    const up = charges.reduce((a, b) => a + b, 0);
    if (S.coins < up) break;
    coinChange(-up, 'upkeep');
    S.powerups.forEach((p, i) => { if (charges[i]) p.paid = (p.paid || 0) + 1; });
    const c = S.deck.pop();
    ui.seen.add(c.id);
    if (isJoker(c)){
      if (!S.jokerSeen.includes(c.id)) S.jokerSeen.push(c.id);
      S.hand.push(c); ui.flies.push({ id:c.id, kind:'newJoker' }); sfx('power');
    } else if (S.hand.length < capacity()){
      S.hand.push(c); sfx('place');
      const kind = (first && why) || (S.hand.some(x => isJoker(x) && x.id !== c.id) ? 'joker' : 'five');
      ui.flies.push({ id:c.id, kind });
    } else {
      // with a full hand, the new card counts as a discard the moment it is dealt
      S.pending = c; S.dealtId = c.id; S.phase = 'decide'; sfx('deal');
      S.pendingCharged = true; chargeCard();
      ui.dealFx = c.id;
      buzz(8);
      ui.say = `New card in the center: ${cardName(c)}. Debt is now ${fmt(S.debt)}.`;
      return;
    }
    first = false;
  }
}
// after any action: keep a card in the center whenever the deck and upkeep allow
function settle(){
  if (S.phase === 'trim' && S.hand.length > capacity()) return;
  if (S.pending){ S.phase = 'decide'; return; }
  S.phase = 'idle';
  if (canDraw()) drawNext();
}

function coinChange(d, label, cat){
  if (!d) return;
  S.coins += d;
  if (S.handLedger){ const k = cat || label; S.handLedger[k] = (S.handLedger[k] || 0) + d; }
  (ui.coinEv = ui.coinEv || []).push({ d, label });
}
/* Debt: dealing costs half a bet, rounded up, added to the debt, and each card dealt into a full hand
   raises the debt from cards ×1.5, rounded to whole coins (at least +1): the 1st card adds 1 bet, then the card
   debt goes ×1.5 each time. With a bet of 1: 1 → 2 → 3 → 5 → 8 → 12 → 18 …; with 10: 10 → 15 → 23 → 35 → 53 …
   Each card's charge is remembered (S.cardSteps), so refunding a card returns exactly what it added. */
const cardDebtNow = () => (S.cardSteps || []).reduce((a, b) => a + b, 0);
const nextCardCost = () => { const cd = cardDebtNow(); return cd > 0 ? Math.max(1, Math.round(cd * 1.5) - cd) : S.bet; };
function chargeCard(){ const inc = nextCardCost(); (S.cardSteps = S.cardSteps || []).push(inc); S.debt += inc; S.stats.discards++; return inc; }
// undo the most recent card's charge (a fresh card used as a power-up or for the 10 take-back)
function refundCard(){ const inc = (S.cardSteps || []).pop(); if (!inc) return; S.debt -= inc; S.stats.discards--; }
function canDraw(){ return S.deck.length > 0 && S.coins >= upkeep(); }


function discardPending(){
  if (S.phase !== 'decide') return;
  const c = S.pending; S.discard.push(c); S.pending = null;
  if (!S.pendingCharged) chargeCard();
  S.pendingCharged = false; S.phase = 'idle'; ui.armed = null;
  sfx('swish');
  settle();
  if (S.phase === 'idle' && S.deck.length && S.coins < upkeep()) ui.upkeepFx = true;   // discarded, but the next card can't be paid for
}

// power-ups and the 10-swap belong to the freshly dealt card only
const offerIsDealt = () => !!S.pending && S.pending.id === S.dealtId;
function swapWithCenter(id){
  if (S.phase !== 'decide' || !S.pending) return;
  const i = S.hand.findIndex(c => c.id === id); if (i < 0) return;
  const handEl = document.querySelector(`#hand [data-cid="${id}"]`), stageEl = document.querySelector('#pit .stage .card');
  ui.swapFx = { inId:S.pending.id, outId:id,
    fromStage: stageEl && stageEl.getBoundingClientRect(), fromHand: handEl && handEl.getBoundingClientRect() };
  const out = S.hand[i]; S.hand[i] = S.pending; S.pending = out; ui.armed = null;
  ui.seen.add(out.id);
  sfx('place');
  ui.say = `Swapped ${cardName(S.hand[i])} into your hand. ${cardName(out)} is in the center. Multiplier ×${fmt(evaluate(S.hand, S.powerups).mult)}.`;
}
function usePower(){
  if (S.phase !== 'decide' || !offerIsDealt()) return;
  const p = POWER[S.pending.rank]; if (!p) return;
  const cost = powerCost(S.pending.rank); if (S.coins < cost) return;
  if (p.type === '2' && S.powerups.some(x => x.type === '2')) return; // Two-tone doesn't stack
  if (p.type === '5' && !S.deck.length) return;                         // no card left to fill the seat
  if (S.pendingCharged) refundCard(); S.pendingCharged = false;
  coinChange(-cost, 'power-up'); S.powerups.push({ card:S.pending, type:p.type }); S.pending = null; S.phase = 'idle'; ui.armed = null;
  sfx('power');
  ui.say = `${p.name} active.`;
  // buying a power-up deals the next card right away; the purchase price covers that power-up's upkeep for this card
  drawNext(cost, p.type === '5' ? 'five' : null);
}

function startSwap(){
  if (S.phase !== 'decide' || !offerIsDealt() || S.pending.rank !== 10 || S.coins < swapCost() || !S.discard.length) return;
  S.swapRefund = S.pendingCharged;
  if (S.pendingCharged) refundCard(); S.pendingCharged = false;
  coinChange(-swapCost(), '10 swap'); S.swapTen = S.pending; S.pending = null; S.discard.push(S.swapTen);
  S.phase = 'swapPick'; ui.modal = 'pick'; ui.armed = null; sfx('coin');
}
function cancelSwap(){
  if (S.phase === 'swapPlace'){ S.discard.push(S.swapCard); S.swapCard = null; S.phase = 'swapPick'; ui.modal = 'pick'; ui.armed = null; return; }
  if (S.phase !== 'swapPick') return;
  S.discard = S.discard.filter(c => c.id !== S.swapTen.id);
  S.pending = S.swapTen; S.swapTen = null; coinChange(swapCost(), 'refund', '10 swap'); S.phase = 'decide'; ui.modal = null;
  if (S.swapRefund){ chargeCard(); S.pendingCharged = true; } S.swapRefund = false;
}
function pickFromDiscard(id){
  if (S.phase !== 'swapPick' || id === S.swapTen.id) return;
  const i = S.discard.findIndex(c => c.id === id); if (i < 0) return;
  S.swapCard = S.discard.splice(i, 1)[0]; ui.modal = null;
  if (S.hand.length < capacity()){
    S.hand.push(S.swapCard);
    S.swapCard = null; S.swapTen = null; S.phase = 'idle'; sfx('place');
    settle();
  } else S.phase = 'swapPlace';
}
function placeSwap(id){
  if (S.phase !== 'swapPlace' || !S.swapCard) return;
  const i = S.hand.findIndex(c => c.id === id); if (i < 0) return;
  const out = S.hand[i]; S.discard.push(out); S.hand[i] = S.swapCard;
  S.swapCard = null; S.swapTen = null; S.phase = 'idle'; ui.armed = null; sfx('place');
  settle();
}

function releasePower(idx){
  if (S.phase !== 'idle' && S.phase !== 'decide') return;
  const p = S.powerups.splice(idx, 1)[0]; if (!p) return;
  S.discard.push(p.card);
  sfx('swish');
  if (S.hand.length > capacity()){ S.phase = 'trim'; ui.armed = null; }
  else settle();
}
function trimCard(id){
  if (S.phase !== 'trim') return;
  const i = S.hand.findIndex(c => c.id === id); if (i < 0) return;
  const out = S.hand.splice(i, 1)[0]; S.discard.push(out); chargeCard();
  sfx('debt'); ui.armed = null;
  if (S.hand.length <= capacity()){ S.phase = 'idle'; settle(); }
}

function swapPreview(){
  if (!S.pending) return null;
  const base = evaluate(S.hand, S.powerups).mult;
  let best = null;
  S.hand.forEach((c, i) => {
    const h = S.hand.slice(); h[i] = S.pending;
    const m = evaluate(h, S.powerups).mult;
    if (!best || m > best.mult) best = { mult:m, out:c };
  });
  const add = S.hand.length < capacity() ? evaluate(S.hand.concat([S.pending]), S.powerups).mult : null;
  return { base, best, add };
}
function swapMult(id){
  const h = S.hand.map(c => c.id === id ? S.pending : c);
  return evaluate(h, S.powerups).mult;
}

function canCashOut(){ return S.phase === 'decide' || S.phase === 'idle'; }
function cashOut(force){
  if (!canCashOut()) return;
  const ev = evaluate(S.hand, S.powerups);
  const payout = S.bet * ev.mult;
  // a cash-out that can't cover the debt ends the run: ask first
  if (!force && S.coins + payout - S.debt < 0){ ui.modal = 'bust'; return; }
  ui.modal = null;
  const before = S.coins;
  let total = S.coins + payout - S.debt;
  // past the largest number the game can hold (about 1.8e308) a win is infinite: the bank is broken (see below)
  if (Number.isNaN(total) && payout === Infinity) total = Infinity;
  const res = { hand:S.hand.slice(), powerups:S.powerups.slice(), ev, bet:S.bet, payout, debt:S.debt, before, total, deckLeft:S.deck.length,
    start: S.handStart ?? (before + S.bet), discards: S.bet ? Math.round(S.debt / S.bet) : 0, handNo: S.stats.sets };
  if (S.pending) S.throwaway.push(S.pending);
  S.throwaway.push(...S.hand, ...S.powerups.map(p => p.card), ...S.discard);
  S.hand = []; S.powerups = []; S.discard = []; S.pending = null;
  S.stats.cashouts++;
  // the biggest multiplier this run, with the hand that made it (shown on the leaderboard). It only counts once the
  // run carries on after it (see keepBestHand): a hand that busts, or ends the run right after, is not a record.
  S.bestCandidate = ev.mult > (S.stats.bestMult || 0)
    ? { cards:res.hand.map(c => [c.rank, c.suit]), powers:res.powerups.map(p => [p.card.rank, p.card.suit, p.type]),   // the power-ups that played a part
        labels:ev.combos.map(c => c.label), mult:ev.mult, bet:res.bet, hand:res.handNo, level:lvl() }
    : null;
  coinChange(payout, 'payout'); coinChange(-S.debt, 'debt');
  res.ledger = Object.assign({}, S.handLedger || { bet:-res.bet, payout, debt:-res.debt });
  S.runLedger = S.runLedger || {};
  Object.entries(res.ledger).forEach(([k, v]) => { S.runLedger[k] = (S.runLedger[k] || 0) + v; });   // totals for the run-over tips
  res.net = S.coins - res.start;
  if (res.net > 0) S.stats.biggestWin = Math.max(S.stats.biggestWin || 0, res.net);
  if (res.net < 0) S.stats.biggestLoss = Math.max(S.stats.biggestLoss || 0, -res.net);
  recordHand(res, S.coins);
  // Infinity: the coins can't be counted any more. The level is won and the run ends there, a win.
  if (!(S.coins < Infinity) || total === Infinity){
    S.coins = Infinity; S.debt = 0; res.net = Infinity;
    S.stats.peak = Infinity; S.stats.biggestWin = Infinity; S.stats.bestPayout = Math.max(S.stats.bestPayout || 0, payout);
    S.infinite = true;
    keepBestHand();                       // the hand that broke the bank counts: the run is won, not lost
    ui.celebrate = true; buzz([25, 40, 25, 40, 60, 40, 120]);
    return gameOver('Your coins went past anything that can be counted: infinity. The bank is broken.', { res, cause:'infinite', won:true });
  }
  if (total < 0){
    S.debt = 0; ui.shake = true; buzz([80, 50, 120]);
    return gameOver(`Your coins plus the payout (${fmt(before + payout)}) couldn’t cover a debt of ${fmt(res.debt)}.`,
      { res, cause:'bust', need:res.debt, have:before + payout });
  }
  S.debt = 0;
  S.stats.bestPayout = Math.max(S.stats.bestPayout, payout);
  S.stats.peak = Math.max(S.stats.peak, S.coins);
  S.result = res; S.phase = 'result'; ui.modal = 'result';
  // a new player's first hand is over: the Tutorial button goes; if the hand lost, its result offers the tutorial
  if (!S.intro && prefs.tutHint){ prefs.tutHint = false; ui.tutOffer = res.net < 0 && !prefs.tutDone; store(PREF_KEY, prefs); }
  sfx(payout > res.debt ? 'win' : payout > 0 ? 'coin' : 'lose');
  if (ev.mult >= 10){ ui.celebrate = true; buzz([25, 40, 25, 40, 60]); } else if (res.net > 0) buzz(30);
  reportProgress();
  ui.say = `Cashed out. ${res.net >= 0 ? 'Gained' : 'Lost'} ${fmt(Math.abs(res.net))} coins. You now have ${fmt(S.coins)}.`;
}

/* ================= moves =================
   Every move the player makes goes through act(). It is recorded in S.log so the whole run can be replayed
   from its seed (the website's server does this to verify leaderboard scores), then applied. The functions
   it calls check the phase themselves, so a replayed log can only ever make legal moves. */
function act(type, arg){
  if (!S || S.phase === 'over') return;
  if (Array.isArray(S.log)) S.log.push(arg === undefined ? [type] : [type, arg]);
  switch (type){
    case 'deal':    S.betInput = Math.floor(Number(arg)) || 1; deal(); break;
    case 'throw':   throwAway(); break;
    case 'swap':    swapWithCenter(arg); break;
    case 'discard': discardPending(); break;
    case 'next':    drawNext(); break;
    case 'power':   usePower(); break;
    case 'swap10':  startSwap(); break;
    case 'cancel10':cancelSwap(); break;
    case 'pick':    pickFromDiscard(arg); break;
    case 'place':   placeSwap(arg); break;
    case 'release': if (Number.isInteger(arg)) releasePower(arg); break;
    case 'trim':    trimCard(arg); break;
    case 'cash':    cashOut(!!arg); break;
    case 'nextSet': if (S.phase === 'result'){ ui.modal = null; newSet(); } break;
    case 'level':   reshuffle(); break;
  }
}
