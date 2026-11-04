/* Bankroll · guided first hand: a coach bubble points at each part of the table in turn */
'use strict';

const TUT_STEPS = [
  { phase:'bet', target:'#ledger', title:'Your bankroll',
    text:'You start with 10 coins. Bets and power-ups come out of your coins. Debt builds up during a hand and is settled when you cash out.' },
  { phase:'bet', target:'#hand', title:'Your hand',
    text:'Three cards face up, two face down. Pairs, straights and flushes give a multiplier, and multipliers stack.' },
  { phase:'bet', target:'.betbox', title:'Place a bet',
    text:'Pick your bet. Cashing out pays your bet × the hand’s multiplier.' },
  { phase:'bet', target:'[data-act="deal"]', title:'Deal',
    text:'Press Deal. The face-down cards flip over and a new card lands in the center.', waitFor:'decide' },
  { phase:'decide', target:'#pit .stage', title:'The center card',
    text:'Dealing it added one bet to your debt. Tap a hand card, or drag it up here, to swap it in. Swapping is free.' },
  { phase:'decide', target:'[data-act="discard"]', title:'Discard',
    text:'Discard throws the center card away and deals the next one, which adds another bet of debt.' },
  { phase:'decide', target:'[data-act="cash"]', title:'Cash out',
    text:'Cash out whenever you like. The button shows what you would win or lose right now.', last:true },
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

// Runs after every render: shows the current step next to its target, or hides the coach.
function tutorialTick(){
  if (!tutorialActive()) return hideCoach();
  let i = prefs.tutStep || 0, st = TUT_STEPS[i];
  if (!st) return endTutorial();
  // the player moved on (dealt early, or the hand ended): skip ahead to a step that fits the table
  if (st.waitFor && S.phase === st.waitFor){ nextTutorial(); i = prefs.tutStep; st = TUT_STEPS[i]; }
  if (st && st.phase === 'bet' && S.phase === 'decide'){ i = TUT_STEPS.findIndex(s => s.phase === 'decide'); prefs.tutStep = i; st = TUT_STEPS[i]; }
  const target = st && document.querySelector(st.target);
  if (!st || ui.modal || st.phase !== S.phase || !target) return hideCoach();
  const c = $('coach');
  document.querySelectorAll('.coach-on').forEach(n => { if (n !== target) n.classList.remove('coach-on'); });
  target.classList.add('coach-on');
  const n = TUT_STEPS.length;
  c.innerHTML = `<div class="ch-step">Step ${i + 1} of ${n}</div><b>${st.title}</b><p>${st.text}</p>
    <div class="ch-actions"><button class="ch-skip" data-act="tutorialSkip">Skip tutorial</button>
    ${st.waitFor ? '' : `<button class="btn gold ch-next" data-act="tutorialNext">${st.last ? 'Got it' : 'Next'}</button>`}</div>`;
  c.hidden = false;
  // place the bubble below the target when there is room, otherwise above it
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
window.addEventListener('scroll', () => { if (S && tutorialActive()) tutorialTick(); }, { passive:true });
