/* Bankroll · rendering: table, hand, value bar, dock, dialogs, animations */
'use strict';

/* ================= rendering ================= */
const $ = id => document.getElementById(id);
// Only touch the DOM when a section's markup actually changed (keeps hover, focus and scroll).
function setHTML(el, html){ if (!el || el.__html === html) return false; el.innerHTML = html; el.__html = html; return true; }
const kbd = k => `<kbd aria-hidden="true">${k}</kbd>`;
function cardHTML(c, opts = {}){
  const pk = opts.pack || currentPack();
  const cls = ['card', 'pk-' + pk];
  if (opts.back){ cls.push('back'); if (opts.extra) cls.push(opts.extra); return `<div class="${cls.join(' ')}"${opts.style ? ` style="${opts.style}"` : ''} aria-label="Face-down card"></div>`; }
  if (isRed(c)) cls.push('red');
  cls.push('s-' + c.suit);
  if (opts.track !== false){
    if (!ui.seen.has(c.id)) cls.push('enter');
    else if (ui.flips.has(c.id)) cls.push('flip');
  }
  if (opts.extra) cls.push(opts.extra);
  const data = opts.act ? ` data-act="${opts.act}" data-id="${c.id}" role="button" tabindex="0"` : '';
  const tag = opts.tag ? `<span class="tag ${opts.tagClass || ''}">${opts.tag}</span>` : '';
  if (isJoker(c)){
    cls.push('joker');
    return `<div class="${cls.join(' ')}"${data} data-cid="${c.id}" aria-label="${cardName(c)}"><span class="jw">JOKER</span><span class="jw b2">JOKER</span><div class="pip"><span class="medal"><svg viewBox="0 0 100 100"><use href="#jk-star"/></svg></span></div>${tag}</div>`;
  }
  const r = RANKS[c.rank], su = suitSVG(c.suit);
  let mid;
  if (c.rank >= 11) mid = courtHTML(c, pk);
  else if (c.rank === 1) mid = aceHTML(c, pk);
  else mid = `<div class="pips">${PIPS[c.rank].map(([x, y]) => `<span style="left:${x}%;top:${y}%"${y > 50 ? ' class="dn"' : ''}>${suitSVG(c.suit, 'pp')}</span>`).join('')}</div>`;
  return `<div class="${cls.join(' ')}"${data} data-cid="${c.id}" aria-label="${cardName(c)}"><div class="ix tl"><b>${r}</b>${su}</div>${mid}<div class="ix br"><b>${r}</b>${su}</div>${tag}</div>`;
}

const PIPS = (() => {
  const L = 0, M = 50, Rr = 100;
  const six = [[L,0],[Rr,0],[L,50],[Rr,50],[L,100],[Rr,100]];
  const eight = [[L,0],[Rr,0],[L,33.3],[Rr,33.3],[L,66.7],[Rr,66.7],[L,100],[Rr,100]];
  return { 2:[[M,0],[M,100]], 3:[[M,0],[M,50],[M,100]], 4:[[L,0],[Rr,0],[L,100],[Rr,100]],
    5:[[L,0],[Rr,0],[M,50],[L,100],[Rr,100]], 6:six, 7:six.concat([[M,25]]), 8:six.concat([[M,25],[M,75]]),
    9:eight.concat([[M,50]]), 10:eight.concat([[M,16.7],[M,83.3]]) };
})();
function suitSVG(s, cls){ return `<svg class="${cls || 'su'}" viewBox="0 0 100 100" aria-hidden="true"><use href="#su-${s}"/></svg>`; }

function sortedHand(){
  const h = S.hand.slice();
  const rv = c => isJoker(c) ? 99 : (c.rank === 1 ? 14 : c.rank);
  if (prefs.sort === 'rank') h.sort((a, b) => rv(a) - rv(b) || a.suit.localeCompare(b.suit));
  else if (prefs.sort === 'suit') h.sort((a, b) => (isJoker(a) - isJoker(b)) || a.suit.localeCompare(b.suit) || rv(a) - rv(b));
  const down = c => S.faceDown.includes(c.id);
  return h.filter(c => !down(c)).concat(h.filter(down));
}

function renderLedger(){
  const ev = S.phase === 'bet' ? null : evaluate(S.hand, S.powerups);
  setHTML($('ledger'), `
    <div class="stat" id="st-coins"><div class="k">Coins</div><div class="v">${coin}${fmt(S.coins)}</div></div>
    <div class="stat"><div class="k">Bet</div><div class="v">${S.bet ? fmt(S.bet) : '<small>not placed</small>'}</div></div>
    <div class="stat debt ${S.debt ? '' : 'zero'}" id="st-debt"><div class="k">Debt</div><div class="v">${fmt(S.debt)}</div></div>
    <div class="stat" id="st-level"><div class="k">Level</div><div class="v">${lvl()}</div></div>`);
  const L = lvl(), price = levelPrice(L), used = 54 - S.deck.length, need = price - S.coins;
  setHTML($('levelbar'), `
    <div class="lb-track" title="${S.deck.length} cards left in level ${L}"><i style="width:${(used / 54 * 100).toFixed(1)}%"></i><span>${S.deck.length} cards left in level ${L}</span></div>
    <div class="lb-price">To reach level ${L + 1}: <b>${coin}${fmt(price)}</b> <em class="${need > 0 ? 'short' : 'ok'}">${need > 0 ? `need ${fmt(need)} more` : '✓ covered'}</em></div>`);
  if (ui.levelUp){ ui.levelUp = false; floatDelta('st-level', 'LEVEL UP', 'coin-up', 'bump'); }
}

