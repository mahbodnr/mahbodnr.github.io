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
// Line icons for the controls (24×24, drawn with the text colour)
const ICON = {
  deal:'<rect x="3.5" y="5.5" width="10" height="14" rx="1.8" transform="rotate(-9 8.5 12.5)"/><rect x="10" y="4" width="10" height="14" rx="1.8" transform="rotate(7 15 11)"/>',
  throw:'<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4.5V9h-4.5"/>',
  discard:'<rect x="4" y="4" width="11" height="15" rx="1.8"/><path d="M13 12h8M18 9l3 3-3 3"/>',
  next:'<rect x="3.5" y="4" width="11" height="15" rx="1.8"/><path d="M19.5 8.5v7M16 12h7"/>',
  cash:'<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5"/><path d="M5 11.5v5c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-5"/>',
  power:'<path d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z"/>',
  back:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  cancel:'<path d="M6 6l12 12M18 6 6 18"/>',
  pile:'<rect x="5" y="7" width="11" height="14" rx="1.8"/><path d="M8 4h9.2A1.8 1.8 0 0 1 19 5.8V18"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  replay:'<path d="M4 12a8 8 0 1 0 2.35-5.65"/><path d="M4 4.5V9h4.5"/>',
};
const ico = n => `<svg class="bi" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
// a control's label: a main line and, when given, a smaller second line
const bl = (main, sub) => `<span class="bl"><b>${main}</b>${sub ? `<small>${sub}</small>` : ''}</span>`;

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
    <div class="stat" id="st-coins"><div class="k">Coins</div><div class="v">${coin}<span class="num">${fmt(S.coins)}</span></div></div>
    <div class="stat"><div class="k">Bet</div><div class="v">${S.bet ? fmt(S.bet) : '—'}</div></div>
    <div class="stat debt ${S.debt ? '' : 'zero'}" id="st-debt"><div class="k">Debt</div><div class="v">${fmt(S.debt)}</div></div>
    <div class="stat" id="st-level"><div class="k">Level</div><div class="v">${lvl()}</div></div>`);
  const L = lvl(), price = levelPrice(L), used = 54 - S.deck.length, need = price - S.coins;
  // progress toward the next level's price: coins against the price, and what's still missing (or to spare)
  const ok = need <= 0, pct = Math.max(0, Math.min(100, S.coins / price * 100));
  setHTML($('levelbar'), `
    <div class="lv-goal ${ok ? 'ok' : ''}" role="meter" aria-label="Coins toward level ${L + 1}" aria-valuemin="0" aria-valuemax="${price}" aria-valuenow="${Math.max(0, Math.min(S.coins, price))}"
      title="${ok ? `You can pay for level ${L + 1}, with ${fmt(-need)} to spare` : `${fmt(need)} more coins needed for level ${L + 1}`}">
      <span class="lv-tag">Level ${L + 1}</span>
      <div class="lv-track"><i style="width:${pct.toFixed(1)}%"></i>
        <span class="lv-nums">${coin}<b>${fmt(Math.max(0, S.coins))}</b><span class="of">/ ${fmt(price)}</span></span>
        <svg class="lv-flag" viewBox="0 0 24 24" aria-hidden="true">${ok ? '<path d="M5 12.5l4.2 4.2L19 7"/>' : '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'}</svg>
      </div>
      <span class="lv-need">${ok ? `<b>+${fmt(-need)}</b> spare` : `<b>${fmt(need)}</b> to go`}</span>
    </div>`);
  if (ui.levelUp){ ui.levelUp = false; floatDelta('st-level', 'LEVEL UP', 'coin-up', 'bump'); }
}

