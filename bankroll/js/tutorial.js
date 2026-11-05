/* Bankroll · guided first hand: a coach bubble points at each part of the table in turn */
'use strict';

const TUT_STEPS = [
  { phase:'bet', target:'#ledger', title:'Your bankroll',
    text:'Bets come out of your coins. Debt is paid when you cash out.' },
  { phase:'bet', target:'#hand', title:'Your hand',
    text:'Pairs, straights and flushes multiply your bet.' },
  { phase:'bet', target:'.betbox', title:'Place a bet',
    text:'Cashing out pays bet × multiplier.' },
  { phase:'bet', target:'[data-act="deal"]', title:'Deal',
    text:'Flips your hidden cards and deals one to the center.', waitFor:'decide' },
  { phase:'decide', target:'#pit .stage', title:'The center card',
    text:'It added your bet to the debt. Tap a hand card to swap it in, free.' },
  { phase:'decide', target:'[data-act="discard"]', title:'Discard',
    text:'Deals the next card, adding another bet of debt.' },
  { phase:'decide', target:'[data-act="cash"]', title:'Cash out',
    text:'Shows what you’d win or lose right now.', last:true },
];

function tutorialActive(){ return prefs.tutDone === false; }
function startTutorial(){ prefs.tutDone = false; prefs.tutStep = 0; store(PREF_KEY, prefs); }
function endTutorial(){ prefs.tutDone = true; store(PREF_KEY, prefs); hideCoach(); }
function nextTutorial(){
  const st = TUT_STEPS[prefs.tutStep || 0];
  if (!st || st.last) return endTutorial();
  prefs.tutStep = (prefs.tutStep || 0) + 1; store(PREF_KEY, prefs);
}

function hideCoach(){
  const c = $('coach'); if (c) c.hidden = true;
  document.querySelectorAll('.coach-on').forEach(n => n.classList.remove('coach-on'));
}

// One-time tips: shown the first time something comes up, until the player taps "Got it" (kept in prefs.tips).
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
  c.dataset.tip = k;
  c.innerHTML = `<b>${tip.title}</b><p>${tip.text}</p><div class="ch-actions"><span></span><button class="btn gold ch-next" data-act="tipDone" data-v="${k}">Got it</button></div>`;
  placeCoach(c, target);
  if (fresh) setTimeout(() => { if (!c.hidden && c.dataset.tip === k && target.isConnected) placeCoach(c, target); }, dur(700));   // after the card lands
}

// Runs after every render: shows the current step next to its target, or hides the coach.
function tutorialTick(){
  if (!tutorialActive()) return tipTick();
  let i = prefs.tutStep || 0, st = TUT_STEPS[i];
  if (!st) return endTutorial();
  // the player moved on (dealt early, or the hand ended): skip ahead to a step that fits the table
  if (st.waitFor && S.phase === st.waitFor){ nextTutorial(); i = prefs.tutStep; st = TUT_STEPS[i]; }
  if (st && st.phase === 'bet' && S.phase === 'decide'){ i = TUT_STEPS.findIndex(s => s.phase === 'decide'); prefs.tutStep = i; st = TUT_STEPS[i]; }
  const target = st && document.querySelector(st.target);
  if (!st || ui.modal || st.phase !== S.phase || !target) return hideCoach();
  const c = $('coach');
  c.dataset.tip = '';
  const n = TUT_STEPS.length;
  c.innerHTML = `<div class="ch-step">${i + 1}/${n}</div><b>${st.title}</b><p>${st.text}</p>
    <div class="ch-actions"><button class="ch-skip" data-act="tutorialSkip">Skip</button>
    ${st.waitFor ? '' : `<button class="btn gold ch-next" data-act="tutorialNext">${st.last ? 'Got it' : 'Next'}</button>`}</div>`;
  placeCoach(c, target);
}
// Shows the bubble next to its target: below it when there is room, otherwise above it.
function placeCoach(c, target){
  document.querySelectorAll('.coach-on').forEach(n => { if (n !== target) n.classList.remove('coach-on'); });
  target.classList.add('coach-on');
  c.hidden = false;
  const r = target.getBoundingClientRect(), cw = Math.min(320, innerWidth - 32);
  c.style.width = cw + 'px';
  const ch = c.offsetHeight;
  const below = r.bottom + 12 + ch < innerHeight - 8;
  const top = below ? r.bottom + 12 : Math.max(8, r.top - ch - 12);
  const left = Math.max(16, Math.min(innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
  c.style.top = top + 'px'; c.style.left = left + 'px';
  c.dataset.side = below ? 'below' : 'above';
  c.style.setProperty('--ax', Math.max(18, Math.min(cw - 18, r.left + r.width / 2 - left)) + 'px');
}
window.addEventListener('resize', () => { if (S) tutorialTick(); });
window.addEventListener('scroll', () => { if (S && (tutorialActive() || !$('coach').hidden)) tutorialTick(); }, { passive:true });