function renderPit(){
  const dl = S.deck.length;
  const deck = dl
    ? `<div class="stack deck ${ui.shuffleFx ? 'shuffling' : ''}">${dl > 2 ? cardHTML(null, { back:true }) : ''}${dl > 1 ? cardHTML(null, { back:true }) : ''}${cardHTML(null, { back:true })}</div>`
    : `<div class="emptyslot">Empty</div>`;
  let spot;
  if (S.pending) spot = cardHTML(S.pending, { extra:'hot' });
  else if (S.phase === 'swapPlace' && S.swapCard) spot = cardHTML(S.swapCard, { extra:'hot' });
  else {
    const msg = S.phase === 'bet' ? 'Place a bet' : (!dl ? 'Deck empty' : 'Deal a card');
    spot = `<div class="emptyslot">${msg}</div>`;
  }
  const spotLbl = S.phase === 'swapPlace' ? 'From discard' : S.pending && S.pending.id !== S.dealtId ? 'Center card' : 'New card';
  const top = S.discard.slice(-3);
  const dis = top.length
    ? top.map((c, i) => cardHTML(c, { track:false }).replace('class="card', `style="left:${i * 14}px;transform:rotate(${(i - 1) * 6}deg)" class="card`)).join('')
    : `<div class="emptyslot" style="position:absolute;left:14px;top:0">None yet</div>`;
  setHTML($('pit'), `
    <div class="zone"><button class="deckbtn" data-act="viewOut" aria-label="Deck: open the card tracker" title="Card tracker">${deck}</button><div class="lbl">Deck <b>${dl}</b></div></div>
    <div class="zone spot"><div class="stage">${spot}</div><div class="lbl">${spotLbl}</div></div>
    <div class="zone"><button class="discardbtn" data-act="viewDiscard" ${S.discard.length ? '' : 'disabled'} aria-label="View discard pile">${dis}</button><div class="lbl">Discard <b>${S.discard.length}</b></div></div>`);
}

const PU_ORDER = ['A', '2', '5'];
function puEmblem(type, n){
  if (type === 'A') return `<svg class="pu-emb" viewBox="0 0 40 40" aria-hidden="true"><defs><radialGradient id="puGA" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6d2"/><stop offset=".45" stop-color="#f5d98c"/><stop offset="1" stop-color="#a87d28"/></radialGradient></defs>
    <circle cx="20" cy="20" r="18" fill="url(#puGA)" stroke="#6b4c12" stroke-width="1.2"/><circle cx="20" cy="20" r="14.6" fill="none" stroke="#6b4c12" stroke-opacity=".5" stroke-dasharray="1.6 2.1"/>
    <text x="20" y="25.4" text-anchor="middle" font-family="Figtree, system-ui, sans-serif" font-weight="800" font-size="15" fill="#3a2704">+${n}</text></svg>`;
  if (type === '2') return `<svg class="pu-emb" viewBox="0 0 40 40" aria-hidden="true"><defs><clipPath id="puC2"><circle cx="20" cy="20" r="18"/></clipPath></defs>
    <g clip-path="url(#puC2)"><rect width="40" height="40" fill="#23262f"/><path d="M0 0H40L0 40Z" fill="#c3303b"/></g>
    <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>
    <use href="#su-H" x="6.5" y="7" width="12.5" height="12.5" style="color:#fff3f3"/><use href="#su-S" x="21" y="21" width="12.5" height="12.5" style="color:#f3ead5"/></svg>`;
  return `<svg class="pu-emb" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#174d47" stroke="#6fd3c1" stroke-width="1.2"/>
    <rect x="10.5" y="9.5" width="13.5" height="19" rx="2.2" fill="rgba(191,243,234,.12)" stroke="#bff3ea" stroke-width="1.5" stroke-dasharray="2.6 2"/>
    <circle cx="27" cy="26.5" r="7" fill="#6fd3c1" stroke="#174d47" stroke-width="1.5"/><path d="M27 23v7M23.5 26.5h7" stroke="#0f2f2b" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
function renderPowers(){
  const el = $('powers');
  if (!S.powerups.length){ setHTML(el, ''); el.hidden = true; ui.pupPrev = {}; return; }
  el.hidden = false;
  const counts = {}; S.powerups.forEach(p => counts[p.type] = (counts[p.type] || 0) + 1);
  const prev = ui.pupPrev || {};
  const can = S.phase === 'idle' || S.phase === 'decide';
  setHTML(el, PU_ORDER.filter(t => counts[t]).map(t => {
    const n = counts[t], P = Object.values(POWER).find(x => x.type === t);
    const eff = t === 'A' ? `+${n} to every multiplier` : t === '2' ? 'Red & black count as suits' : `+${n} hand seat${n > 1 ? 's' : ''}`;
    return `<div class="pu pu-${t} ${n > (prev[t] || 0) ? 'pop' : ''}" data-type="${t}">
      ${puEmblem(t, n)}
      <div class="pu-body"><div class="pu-name">${P.name}${n > 1 ? `<span class="pu-n">×${n}</span>` : ''}</div><div class="pu-eff">${eff}</div></div>
      <div class="pu-up" title="Upkeep: paid each time a new card is dealt"><span>${coin}${P.cost * n}</span><small>per card</small></div>
      <button class="x" data-act="release" data-type="${t}" ${can ? '' : 'disabled'} aria-label="Release one ${P.name}" title="Release one (stop paying its upkeep)">✕</button></div>`;
  }).join(''));
  ui.pupPrev = counts;
}

function renderHand(){
  const cap = capacity();
  const on = k => prefs.sort === k ? 'true' : 'false';
  const note = S.phase === 'trim' ? `<div class="hnote">Too many cards for your seats: tap one to discard (+${fmt(S.bet)} debt)</div>`
    : S.phase === 'swapPlace' ? `<div class="hnote">Tap the card that ${cardName(S.swapCard)} should replace</div>` : '';
  setHTML($('handhead'), `${note || `<div class="lbl">Hand · <b>${S.hand.length}</b> of <b>${cap}</b> seats</div>`}
    <div class="seg" role="group" aria-label="Sort hand">
      <button data-act="sortRank" aria-pressed="${on('rank')}" title="Sort by rank"><span class="ico rk"><i></i><i></i><i></i></span>Rank</button>
      <button data-act="sortSuit" aria-pressed="${on('suit')}" title="Sort by suit"><span class="ico st">${suitSVG('S')}${suitSVG('H')}</span>Suit</button>
    </div>`);
  const ev = evaluate(S.hand.filter(c => !S.faceDown.includes(c.id)), S.powerups);
  const hot = new Set(ev.combos.flatMap(c => c.ids));
  const picking = S.phase === 'decide' || S.phase === 'trim' || S.phase === 'swapPlace';
  let keyN = 0;
  const html = sortedHand().map(c => {
    if (S.faceDown.includes(c.id)) return cardHTML(c, { back:true, extra: ui.seen.has(c.id) ? '' : 'enter' }).replace('class="card', `data-fd="${c.id}" class="card`);
    const armed = ui.armed === c.id;
    const extra = [hot.has(c.id) ? 'hot' : '', picking ? 'pick' : '', armed ? 'armed' : ''].join(' ');
    let tag = '';
    if (armed){
      tag = `Tap again · +${fmt(S.bet)} debt`;
    }
    const dragX = S.phase === 'decide' || S.phase === 'swapPlace' ? ' drag' : '';
    let out = cardHTML(c, { extra: extra + dragX, act: picking ? 'handPick' : null, tag });
    if (picking && keyN < 9) out = out.replace(/<\/div>$/, `<kbd class="kc" aria-hidden="true">${++keyN}</kbd></div>`);
    // on hover (mouse), show what swapping this card in would score
    if (S.phase === 'decide') out = out.replace(/<\/div>$/, `<span class="tag ok peek">swap → ×${fmt(swapMult(c.id))}</span></div>`);
    return out;
  });
  for (let i = S.hand.length; i < cap; i++) html.push(`<div class="emptyslot">Open seat</div>`);
  $('hand').style.setProperty('--n', Math.max(cap, S.hand.length));
  setHTML($('hand'), html.join(''));
}

