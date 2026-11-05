/* Bankroll · hand history and the coins-over-the-run chart */
'use strict';

function recordHand(res, coinsAfter){
  if (!Array.isArray(S.history)) S.history = [];
  S.history.push({ n:res.handNo, level:lvl(), bet:res.bet, mult:res.ev.mult, labels:res.ev.combos.map(c => c.label),
    net:res.net, start:res.start, coins:coinsAfter });
  if (S.history.length > 300) S.history.splice(0, S.history.length - 300);
}

// Line chart of coins after each hand, with level boundaries marked.
function coinChart(hist, target){
  const W = 340, H = 150, padL = 34, padR = 12, padT = 14, padB = 22;
  const pts = [{ v: hist[0].start, level: hist[0].level }].concat(hist.map(h => ({ v:h.coins, level:h.level })));
  const vals = pts.map(p => p.v);
  let lo = Math.min(0, ...vals), hi = Math.max(...vals, target ? target.v * 1.08 : 0);
  if (hi === lo) hi = lo + 10;
  // round the top up to a tidy value: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × a power of ten
  const nice = v => { const m = Math.pow(10, Math.floor(Math.log10(Math.max(1, Math.abs(v))))); return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(k => k * m).find(c => c >= v); };
  hi = nice(hi);
  const x = i => padL + (pts.length === 1 ? 0 : i * (W - padL - padR) / (pts.length - 1));
  const y = v => padT + (hi - v) * (H - padT - padB) / (hi - lo);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join('');
  const area = `${line}L${x(pts.length - 1).toFixed(1)} ${y(lo).toFixed(1)}L${x(0).toFixed(1)} ${y(lo).toFixed(1)}Z`;
  let marks = '';
  for (let i = 1; i < pts.length; i++) if (pts[i].level !== pts[i - 1].level)
    marks += `<path class="ch-lv" d="M${x(i - .5).toFixed(1)} ${padT}V${H - padB}"/><text class="ch-lt" x="${(x(i - .5) + 3).toFixed(1)}" y="${padT + 8}">L${pts[i].level}</text>`;
  const last = pts[pts.length - 1];
  if (target){
    const fx = x(Math.max(0, target.from || 0)), ty = y(target.v);
    marks += `<path class="ch-target" d="M${fx.toFixed(1)} ${ty.toFixed(1)}H${W - padR}"/><text class="ch-tl" x="${W - padR}" y="${(ty - 5).toFixed(1)}" text-anchor="end">${target.label}</text>`;
  }
  const grid = [hi, (hi + lo) / 2, lo].map(v => `<path class="ch-grid" d="M${padL} ${y(v).toFixed(1)}H${W - padR}"/><text class="ch-ax" x="${padL - 6}" y="${(y(v) + 3.5).toFixed(1)}">${fmt(Math.round(v))}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Coins after each hand: from ${fmt(pts[0].v)} to ${fmt(last.v)} over ${hist.length} hands">
    <defs><linearGradient id="chFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ch-f1"/><stop offset="1" class="ch-f2"/></linearGradient></defs>
    ${grid}${lo < 0 ? `<path class="ch-zero" d="M${padL} ${y(0).toFixed(1)}H${W - padR}"/>` : ''}${marks}
    <path class="ch-area" d="${area}" fill="url(#chFill)"/><path class="ch-line" d="${line}"/>
    <circle class="ch-end ${target && last.v < target.v ? 'short' : ''}" cx="${x(pts.length - 1).toFixed(1)}" cy="${y(last.v).toFixed(1)}" r="4"/>
    <text class="ch-ax" x="${padL}" y="${H - 6}" text-anchor="start">Start</text><text class="ch-ax" x="${W - padR}" y="${H - 6}" text-anchor="end">Hand ${hist[hist.length - 1].n}</text>
  </svg>`;
}

function historyHTML(){
  const lb = leaderboardAvailable();
  const tab = lb && ui.histTab === 'board' ? 'board' : 'run';
  const tabs = lb ? `<div class="tabs" role="tablist">
      <button role="tab" data-act="histTab" data-v="run" aria-selected="${tab === 'run'}">This run</button>
      <button role="tab" data-act="histTab" data-v="board" aria-selected="${tab === 'board'}">Leaderboard</button></div>` : '';
  let body;
  if (tab === 'board') body = leaderboardHTML();
  else {
    const h = Array.isArray(S.history) ? S.history : [];
    if (!h.length) body = `<p class="empty">No hands yet.</p>`;
    else {
      const net = h.reduce((a, x) => a + x.net, 0), best = h.reduce((a, x) => x.net > a.net ? x : a, h[0]);
      const rows = h.slice(-10).reverse().map(x => `<div class="hrow">
          <span class="hn">#${x.n}</span><span class="hl">L${x.level}</span>
          <span class="hc">${x.labels.length ? x.labels.join(' + ') : 'No combo'}<small>bet ${fmt(x.bet)} · ×${fmt(x.mult)}</small></span>
          <b class="${x.net > 0 ? 'pos' : x.net < 0 ? 'neg' : ''}">${signed(x.net)}</b></div>`).join('');
      body = `${coinChart(h)}
        <div class="hsum"><div><span>Hands</span><b>${h.length}</b></div><div><span>Net</span><b class="${net >= 0 ? 'pos' : 'neg'}">${signed(net)}</b></div><div><span>Best hand</span><b class="pos">${signed(best.net)}</b></div></div>
        <h3>Last ${Math.min(10, h.length)} hands</h3><div class="hlist">${rows}</div>`;
    }
  }
  return `<h2>History</h2>${tabs}${body}<div class="actions"><button class="btn gold" data-act="close">Close</button></div>`;
}