function renderPit(){
  const dl = S.deck.length;
  // the bottom card's edge shadows show the deck's depth: thicker when full, thinner as it runs down
  const depth = Math.min(7, Math.ceil(dl / 8)), edges = Array.from({ length: depth }, (_, i) => `${-(i + 1) * 1.1}px ${(i + 1) * 1.1}px 0 ${i % 2 ? '#d8ceb3' : '#efe6cf'}`);
  const under = cardHTML(null, { back:true, style: dl > 2 ? `box-shadow:${edges.concat('-3px 6px 14px rgba(0,0,0,.45)').join(',')}` : '' });
  const deck = dl
    ? `<div class="stack deck ${ui.shuffleFx ? 'shuffling' : ''}">${dl > 2 ? under : ''}${dl > 1 ? cardHTML(null, { back:true }) : ''}${cardHTML(null, { back:true })}</div>`
    : `<div class="emptyslot"></div>`;
  let spot;
  if (S.pending) spot = cardHTML(S.pending, { extra:'hot' });
  else if (S.phase === 'swapPlace' && S.swapCard) spot = cardHTML(S.swapCard, { extra:'hot' });
  else {
    spot = `<div class="emptyslot"></div>`;
  }
  const spotLbl = S.phase === 'swapPlace' ? 'From discard' : S.pending && S.pending.id !== S.dealtId ? 'Center' : 'New card';
  const top = S.discard.slice(-3);
  const dis = top.length
    ? top.map((c, i) => cardHTML(c, { track:false }).replace('class="card', `style="left:${i * 14}px;transform:rotate(${(i - 1) * 6}deg)" class="card`)).join('')
    : `<div class="emptyslot" style="position:absolute;left:14px;top:0"></div>`;
  setHTML($('pit'), `
    <div class="zone"><button class="deckbtn" data-act="viewOut" aria-label="Deck: open the card tracker" title="Card tracker">${deck}</button><div class="lbl dk"><span>Deck <b>${dl}</b></span><span class="dk-bar ${dl <= 10 ? 'low' : ''}" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => {
      // nine cells of six cards each: full at the start, emptying from the right as cards are dealt
      const f = Math.max(0, Math.min(1, (dl - i * 6) / 6));
      return `<i style="--f:${f.toFixed(2)}"></i>`; }).join('')}</span></div></div>
    <div class="zone spot"><div class="stage">${spot}</div><div class="lbl">${spotLbl}</div></div>
    <div class="zone"><button class="discardbtn" data-act="viewDiscard" ${S.discard.length ? '' : 'disabled'} aria-label="View discard pile">${dis}</button><div class="lbl">Discard <b>${S.discard.length}</b></div></div>`);
}

const PU_ORDER = ['A', '2', '5'], PU_RANK = { A:1, 2:2, 5:5 };
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
  el.classList.toggle('short', S.phase === 'idle' && S.deck.length > 0 && S.coins < upkeep());   // point at the ✕ buttons
  setHTML(el, PU_ORDER.filter(t => counts[t]).map(t => {
    const n = counts[t], P = Object.values(POWER).find(x => x.type === t), each = powerCost(PU_RANK[t]);
    const eff = t === 'A' ? `+${n} multipliers` : t === '2' ? 'Red/black suits' : `+${n} seat${n > 1 ? 's' : ''}`;
    return `<div class="pu pu-${t} ${n > (prev[t] || 0) ? 'pop' : ''}" data-type="${t}" role="group" aria-label="${P.name}${n > 1 ? ` ×${n}` : ''}: ${eff}, upkeep ${each * n} per card" title="${P.name}: ${eff}">
      ${puEmblem(t, n)}
      <div class="pu-body"><div class="pu-name">${P.name}${n > 1 ? `<span class="pu-n">×${n}</span>` : ''}</div><div class="pu-eff">${eff}</div></div>
      <div class="pu-up" title="Upkeep, paid on each new card"><span>${coin}${fmt(each * n)}</span><small>/card</small></div>
      <button class="x" data-act="release" data-type="${t}" ${can ? '' : 'disabled'} aria-label="Release one ${P.name}" title="Release one (stop paying its upkeep)">✕</button></div>`;
  }).join(''));
  ui.pupPrev = counts;
}

function renderHand(){
  const cap = capacity();
  const on = k => prefs.sort === k ? 'true' : 'false';
  const note = S.phase === 'trim' ? `<div class="hnote trim">${S.hand.length} cards, ${cap} seats: tap a card to discard it <b>+${fmt(S.bet)} debt</b></div>`
    : S.phase === 'swapPlace' ? `<div class="hnote">Replace which card with ${cardName(S.swapCard)}?</div>` : '';
  setHTML($('handhead'), `${note || `<div class="lbl">Hand <b>${S.hand.length}</b>/<b>${cap}</b></div>`}
    <div class="seg" role="group" aria-label="Sort hand">
      <button data-act="sortRank" aria-pressed="${on('rank')}" title="Sort by rank"><span class="ico rk"><i></i><i></i><i></i></span>Rank</button>
      <button data-act="sortSuit" aria-pressed="${on('suit')}" title="Sort by suit"><span class="ico st">${suitSVG('S')}${suitSVG('H')}</span>Suit</button>
    </div>`);
  const ev = evaluate(S.hand.filter(c => !S.faceDown.includes(c.id)), S.powerups);
  const hot = new Set(ev.combos.flatMap(c => c.ids));
  const picking = S.phase === 'decide' || S.phase === 'trim' || S.phase === 'swapPlace';
  let keyN = 0;
  const html = sortedHand().map(c => {
    if (S.faceDown.includes(c.id) && !ui.throwing) return cardHTML(c, { back:true, extra: ui.seen.has(c.id) ? '' : 'enter' }).replace('class="card', `data-fd="${c.id}" class="card`);
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
    if (S.phase === 'decide') out = out.replace(/<\/div>$/, `<span class="tag ok peek">→ ×${fmt(swapMult(c.id))}</span></div>`);
    return out;
  });
  for (let i = S.hand.length; i < cap; i++) html.push(`<div class="emptyslot"></div>`);
  $('hand').style.setProperty('--n', Math.max(cap, S.hand.length));
  setHTML($('hand'), html.join(''));
}