function renderValue(){
  const visible = S.hand.filter(c => !S.faceDown.includes(c.id));
  const ev = evaluate(visible, S.powerups);
  const chips = ev.combos.length
    ? ev.combos.map(c => `<span class="combo">${c.label}${c.note ? ` <small>(${c.note})</small>` : ''}<em>×${fmt(c.factor)}</em></span>`).join('')
    : `<span class="none">${S.phase === 'bet' ? 'No combos among your face-up cards yet.' : 'No pair, straight or flush yet. Cashing out now pays nothing.'}</span>`;
  let tip = '';
  const pv = S.phase === 'decide' ? swapPreview() : null;
  if (pv){
    if (pv.best.mult > pv.base)
      tip = `<button class="combo tip" data-act="bestSwap" data-id="${pv.best.out.id}">Swap ${cardName(pv.best.out)} for ${cardName(S.pending)} <em>→ ×${fmt(pv.best.mult)}</em></button>`;
  }
  const boostNote = (ev.boost || ev.twoTone) ? `<span class="combo" style="background:transparent">${[ev.boost ? `Ace boost +${ev.boost}` : '', ev.twoTone ? 'Two-tone on' : ''].filter(Boolean).join(' · ')}</span>` : '';
  const b = S.phase === 'bet' ? Math.max(1, Math.min(S.betInput, S.coins)) : S.bet;
  const sub = `Payout: bet ${fmt(b)} × ${fmt(ev.mult)} = <b>${fmt(b * ev.mult)}</b>`;
  setHTML($('value'), `<div class="combos">${chips}${boostNote}${tip}</div>
    <div class="mult"><div class="big ${ev.mult ? '' : 'zero'}" id="multBig">×${fmt(ev.mult)}</div><div class="sub">${sub}</div></div>`);
  if (ui.lastMult !== undefined && ui.lastMult !== ev.mult) rollMult($('multBig'), ui.lastMult, ev.mult);
  ui.lastMult = ev.mult;
}

function renderDock(){
  const d = $('dock');
  const cap = capacity();
  let rows = '';
  const cashBtn = () => {
    const ev = evaluate(S.hand, S.powerups);
    const after = S.coins + S.bet * ev.mult - S.debt;
    const start = S.handStart ?? (S.coins + S.bet);
    const net = after - start;
    const what = after < 0 ? `game over · short ${fmt(-after)}` : net > 0 ? `win ${fmt(net)}` : net < 0 ? `lose ${fmt(-net)}` : 'break even';
    return `<button class="btn cash grow ${after < 0 ? 'bust' : net < 0 ? 'down' : ''}" data-act="cash">Cash out <span class="cashnet">${what}</span>${kbd('C')}</button>`;
  };
  switch (S.phase){
    case 'bet': {
      const b = Math.max(1, Math.min(S.betInput, S.coins));
      const pre = [['last', 'Last', S.lastBet], ['q', '¼', Math.floor(S.coins / 4)], ['h', '½', Math.floor(S.coins / 2)], ['max', 'Max', S.coins]]
        .filter(([k, , v]) => v >= 1 && (k !== 'last' || v <= S.coins));
      rows = `<div class="row">
        <div class="betbox">
          <button class="step" data-act="betKey" data-hold="-1" aria-label="Lower bet" ${b <= 1 ? 'disabled' : ''}>−</button>
          <label class="val">${coin}<input id="betNum" type="number" inputmode="numeric" min="1" max="${S.coins}" step="1" value="${b}" aria-label="Bet amount"></label>
          <button class="step" data-act="betKey" data-hold="1" aria-label="Raise bet" ${b >= S.coins ? 'disabled' : ''}>+</button>
          <input type="range" id="betRange" min="0" max="${RN}" step="1" value="${betToPos(b)}" aria-label="Bet slider" ${S.coins <= 1 ? 'disabled' : ''}>
          <div class="presets" role="group" aria-label="Quick bets">${pre.map(([k, l, v]) => `<button class="q" data-act="preset" data-v="${v}" aria-pressed="${b === v}">${l} <b>${fmt(v)}</b></button>`).join('')}</div>
        </div></div>
        <div class="row">
          <button class="btn grow" data-act="throw">Throw away <small>free</small>${kbd('T')}</button>
          <button class="btn gold grow" data-act="deal"><span id="dealBtn">Deal · bet ${fmt(b)}</span>${kbd('D')}</button>
        </div>`;
      break;
    }
    case 'decide': {
      const c = S.pending, full = S.hand.length >= cap, dealt = offerIsDealt(), P = dealt ? POWER[c.rank] : null;
      const more = canDraw(), up = upkeep();
      const discCost = [(!S.pendingCharged || (more && full)) ? `+${fmt(S.bet)} debt` : '', more && up ? `upkeep ${up}` : ''].filter(Boolean).join(' · ');
      const refund = S.pendingCharged ? ` · debt −${fmt(S.bet)}` : '';
      let btns = '';
      btns += `<button class="btn warn grow" data-act="discard">${more ? 'Discard &amp; deal next' : 'Discard'}${discCost ? ` <small>${discCost}</small>` : ''}${kbd('D')}</button>`;
      if (P){
        const dup = P.type === '2' && S.powerups.some(x => x.type === '2');
        btns += dup
          ? `<button class="btn power grow" disabled title="A second Two-tone would have no effect">${P.name} <small>already active</small></button>`
          : `<button class="btn power grow" data-act="power" ${S.coins < P.cost ? 'disabled' : ''}>${P.name} <small>${coin}${P.cost} · ${P.short}${refund}</small>${kbd('P')}</button>`;
      }
      if (dealt && c.rank === 10) btns += `<button class="btn power grow" data-act="swap" ${S.coins < SWAP_COST || !S.discard.length ? 'disabled' : ''} title="${!S.discard.length ? 'The discard pile is empty' : ''}">Swap from discard <small>${coin}${SWAP_COST}${refund}</small>${kbd('W')}</button>`;
      rows = `<div class="row">${btns}</div><div class="row">${cashBtn()}</div>`;
      break;
    }
    case 'idle': {
      const up = upkeep(), dl = S.deck.length;
      const why = !dl ? 'The deck is empty' : S.coins < up ? `Upkeep is ${up}: release a power-up to deal` : '';
      const nextCost = [S.hand.length >= cap ? `+${fmt(S.bet)} debt` : '', up ? `upkeep ${up}` : ''].filter(Boolean).join(' · ');
      rows = `<div class="row">
        <button class="btn gold grow" data-act="next" ${!dl || S.coins < up ? 'disabled' : ''}>${dl ? 'Deal next card' : 'Deck empty'}${why ? ` <small>${why}</small>` : dl && nextCost ? ` <small>${nextCost}</small>` : ''}${kbd('N')}</button>
        ${cashBtn()}</div>`;
      break;
    }
    case 'swapPick':
      rows = `<div class="row"><button class="btn grow" data-act="openPick">Show discard pile</button><button class="btn grow" data-act="cancelSwap">Cancel · refund ${SWAP_COST}</button></div>`;
      break;
    case 'swapPlace':
      rows = `<div class="row"><button class="btn grow" data-act="cancelSwap">Pick a different card</button></div>`;
      break;
    case 'trim':
      break;
    case 'result':
      rows = `<div class="row"><button class="btn gold grow" data-act="nextSet">Next hand${kbd('Enter')}</button></div>`; break;
    case 'reshuffle':
      rows = `<div class="row"><button class="btn gold grow" data-act="openReshuffle">Level ${lvl()} complete · continue</button></div>`; break;
    case 'over':
      rows = `<div class="row"><button class="btn gold grow" data-act="restartNow">Play again</button></div>`; break;
  }
  setHTML(d, rows);
}