function renderValue(){
  const visible = S.hand.filter(c => !S.faceDown.includes(c.id));
  const ev = evaluate(visible, S.powerups);
  let tip = '';
  const pv = S.phase === 'decide' ? swapPreview() : null;
  if (pv && pv.best.mult > pv.base)
    tip = `<button class="chip tip" data-act="bestSwap" data-id="${pv.best.out.id}">Swap ${cardSpan(pv.best.out)}<em>→ ×${fmt(pv.best.mult)}</em></button>`;
  const boosts = [ev.boost ? `<span class="chip">Ace +${ev.boost}</span>` : '', ev.twoTone ? '<span class="chip">Two-tone</span>' : ''].join('');
  const b = S.phase === 'bet' ? Math.max(1, Math.min(S.betInput, S.coins)) : S.bet;
  setHTML($('value'), `<div class="ro-mult ${ev.mult ? '' : 'zero'}" title="Multiplier"><span class="x">×</span><span id="multBig">${fmt(ev.mult)}</span></div>
    ${S.phase === 'bet' ? '' : `<div class="ro-pay"><small>Pays</small><span>${coin}${fmt(b * ev.mult)} <em>bet ${fmt(b)}</em></span></div>`}
    <div class="ro-extra">${boosts}${tip}</div>`);
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
    const what = after < 0 ? 'ends run' : net > 0 ? `win ${fmt(net)}` : net < 0 ? `lose ${fmt(-net)}` : 'break even';
    return `<button class="btn cash grow ${after < 0 ? 'bust' : net < 0 ? 'down' : ''}" data-act="cash">${ico('cash')}<span class="bl"><b>Cash out</b><small class="cashnet">${what}</small></span>${kbd('C')}</button>`;
  };
  switch (S.phase){
    case 'bet': {
      const b = Math.max(1, Math.min(S.betInput, S.coins));
      const pre = [['last', 'Last', S.lastBet], ['q', '¼', Math.floor(S.coins / 4)], ['h', '½', Math.floor(S.coins / 2)], ['max', 'Max', S.coins]]
        .filter(([k, , v]) => v >= 1 && (k !== 'last' || v <= S.coins));
      rows = `<div class="row">
        <div class="betbox">
          <div class="bet-row">
            <button class="step" data-act="betKey" data-hold="-1" aria-label="Lower bet" ${b <= 1 ? 'disabled' : ''}>−</button>
            <label class="val">${coin}<input id="betNum" type="number" inputmode="numeric" min="1" max="${S.coins}" step="1" value="${b}" aria-label="Bet amount"></label>
            <button class="step" data-act="betKey" data-hold="1" aria-label="Raise bet" ${b >= S.coins ? 'disabled' : ''}>+</button>
            <div class="presets" role="group" aria-label="Quick bets">${pre.map(([k, l, v]) => `<button class="q" data-act="preset" data-v="${v}" aria-pressed="${b === v}" title="Bet ${fmt(v)}" aria-label="${k === 'last' ? 'Last bet' : k === 'max' ? 'All in' : l + ' of your coins'}: ${fmt(v)}">${l}</button>`).join('')}</div>
          </div>
          <input type="range" id="betRange" min="0" max="${RN}" step="1" value="${betToPos(b)}" aria-label="Bet slider" ${S.coins <= 1 ? 'disabled' : ''}>
        </div></div>
        <div class="row">
          <button class="btn grow" data-act="throw" ${ui.throwing ? 'disabled' : ''}>${ico('throw')}${bl('Throw away')}${kbd('T')}</button>
          <button class="btn gold grow" data-act="deal" ${ui.throwing ? 'disabled' : ''}>${ico('deal')}${bl('Deal')}${kbd('D')}</button>
        </div>`;
      break;
    }
    case 'decide': {
      const c = S.pending, full = S.hand.length >= cap, dealt = offerIsDealt(), P = dealt ? POWER[c.rank] : null;
      const more = canDraw(), up = upkeep();
      const discCost = [(!S.pendingCharged || (more && full)) ? `+${fmt(S.bet)} debt` : '', more && up ? `upkeep ${up}` : '',
        !more && S.deck.length && S.coins < up ? `upkeep ${up}` : ''].filter(Boolean).join(' · ');
      let btns = '';
      btns += `<button class="btn warn grow" data-act="discard">${ico('discard')}${bl('Discard', discCost)}${kbd('D')}</button>`;
      if (P){
        const dup = P.type === '2' && S.powerups.some(x => x.type === '2');
        btns += dup
          ? `<button class="btn power grow" disabled title="Already active">${ico('power')}${bl(P.name, 'active')}</button>`
          : `<button class="btn power grow" data-act="power" ${S.coins < powerCost(c.rank) ? 'disabled' : ''} title="${P.short}">${ico('power')}${bl(P.name, `${coin}${fmt(powerCost(c.rank))} · ${P.short}`)}${kbd('P')}</button>`;
      }
      if (dealt && c.rank === 10) btns += `<button class="btn power grow" data-act="swap" ${S.coins < swapCost() || !S.discard.length ? 'disabled' : ''} title="Take a card back from the discard pile">${ico('back')}${bl('Take back', `${coin}${fmt(swapCost())} · from discard`)}${kbd('W')}</button>`;
      rows = `<div class="row">${btns}</div><div class="row">${cashBtn()}</div>`;
      break;
    }
    case 'idle': {
      const up = upkeep(), dl = S.deck.length;
      const short = dl > 0 && S.coins < up;
      const why = short ? `upkeep ${up}` : '';
      const nextCost = [S.hand.length >= cap ? `+${fmt(S.bet)} debt` : '', up ? `upkeep ${up}` : ''].filter(Boolean).join(' · ');
      // can't pay upkeep: Deal stays pressable and answers with a shake (see input.js) and this note
      rows = (short ? `<div class="callout" id="upkeepNote" role="alert"><b>Can’t pay upkeep (${fmt(up)}).</b> Release a power-up (✕) or cash out.</div>` : '') + `<div class="row">
        <button class="btn gold grow ${short ? 'blocked' : ''}" data-act="next" ${!dl ? 'disabled' : ''}>${ico('next')}${bl(dl ? 'Next card' : 'Deck empty', why || (dl ? nextCost : ''))}${kbd('N')}</button>
        ${cashBtn()}</div>`;
      break;
    }
    case 'swapPick':
      rows = `<div class="row"><button class="btn gold grow" data-act="openPick">${ico('pile')}${bl('Pick a card')}</button><button class="btn grow" data-act="cancelSwap">${ico('cancel')}${bl('Cancel')}</button></div>`;
      break;
    case 'swapPlace':
      rows = `<div class="row"><button class="btn grow" data-act="cancelSwap">${ico('cancel')}${bl('Cancel')}</button></div>`;
      break;
    case 'trim':
      break;
    case 'result':
      rows = `<div class="row"><button class="btn gold grow" data-act="nextSet">${ico('deal')}${bl('Next hand')}${kbd('Enter')}</button></div>`; break;
    case 'reshuffle':
      rows = `<div class="row"><button class="btn gold grow" data-act="openReshuffle">${ico('up')}${bl('Next level')}</button></div>`; break;
    case 'over':
      rows = `<div class="row"><button class="btn gold grow" data-act="restartNow">${ico('replay')}${bl('Play again')}</button></div>`; break;
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
      </div>
      <div class="receipt"><div><span>Coins</span><b>${fmt(S.coins)}</b></div><div><span>Price</span><b class="neg">−${fmt(price)}</b></div><div class="tot"><span>Left</span><b>${fmt(S.coins - price)}</b></div></div>
      <div class="pricebump"><div class="pb-head">Prices <b>×2</b> in level ${L + 1}</div>
        <div class="pb-list">${PU_ORDER.map(t => { const r = PU_RANK[t], now = powerCost(r);
          return `<div class="pb-item">${puEmblem(t, 1)}<span>${Object.values(POWER).find(x => x.type === t).name}</span><b><s>${fmt(now)}</s>${coin}${fmt(now * 2)}</b></div>`; }).join('')}
          <div class="pb-item"><span class="pb-ten">10</span><span>Take back</span><b><s>${fmt(swapCost())}</s>${coin}${fmt(swapCost() * 2)}</b></div></div></div>
      <div class="actions"><button class="btn gold grow" data-act="reshuffle">Pay ${fmt(price)}</button></div>`;
  }
  else if (m === 'tracker') html = trackerHTML();
  else if (m === 'history') html = historyHTML();
  else if (m === 'settings') html = settingsHTML();
  else if (m === 'bust') html = bustHTML();
  else if (m === 'record') html = recordHTML();
  else if (m === 'unlock') html = unlockHTML();
  else if (m === 'release5'){
    const over = S.hand.length - (capacity() - 1);
    html = `<h2>Release Extra seat?</h2>
      <p class="lead">Your hand has <b>${S.hand.length}</b> cards. With one seat fewer it holds <b>${capacity() - 1}</b>, so you'll have to <b>discard ${over === 1 ? 'one card' : over + ' cards'}</b> — each adds your bet (${coin}${fmt(S.bet)}) to the debt.</p>
      <div class="actions"><button class="btn" data-act="close">Keep it</button><button class="btn warn" data-act="releaseConfirm">Release and discard</button></div>`;
  }
  else if (m === 'restart') html = `<h2>New game?</h2><p class="lead">This run will be lost.</p>
    <div class="actions"><button class="btn" data-act="close">Cancel</button><button class="btn gold" data-act="restartNow">New game</button></div>`;
  else if (m === 'pick' || m === 'view'){
    const picking = m === 'pick';
    html = `<h2>${picking ? 'Take a card back' : 'Discard pile'}</h2>
      <div class="pickgrid">${S.discard.slice().reverse().map(c => {
        const used = picking && S.swapTen && c.id === S.swapTen.id;
        return cardHTML(c, { track:false, act: picking && !used ? 'pickDiscard' : null, extra: used ? 'used' : '' });
      }).join('')}</div>
      <div class="actions">${picking ? `<button class="btn" data-act="cancelSwap">Cancel</button>` : `<button class="btn gold" data-act="close">Close</button>`}</div>`;
  }
  const closable = CLOSABLE.includes(m);
  const opened = ui.modalShown !== m;
  if (opened && !ui.modalShown) ui.lastFocus = document.activeElement;
  // the same dialog, new content (a tab, the leaderboard loading): update its body only, so it doesn't replay its
  // opening animation (the "flash"), and keep the scroll position and the focused button
  const body = !opened && root.querySelector(`.modal.m-${m} .mbody`);
  if (body){
    if (body.__html === html) return;
    const top = body.scrollTop, f = document.activeElement, key = f && body.contains(f) && f.dataset ? [f.dataset.act, f.dataset.v] : null;
    body.innerHTML = html; body.__html = html; body.scrollTop = top;
    if (key && key[0]){ const again = body.querySelector(`[data-act="${key[0]}"]${key[1] ? `[data-v="${key[1]}"]` : ''}`); if (again) again.focus({ preventScroll:true }); }
    return;
  }
  const x = closable ? `<button class="mclose" data-act="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>` : '';
  setHTML(root, `<div class="scrim" data-act="${closable ? 'scrimClose' : ''}"><div class="modal ${m === 'result' || m === 'over' || m === 'bust' || m === 'reshuffle' ? 'm-result' : ''} m-${m}" role="dialog" aria-modal="true" aria-label="${MODAL_NAMES[m] || 'Dialog'}">${x}<div class="mbody">${html}</div></div></div>`);
  const nb = root.querySelector('.mbody'); if (nb) nb.__html = html;
  ui.modalShown = m;
  if (opened){
    const f = root.querySelector('.modal .btn.gold, .modal .mbody [data-act]:not([data-act="scrimClose"]), .modal button, .modal input');
    if (f) setTimeout(() => f.focus({ preventScroll:true }), 30);
  }
}