function renderModal(){
  const root = $('modalRoot');
  const m = ui.modal;
  if (!m){
    if (ui.modalShown){ ui.modalShown = null; setHTML(root, ''); if (ui.lastFocus && ui.lastFocus.isConnected) ui.lastFocus.focus({ preventScroll:true }); }
    return;
  }
  let html = '';
  if (m === 'help') html = helpHTML();
  else if (m === 'result') html = resultHTML();
  else if (m === 'over') html = overHTML();
  else if (m === 'reshuffle'){
    const L = lvl(), price = levelPrice(L);
    html = `<div class="rs-head win">
        <div class="rs-eyebrow">Level ${L} complete</div>
        <div class="lv-medal"><span>Level</span><b>${L + 1}</b></div>
        <div class="rs-verdict">You made it through the deck</div>
      </div>
      <p class="rs-sum">Pay the level price to shuffle all 54 cards back in and start level ${L + 1}.</p>
      <div class="receipt"><div><span>Your coins</span><b>${fmt(S.coins)}</b></div><div><span>Level ${L} price</span><b class="neg">−${fmt(price)}</b></div><div class="tot"><span>You start level ${L + 1} with</span><b>${fmt(S.coins - price)}</b></div></div>
      <p class="rs-note">Finishing level ${L + 1} will cost ${fmt(levelPrice(L + 1))}.</p>
      <div class="actions"><button class="btn gold grow" data-act="reshuffle">Pay ${fmt(price)} · start level ${L + 1}</button></div>`;
  }
  else if (m === 'tracker') html = trackerHTML();
  else if (m === 'history') html = historyHTML();
  else if (m === 'settings') html = settingsHTML();
  else if (m === 'bust') html = bustHTML();
  else if (m === 'restart') html = `<h2>Start a new game?</h2><p class="lead">Your current run (${fmt(S.coins)} coins, level ${lvl()}) will be lost.</p>
    <div class="actions"><button class="btn" data-act="close">Keep playing</button><button class="btn gold" data-act="restartNow">New game</button></div>`;
  else if (m === 'pick' || m === 'view'){
    const picking = m === 'pick';
    html = `<h2>${picking ? 'Take a card back' : 'Discard pile'}</h2>
      <p class="lead">${picking ? `Your 10 paid the ${SWAP_COST}-coin fee. Pick any card below.` : 'Cards discarded this hand. They move out of play when you cash out.'}</p>
      <div class="pickgrid">${S.discard.slice().reverse().map(c => {
        const used = picking && S.swapTen && c.id === S.swapTen.id;
        return cardHTML(c, { track:false, act: picking && !used ? 'pickDiscard' : null, extra: used ? 'used' : '' });
      }).join('')}</div>
      <div class="actions">${picking ? `<button class="btn" data-act="cancelSwap">Cancel · refund ${SWAP_COST}</button>` : `<button class="btn gold" data-act="close">Close</button>`}</div>`;
  }
  const closable = CLOSABLE.includes(m);
  const opened = ui.modalShown !== m;
  if (opened && !ui.modalShown) ui.lastFocus = document.activeElement;
  setHTML(root, `<div class="scrim" data-act="${closable ? 'scrimClose' : ''}"><div class="modal ${m === 'result' || m === 'over' || m === 'bust' || m === 'reshuffle' ? 'm-result' : ''} m-${m}" role="dialog" aria-modal="true" aria-label="${MODAL_NAMES[m] || 'Dialog'}">${html}</div></div>`);
  ui.modalShown = m;
  if (opened){
    const f = root.querySelector('.modal .btn.gold, .modal [data-act]:not([data-act="scrimClose"]), .modal button, .modal input');
    if (f) setTimeout(() => f.focus({ preventScroll:true }), 30);
  }
}

const CLOSABLE = ['help', 'view', 'tracker', 'history', 'settings', 'bust', 'restart'];
const MODAL_NAMES = { help:'How to play', result:'Hand result', over:'Run over', reshuffle:'Level complete', tracker:'Card tracker', view:'Discard pile', pick:'Take a card back', history:'History', settings:'Settings', bust:'Cash-out warning', restart:'New game' };
function bustHTML(){
  const ev = evaluate(S.hand, S.powerups), payout = S.bet * ev.mult, after = S.coins + payout - S.debt;
  return `<div class="rs-head loss"><div class="rs-eyebrow">Careful</div><div class="rs-verdict">This cash-out ends your run</div>
      <div class="rs-net"><b>${signed(after)}</b><span>coins after</span></div></div>
    <p class="rs-sum">Your coins (${fmt(S.coins)}) plus the payout (${fmt(payout)}) don't cover your debt of ${fmt(S.debt)}. You would be short <b>${fmt(-after)}</b> and the run would end.</p>
    <div class="actions"><button class="btn" data-act="close">Keep playing</button><button class="btn warn" data-act="bustConfirm">Cash out and end the run</button></div>`;
}

function trackerHTML(){
  const where = {};
  S.throwaway.forEach(c => where[c.id] = 'out');
  S.discard.forEach(c => where[c.id] = 'disc');
  S.hand.forEach(c => { if (!S.faceDown.includes(c.id)) where[c.id] = 'play'; });
  S.powerups.forEach(p => where[p.card.id] = 'play');
  [S.pending, S.swapCard].forEach(c => { if (c) where[c.id] = 'play'; });
  // the deck holds one copy of each card; face-down cards stay unknown
  const all = S.deck.concat(S.hand, S.discard, S.throwaway, S.powerups.map(p => p.card), [S.pending, S.swapCard].filter(Boolean));
  const key = c => c.suit + c.rank;
  const status = {}; all.forEach(c => status[key(c)] = where[c.id] || 'deck');
  const count = st => Object.values(status).filter(v => v === st).length;
  const order = [1,2,3,4,5,6,7,8,9,10,11,12,13];
  const rows = ['S','H','D','C'].map(su => {
    const left = order.filter(r => status[su + r] === 'deck').length;
    return `<div class="sl ${SUITS[su].red ? 'r' : ''}" title="${SUITS[su].name}">${suitSVG(su)}<small>${left}</small></div>` +
      order.map(r => `<div class="tc s-${status[su + r] || 'deck'} ${SUITS[su].red ? 'red' : ''}" title="${RANKS[r]}${SUITS[su].sym}">${RANKS[r]}</div>`).join('');
  }).join('');
  const jk = [['JR','Red'],['JB','Black']].map(([k, n]) => `<div class="tc s-${status[k + 0]} ${k === 'JR' ? 'red' : ''}" title="${n} Joker">★</div>`).join('');
  return `<h2>Card tracker</h2>
    <p class="lead">Where every card in this deck is right now. <b>${count('deck')}</b> cards haven’t been seen yet.</p>
    <div class="tlegend">
      <span><i class="k-deck"></i>Not seen yet <b>${count('deck')}</b></span>
      <span><i class="k-play"></i>In play <b>${count('play')}</b></span>
      <span><i class="k-disc"></i>Discard pile <b>${count('disc')}</b></span>
      <span><i class="k-out"></i>Out <b>${count('out')}</b></span>
    </div>
    <div class="tgrid">${rows}</div>
    <div class="tjok"><div class="sl" style="width:24px;font-size:12px;color:var(--muted);font-weight:800">JKR</div>${jk}</div>
    <div class="actions"><button class="btn gold" data-act="close">Close</button></div>`;
}