const CLOSABLE = ['help', 'view', 'tracker', 'history', 'settings', 'bust', 'restart', 'release5', 'record', 'unlock'];
const MODAL_NAMES = { help:'How to play', result:'Hand result', over:'Run over', reshuffle:'Level complete', tracker:'Card tracker', view:'Discard pile', pick:'Take a card back', history:'History', settings:'Settings', bust:'Cash-out warning', restart:'New game', release5:'Release Extra seat', record:'Top hand of the day', unlock:'Unlocked' };
// closing a dialog that opened over another (the top-hand celebration) returns to the one underneath
function closeModal(){ ui.modal = ui.modal === 'record' && ui.modalBack ? ui.modalBack : null; ui.modalBack = null; }
function bustHTML(){
  const ev = evaluate(S.hand, S.powerups), payout = S.bet * ev.mult, after = S.coins + payout - S.debt;
  return `<div class="rs-head loss"><div class="rs-verdict">This ends your run</div>
      <div class="rs-net"><b>${signed(after)}</b><span>coins after</span></div></div>
    <div class="actions"><button class="btn" data-act="close">Cancel</button><button class="btn warn" data-act="bustConfirm">Cash out</button></div>`;
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
    <div class="tlegend">
      <span><i class="k-deck"></i>Unseen <b>${count('deck')}</b></span>
      <span><i class="k-play"></i>In play <b>${count('play')}</b></span>
      <span><i class="k-disc"></i>Discard <b>${count('disc')}</b></span>
      <span><i class="k-out"></i>Out <b>${count('out')}</b></span>
    </div>
    <div class="tgrid">${rows}</div>
    <div class="tjok"><div class="sl" style="width:24px;font-size:12px;color:var(--muted);font-weight:800">JKR</div>${jk}</div>
    <div class="actions"><button class="btn gold" data-act="close">Close</button></div>`;
}

function handBody(r){
  const L = r.ledger || {};
  const hot = new Set(r.ev.combos.flatMap(c => c.ids));
  const cards = r.hand.map(c => cardHTML(c, { track:false, extra: r.ev.combos.length ? (hot.has(c.id) ? 'hit' : 'dim') : '' })).join('');
  const eq = r.ev.combos.length
    ? r.ev.combos.map(c => `<span class="combo">${c.label}<em>×${fmt(c.factor)}</em></span>`).join('<span class="op">×</span>') + `<span class="op">=</span><span class="tot"><span class="x">×</span>${fmt(r.ev.mult)}</span>`
    : `<span class="combo">No pair, straight or flush</span><span class="op">=</span><span class="tot zero"><span class="x">×</span>0</span>`;
  const boosts = [r.ev.boost ? `Ace boost +${r.ev.boost}` : '', r.ev.twoTone ? 'Two-tone' : ''].filter(Boolean).join(' · ');
  const lines = [
    { k:'Payout', v: r.payout, show:true },
    { k:'Bet', v: L.bet ?? -r.bet, show:true },
    { k:'Debt', v: L.debt ?? -r.debt, show: !!r.debt },
    { k:'Upkeep', v: L.upkeep || 0 },
    { k:'Power-ups', v: L['power-up'] || 0 },
    { k:'10-swap', v: L['10 swap'] || 0 },
  ].filter(l => l.show || l.v);
  const net = lines.reduce((a, l) => a + l.v, 0);
  return `
    <div class="minihand rs-hand">${cards}</div>
    <div class="rs-eq">${eq}</div>
    ${boosts ? `<p class="rs-note">${boosts}</p>` : ''}
    <div class="rs-lines">
      ${lines.map(l => `<div class="rs-line ${l.v > 0 ? 'plus' : l.v < 0 ? 'minus' : ''}"><i class="dot"></i><span>${l.k}</span><b>${signed(l.v)}</b></div>`).join('')}
      <div class="rs-line total"><i></i><span>Net</span><b class="${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}">${signed(net)}</b></div>
    </div>`;
}
function resultHTML(){
  const r = S.result; if (!r) return '';
  const net = r.net ?? (r.payout - r.debt - r.bet);
  const mood = net > 0 ? 'win' : net < 0 ? 'loss' : 'even';
  const verdict = net > 0 ? (net >= r.bet * 5 ? 'Big win' : 'Profit') : net < 0 ? 'Loss' : 'Broke even';
  return `<div class="rs-head ${mood}">
      <div class="rs-eyebrow">Hand ${r.handNo || ''}</div>
      <div class="rs-verdict">${verdict}</div>
      <div class="rs-net"><b data-to="${net}">${signed(net)}</b></div>
      <div class="rs-flow">${coin}${fmt(r.start)} <span class="arr">→</span> ${coin}${fmt(r.total)}</div>
    </div>
    ${handBody(r)}
    ${levelWarning(r)}
    <div class="actions rs-actions"><button class="btn gold" data-act="nextSet">Next hand</button></div>`;
}
/* ---------- run over ----------
   Leads with a picture of what happened (what you had against what you needed), then the run's path
   through the levels, a coins chart with the target line, tips taken from this run, and stats beside bests. */
const TIP_ICONS = {
  target:'<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M12 12l8-8M16 4h4v4"/>',
  cards:'<rect x="4" y="6" width="10" height="14" rx="1.6"/><path d="M9 4h9a1.6 1.6 0 0 1 1.6 1.6V17"/>',
  power:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  bet:'<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>',
  idea:'<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
};
function runTips(o, L){
  const h = Array.isArray(S.history) ? S.history : [], RL = S.runLedger || {}, st = S.stats;
  const tips = [];
  if (o.cause === 'level'){
    const lv = h.filter(x => x.level === L);
    if (lv.length){
      const start = lv[0].start, per = Math.ceil((o.price - start) / lv.length), got = Math.round((o.have - start) / lv.length);
      tips.push(['target', `Needed <b>${signed(per)}</b> a hand; you made <b>${signed(got)}</b>.`]);
    }
  }
  if (o.cause === 'bust') tips.push(['bet', 'A red cash-out button ends the run.']);
  if (o.cause === 'broke') tips.push(['bet', 'Keep coins back for the next bet.']);
  const debt = -(RL.debt || 0), power = -((RL.upkeep || 0) + (RL['power-up'] || 0));
  if (debt >= 8) tips.push(['cards', `Discards cost <b>${fmt(debt)}</b>. Cash out sooner.`]);
  if (power >= 8) tips.push(['power', `Power-ups cost <b>${fmt(power)}</b>. Release them sooner.`]);
  if (st.biggestLoss >= Math.max(8, 0.4 * (st.peak || 0))) tips.push(['bet', `Biggest loss <b>${fmt(st.biggestLoss)}</b>. Bet smaller.`]);
  return tips.slice(0, 2);
}
// On the hand result: warn when the level is about to end and the next price isn't covered.
function levelWarning(r){
  const price = levelPrice(lvl()), need = price - S.coins;
  if (need <= 0 || r.deckLeft > 14) return '';
  const last = r.deckLeft < 5;
  return `<div class="callout lvwarn" role="note"><b>${last ? 'Last hand of the level.' : `${r.deckLeft} cards left.`}</b> Need ${fmt(need)} more for level ${lvl() + 1}.</div>`;
}
function overHTML(){
  const o = S.over || {}, r = o.res, st = S.stats;
  const cause = o.cause || (r ? 'bust' : 'level');
  const run = o.run || { level:lvl(), biggestWin:st.biggestWin || 0, biggestLoss:st.biggestLoss || 0, peak:st.peak, bestPayout:st.bestPayout, hands:st.cashouts };
  const L = run.level, rec = prefs.record || run, isNew = o.isNew || {};

  // 1. headline: what ended the run, in one line
  const head = {
    level:{ title:`Couldn’t pay for level ${L + 1}` },
    bust: { title:'Debt bigger than coins' },
    broke:{ title:'Out of coins' },
  }[cause];

  // 2. gauge: what you had against what you needed
  let gauge = '';
  if (cause !== 'broke'){
    const have = Math.max(0, o.have ?? 0), need = cause === 'level' ? (o.price || levelPrice(L)) : (o.need || 1);
    const pct = Math.max(2, Math.min(100, have / need * 100));
    gauge = `<div class="gauge" role="img" aria-label="You had ${fmt(have)} of the ${fmt(need)} you needed; short by ${fmt(need - have)}">
      <div class="g-labels"><span>You had <b>${coin}${fmt(have)}</b></span><span>${cause === 'level' ? 'Price' : 'Debt'} <b>${coin}${fmt(need)}</b></span></div>
      <div class="g-track"><i style="--to:${pct.toFixed(1)}%"></i><span class="g-lock">${cause === 'level' ? LOCK_SVG : ''}</span></div>
      <div class="g-short">Short <b>${fmt(need - have)}</b></div></div>`;
  }

  // 3. journey through the levels
  const first = Math.max(1, L - 3), nodes = [];
  for (let i = first; i <= L; i++) nodes.push(i < L
    ? `<li class="done"><span class="jn">${i}</span><small>paid ${fmt(levelPrice(i))}</small></li>`
    : `<li class="end"><span class="jn">${i}</span><small>ended</small></li>`);
  nodes.push(`<li class="lock"><span class="jn">${LOCK_SVG}</span><small>${L + 1}: ${fmt(levelPrice(L))}</small></li>`);
  const journey = `<ol class="journey" aria-label="Levels">${first > 1 ? '<li class="more">…</li>' : ''}${nodes.join('')}</ol>`;

  // 4. coins over the run, with the price you had to reach
  const h = Array.isArray(S.history) ? S.history : [];
  const fromIdx = Math.max(0, h.findIndex(x => x.level === L));
  const chart = h.length >= 2 ? `<h3>Coins</h3>${coinChart(h, cause === 'level' ? { v:o.price || levelPrice(L), from:fromIdx, label:'price' } : null)}` : '';

  // 5. tips from this run
  const tips = runTips(Object.assign({ have:S.coins }, o, { cause }), L).map(([ic, t]) =>
    `<li><svg viewBox="0 0 24 24" aria-hidden="true">${TIP_ICONS[ic]}</svg><span>${t}</span></li>`).join('');

  // 6. stats beside bests
  const tiles = [['level', 'Level', v => fmt(v)], ['hands', 'Hands', v => fmt(v)], ['peak', 'Most coins', v => fmt(v)], ['biggestWin', 'Biggest win', v => v ? '+' + fmt(v) : '—']];
  const stats = `<div class="tiles">${tiles.map(([k, label, f]) => `<div class="tile ${isNew[k] && !o.firstRun ? 'new' : ''} ${k === 'biggestWin' ? 'pos' : k === 'biggestLoss' ? 'neg' : ''}">
      <span>${label}</span><b>${f(run[k] || 0)}</b>${isNew[k] && !o.firstRun ? '<i>New best</i>' : `<small>${k === 'biggestLoss' ? 'worst' : 'best'} ${f(rec[k] || 0)}</small>`}</div>`).join('')}</div>`;
  const newCount = Object.keys(isNew).length;
  const meRow = leaderboardAvailable() && LB.me ? LB.boards.today.findIndex(x => x.id === LB.me) : -1;

  return `<div class="ro-head">
      <div class="rs-eyebrow">Run over · level ${L}</div>
      <div class="ro-title">${head.title}</div>
      ${gauge}
    </div>
    ${journey}
    ${newCount && !o.firstRun ? `<p class="ro-best">${newCount} new best${newCount > 1 ? 's' : ''}!</p>` : ''}
    ${meRow >= 0 ? `<p class="ro-best"><b>#${meRow + 1}</b> today</p>` : ''}
    ${chart}
    ${tips ? `<h3>Tips</h3><ul class="tips">${tips}</ul>` : ''}
    ${r ? `<details class="ro-hand"><summary>Last hand</summary>${handBody(r)}</details>` : ''}
    <h3>This run</h3>${stats}
    <p class="snote">Seed <code class="seed">${S.seed}</code></p>
    <div class="actions ro-actions">${leaderboardAvailable() ? `<button class="btn" data-act="openBoard">Leaderboard</button>` : ''}<button class="btn" data-act="replaySeed">Same cards</button><button class="btn gold grow" data-act="restartNow">Play again</button></div>`;
}
// a tiny example hand for the rules: 'rank+suit' codes, with the scoring cards lit
function exHand(codes, lit){
  const R = { A:1, J:11, Q:12, K:13 };
  return `<div class="cx">${codes.split(' ').map((code, i) => cardHTML(code === '0R' ? { id:'exjk' + i, rank:0, suit:'JR' } : { id:'ex' + code + i, rank: R[code.slice(0, -1)] || +code.slice(0, -1), suit: code.slice(-1) },
    { track:false, extra: lit.includes(i) ? '' : 'dim' })).join('')}</div>`;
}
function helpHTML(){
  return `<h2>How to play</h2>
    <h3>A hand</h3>
    <ul>
      <li>5 cards: 3 up, 2 down. <b>Throw away</b> is free before you bet.</li>
      <li>Bet and <b>Deal</b>. Each card dealt into a full hand adds your bet to the <b>debt</b>.</li>
      <li>Tap or drag a hand card to swap it with the center card (free). <b>Discard</b> deals the next one.</li>
      <li><b>Cash out</b>: bet × multiplier − debt. Below zero ends the run.</li>
    </ul>
    <h3>Multipliers (they multiply)</h3>
    <div class="combo-ex">
      ${exHand('7H 7S 2C 9D KS', [0, 1])}<span>Pair<small>trips = 2 pairs · quads = 3</small></span><b><span class="x">×</span>2</b>
      ${exHand('5C 6D 7H 8S 9C', [0, 1, 2, 3, 4])}<span>Straight<small>5 in a row</small></span><b><span class="x">×</span>5</b>
      ${exHand('2H 6H 9H JH KH', [0, 1, 2, 3, 4])}<span>Flush<small>5+ of a suit</small></span><b><span class="x">×</span>5</b>
    </div>
    <h3>Special cards</h3>
    <div class="combo-ex specials">
      ${exHand('0R', [0])}<span>Joker<small>+1 seat, free</small></span><b></b>
      ${exHand('AS', [0])}<span>Ace boost<small>+1 to every multiplier</small></span><b class="cost">${coin}${fmt(powerCost(1))}</b>
      ${exHand('2H', [0])}<span>Two-tone<small>suits become red and black</small></span><b class="cost">${coin}${fmt(powerCost(2))}</b>
      ${exHand('5C', [0])}<span>Extra seat<small>+1 seat</small></span><b class="cost">${coin}${fmt(powerCost(5))}</b>
      ${exHand('10D', [0])}<span>Take back<small>any card from the discard pile</small></span><b class="cost">${coin}${fmt(swapCost())}</b>
    </div>
    <p>Power-ups cost their price again on every new card. ✕ releases one. Their prices, and the 10's fee, <b>double each level</b>${lvl() > 1 ? ` (shown for level ${lvl()})` : ''}.</p>
    <h3>Levels</h3>
    <p>When the deck runs out, pay the level price (100, 200, 500, 1,000 …) to reshuffle, or the run ends.</p>
    <div class="actions"><button class="btn" data-act="replayTutorial">Tutorial</button><button class="btn gold" data-act="close">Got it</button></div>`;
}

function render(){
  // where each card on the table is now, so a card that lands on the discard pile can fly there
  const was = new Map(), topBefore = (document.querySelector('#pit .discardbtn .card:last-child') || {}).dataset;
  document.querySelectorAll('#pit .stage .card[data-cid], #hand .card[data-cid]').forEach(el => was.set(el.dataset.cid, el.getBoundingClientRect()));
  renderLedger(); renderPit(); renderPowers(); renderHand(); renderValue(); renderDock(); renderModal();
  const top = document.querySelector('#pit .discardbtn .card:last-child');
  if (top && was.has(top.dataset.cid) && (!topBefore || topBefore.cid !== top.dataset.cid)) runDiscardFx(top, was.get(top.dataset.cid));
  if (ui.prev && ui.prev.coins !== S.coins) rollNumber(document.querySelector('#st-coins .num'), ui.prev.coins, S.coins);
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
  if (ui.upkeepFx){ ui.upkeepFx = false; upkeepShortFx(); }
  scheduleComboLinks();
  tutorialTick();
  store(SAVE_KEY, S);
}