function comboLines(ev){
  if (!ev.combos.length) return `<div><span>No combos</span><b>×0</b></div>`;
  return ev.combos.map(c => `<div><span>${c.label}${c.note ? ` (${c.note})` : ''}</span><b>×${fmt(c.factor)}</b></div>`).join('');
}
function handBody(r){
  const L = r.ledger || {};
  const hot = new Set(r.ev.combos.flatMap(c => c.ids));
  const cards = r.hand.map(c => cardHTML(c, { track:false, extra: r.ev.combos.length ? (hot.has(c.id) ? 'hit' : 'dim') : '' })).join('');
  const eq = r.ev.combos.length
    ? r.ev.combos.map(c => `<span class="combo">${c.label}<em>×${fmt(c.factor)}</em></span>`).join('<span class="op">×</span>') + `<span class="op">=</span><span class="tot">×${fmt(r.ev.mult)}</span>`
    : `<span class="combo">No pair, straight or flush</span><span class="op">=</span><span class="tot zero">×0</span>`;
  const boosts = [r.ev.boost ? `Ace boost +${r.ev.boost} on every multiplier` : '', r.ev.twoTone ? 'Two-tone flushes' : ''].filter(Boolean).join(' · ');
  const lines = [
    { k:'Payout', d: r.ev.mult ? `bet ${fmt(r.bet)} × ${fmt(r.ev.mult)}` : 'nothing scored', v: r.payout, show:true },
    { k:'Your bet', d:'', v: L.bet ?? -r.bet, show:true },
    { k:'Discard debt', d: r.discards ? `${r.discards} card${r.discards === 1 ? '' : 's'} × ${fmt(r.bet)}` : '', v: L.debt ?? -r.debt, show: !!r.debt },
    { k:'Power-up upkeep', d:'', v: L.upkeep || 0 },
    { k:'Power-ups bought', d:'', v: L['power-up'] || 0 },
    { k:'10-swap fee', d:'', v: L['10 swap'] || 0 },
  ].filter(l => l.show || l.v);
  const won = lines.filter(l => l.v > 0).reduce((a, l) => a + l.v, 0);
  const spent = -lines.filter(l => l.v < 0).reduce((a, l) => a + l.v, 0);
  const scale = Math.max(won, spent, 1);
  const net = won - spent;
  return `
    <div class="minihand rs-hand">${cards}</div>
    <div class="rs-eq">${eq}</div>
    ${boosts ? `<p class="rs-note">${boosts}</p>` : ''}
    <div class="rs-bars">
      <span>Won</span><div class="trk won"><i style="width:${(won / scale * 100).toFixed(1)}%"></i></div><b class="pos">+${fmt(won)}</b>
      <span>Spent</span><div class="trk spent"><i style="width:${(spent / scale * 100).toFixed(1)}%"></i></div><b class="neg">−${fmt(spent)}</b>
    </div>
    <div class="rs-lines">
      ${lines.map(l => `<div class="rs-line ${l.v > 0 ? 'plus' : l.v < 0 ? 'minus' : ''}"><i class="dot"></i><span>${l.k}${l.d ? `<small>${l.d}</small>` : ''}</span><b>${signed(l.v)}</b></div>`).join('')}
      <div class="rs-line total"><i></i><span>${net >= 0 ? 'Gained this hand' : 'Lost this hand'}</span><b class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${signed(net)}</b></div>
    </div>`;
}
function resultHTML(){
  const r = S.result; if (!r) return '';
  const net = r.net ?? (r.payout - r.debt - r.bet);
  const mood = net > 0 ? 'win' : net < 0 ? 'loss' : 'even';
  const verdict = net > 0 ? (net >= r.bet * 5 ? 'Big win' : 'Profit') : net < 0 ? 'Loss' : 'Broke even';
  const names = r.ev.combos.map(c => c.label).join(' + ');
  const L = r.ledger || {};
  const parts = [[-(L.debt || 0), 'discards'], [-((L.upkeep || 0) + (L['power-up'] || 0)), 'power-ups'], [-(L['10 swap'] || 0), 'the 10-swap']].filter(([v]) => v > 0);
  const costs = parts.reduce((a, [v]) => a + v, 0);
  const costWho = parts.map(([, n]) => n).join(parts.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1');
  const sum = r.ev.mult
    ? `${names} paid <b>×${fmt(r.ev.mult)}</b> on your bet of ${fmt(r.bet)}, so the hand paid out <b>${fmt(r.payout)}</b>.`
    : `Nothing scored, so your bet of ${fmt(r.bet)} paid nothing.`;
  const sum2 = costs ? ` ${costWho[0].toUpperCase() + costWho.slice(1)} cost you <b>${fmt(costs)}</b>.` : '';
  return `<div class="rs-head ${mood}">
      <div class="rs-eyebrow">Hand ${r.handNo || ''} · cashed out</div>
      <div class="rs-verdict">${verdict}</div>
      <div class="rs-net"><b data-to="${net}">${signed(net)}</b><span>coins</span></div>
      <div class="rs-flow">${coin}${fmt(r.start)} <span class="arr">→</span> ${coin}${fmt(r.total)}</div>
    </div>
    <p class="rs-sum">${sum}${sum2}</p>
    ${handBody(r)}
    <div class="actions rs-actions"><span class="rs-deck">${r.deckLeft} cards left in the deck</span><button class="btn gold" data-act="nextSet">Next hand</button></div>`;
}
function overHTML(){
  const o = S.over || {}, r = o.res, st = S.stats;
  const run = o.run || { level:lvl(), biggestWin:st.biggestWin || 0, biggestLoss:st.biggestLoss || 0, peak:st.peak, bestPayout:st.bestPayout, hands:st.cashouts };
  const rec = prefs.record || run, isNew = o.isNew || {};
  const tiles = [
    ['level', 'Level reached', v => fmt(v)],
    ['hands', 'Hands played', v => fmt(v)],
    ['biggestWin', 'Biggest win', v => v ? '+' + fmt(v) : '—'],
    ['biggestLoss', 'Biggest loss', v => v ? '−' + fmt(v) : '—'],
    ['peak', 'Most coins', v => fmt(v)],
    ['bestPayout', 'Best payout', v => fmt(v)],
  ];
  const grid = (src, mark) => `<div class="tiles">${tiles.map(([k, label, f]) =>
    `<div class="tile ${mark && isNew[k] ? 'new' : ''} ${k === 'biggestWin' ? 'pos' : k === 'biggestLoss' ? 'neg' : ''}"><span>${label}</span><b>${f(src[k] || 0)}</b>${mark && isNew[k] && !o.firstRun ? '<i>New best</i>' : ''}</div>`).join('')}</div>`;
  const newCount = Object.keys(isNew).length;
  return `<div class="rs-head loss">
      <div class="rs-eyebrow">Run over</div>
      <div class="lv-medal dim"><span>Level</span><b>${run.level}</b></div>
      <div class="rs-verdict">${newCount && !o.firstRun ? `${newCount} new personal best${newCount > 1 ? 's' : ''}!` : 'Your run has ended'}</div>
    </div>
    <p class="rs-sum">${o.reason || ''}</p>
    ${r ? `<div class="rs-short"><span>Short by</span><b>${fmt(-r.total)}</b><span>coins</span></div>${handBody(r)}` : ''}
    <h3>This run</h3>
    ${grid(run, true)}
    <h3>Your best · ${fmt(rec.runs || 1)} run${(rec.runs || 1) === 1 ? '' : 's'}</h3>
    ${grid(rec, false)}
    <p class="snote">Run seed <code class="seed">${S.seed}</code>. Replay these exact cards from Settings.</p>
    <div class="actions">${leaderboardAvailable() ? `<button class="btn" data-act="openBoard">Leaderboard</button>` : ''}<button class="btn" data-act="replaySeed">Replay this seed</button><button class="btn gold grow" data-act="restartNow">Play again</button></div>`;
}
function helpHTML(){
  return `<h2>How to play</h2>
    <p class="lead">Build a paying hand from a 54-card deck, then cash out before your discards cost more than the hand is worth. You start with ${START_COINS} coins.</p>
    <h3>A hand</h3>
    <ul>
      <li>You get 5 cards: 3 face up, 2 face down. <b>Throw away</b> is free before you bet: the five leave play and five new ones arrive.</li>
      <li>Set a bet (up to all your coins) and press <b>Deal</b>. The bet leaves your coins, the hidden cards flip, and a new card is dealt.</li>
      <li>When your hand is full, <b>each new card adds your bet to your debt</b> as soon as it's dealt. It sits in the center of the table.</li>
      <li>Tap a hand card, or drag it up to the table, to swap it with the center card. Swapping is free and you can do it as often as you like. <b>Discard</b> throws away whatever card is in the center and deals the next one.</li>
      <li>If you have an open seat, the new card goes straight into your hand for free. Using the freshly dealt card as a power-up or for the 10-swap refunds its debt.</li>
      <li>Tap the deck to see which cards have already left play. The history button shows your hands and coins over the run.</li>
      <li>On a keyboard: 1–9 swap a card, D discard or deal, C cash out, N next card, T throw away, P power-up, W 10-swap, ↑↓ change the bet.</li>
      <li>Cash out at any point. You get <b>bet × multiplier</b>, minus the debt. If that leaves you below zero, the game is over.</li>
    </ul>
    <h3>Multipliers (they multiply together)</h3>
    <div class="paytable">
      <b>×2</b><span>each pair. Three of a kind is 2 pairs (×4), four of a kind is 3 pairs (×8)</span>
      <b>×5</b><span>each straight: 5 ranks in a row. Ace can be low or high. A 6-card run counts as two straights</span>
      <b>×5</b><span>flush: 5 or more cards of one suit</span>
      <b>×0</b><span>no combo: the bet is lost</span>
    </div>
    <p>Example: a flush with a pair in it pays ×10. Two pairs pay ×4.</p>
    <h3>Special cards</h3>
    <ul>
      <li><b>Joker</b> goes straight to your hand and adds a seat (hand size +1). Swap it out later like any card. A Joker in your starting hand means the first dealt card joins for free.</li>
      <li><b>Ace boost</b> (buy an Ace for 1): +1 to every multiplier, so a pair is ×3 and a flush ×6.</li>
      <li><b>Two-tone</b> (buy a 2 for 2): suits merge into red and black, and the Jokers count toward the flush of their colour.</li>
      <li><b>Extra seat</b> (buy a 5 for 5): hand size +1, and the next card is dealt straight into that seat. If you release it with a full hand, you must discard a card.</li>
      <li>Two-tone doesn't stack: once it's active, a second 2 can't be bought.</li>
      <li>Buying a power-up deals the next card at once, with no upkeep for that power-up on that card. After that, power-ups stack and each one charges its price again every time you deal a new card. Release one with ✕ to stop paying. All of them leave play when you cash out.</li>
      <li><b>10 swap</b>: discard a dealt 10 and pay 10 to take any card from the discard pile into your hand. No debt for this swap.</li>
    </ul>
    <h3>The deck</h3>
    <p>Cashed-out and thrown-away cards leave play. One trip through the deck is a <b>level</b>. When the deck can't fill a new hand, pay the level price to reshuffle all 54 cards and move up a level, or the run ends. Prices go 100, 200, 500, 1,000, 2,000, 5,000 and so on.</p>
    <p>When a run ends, your best record (highest level, biggest win and loss, most coins) is saved in this browser. Higher levels unlock new card backs and table felts in Settings.</p>
    <div class="actions"><button class="btn" data-act="replayTutorial">Replay the tutorial</button><button class="btn gold" data-act="close">Got it</button></div>`;
}

function render(){
  renderLedger(); renderPit(); renderPowers(); renderHand(); renderValue(); renderDock(); renderModal();
  const netEl = document.querySelector('#modalRoot .rs-net b[data-to]');
  if (netEl && ui.counted !== S.stats.cashouts){ ui.counted = S.stats.cashouts; countUp(netEl, +netEl.dataset.to); }
  // remember which cards are already on screen so only new ones animate
  document.querySelectorAll('#app .card[aria-label]').forEach(el => {
    const id = el.getAttribute('data-id') || el.getAttribute('data-fd');
    if (id) ui.seen.add(id);
  });
  S.hand.forEach(c => ui.seen.add(c.id)); if (S.pending) ui.seen.add(S.pending.id);
  S.discard.forEach(c => ui.seen.add(c.id)); S.powerups.forEach(p => ui.seen.add(p.card.id));
  ui.flips.clear();
  if (ui.prev){
    const dd = S.debt - ui.prev.debt;
    if (dd) floatDelta('st-debt', (dd > 0 ? '+' : '−') + fmt(Math.abs(dd)), dd > 0 ? 'debt-up' : 'debt-down', dd > 0 ? 'hit' : 'bump');
    (ui.coinEv || []).forEach((e, i) => setTimeout(() =>
      floatDelta('st-coins', (e.d > 0 ? '+' : '−') + fmt(Math.abs(e.d)) + ' ' + e.label, e.d > 0 ? 'coin-up' : 'coin-down', e.d > 0 ? 'bump' : 'hit'), i * 380));
  }
  ui.prev = { debt:S.debt, coins:S.coins }; ui.coinEv = [];
  if (ui.flies.length){ const fs = ui.flies; ui.flies = []; requestAnimationFrame(() => fs.forEach((f, i) => setTimeout(() => runFly(f), i * 260))); }
  if (ui.swapFx){ const f = ui.swapFx; ui.swapFx = null; runSwapFx(f); }
  if (ui.dealFx){ const id = ui.dealFx; ui.dealFx = null; requestAnimationFrame(() => runDealFx(id)); }
  if (ui.shuffleFx){ ui.shuffleFx = false; setTimeout(() => { const d = document.querySelector('#pit .stack'); if (d) d.classList.remove('shuffling'); $('pit').__html = null; }, dur(1100)); }
  if (ui.celebrate){ ui.celebrate = false; setTimeout(celebrate, dur(250)); }
  if (ui.shake){ ui.shake = false; shakeApp(); }
  if (ui.say){ announce(ui.say); ui.say = null; }
  scheduleComboLinks();
  tutorialTick();
  store(SAVE_KEY, S);
}

