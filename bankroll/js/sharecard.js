/* Bankroll · the picture for a share: a 1200×630 card (the size chats and social sites show best) of the moment
   being shared: the hand (in the player's own card pack, sorted as they sort it, with its combos drawn as in the
   game and the power-ups it used), a run's level and coins with its best hand, or a leaderboard place.
   Drawn on a canvas with the game's own fonts and colours (cards: js/cardraster.js). */
'use strict';

const SC = { w:1200, h:630, gold:'#f5d98c', brass:'#d9ab4c', muted:'#9fc3b5', paper:'#fbf6ea', ink:'#1d1f26', red:'#c3303b' };
const SC_RANK = r => ({ 1:'A', 11:'J', 12:'Q', 13:'K' }[r] || String(r));
const SC_SUIT = { S:'♠', H:'♥', D:'♦', C:'♣' };
const scFont = (size, fam, weight = '') => `${weight} ${size}px ${fam}`.trim();
const F_DISPLAY = "Limelight, Georgia, serif", F_UI = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif", F_CARD = "'Bodoni Moda', Didot, Georgia, serif";

function scRound(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// one card: [rank, suit], lit (part of a paying combo) or dimmed
function scCard(g, x, y, w, c, lit){
  const h = w * 1.4, r = w * 0.08, joker = c[1] === 'JR' || c[1] === 'JB', red = c[1] === 'H' || c[1] === 'D' || c[1] === 'JR';
  g.save();
  if (lit === false) g.globalAlpha = 0.45;
  g.shadowColor = lit ? 'rgba(245,217,140,.75)' : 'rgba(0,0,0,.45)'; g.shadowBlur = lit ? w * 0.22 : w * 0.12; g.shadowOffsetY = lit ? 0 : w * 0.04;
  scRound(g, x, y, w, h, r); g.fillStyle = SC.paper; g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = Math.max(2, w * 0.025); g.strokeStyle = lit ? SC.gold : 'rgba(0,0,0,.15)'; g.stroke();
  g.fillStyle = red ? SC.red : SC.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (joker){
    g.font = scFont(w * 0.5, F_UI, '800'); g.fillText('★', x + w / 2, y + h * 0.42);
    g.font = scFont(w * 0.15, F_UI, '800'); g.fillText('JOKER', x + w / 2, y + h * 0.74);
  } else {
    g.font = scFont(w * 0.3, F_CARD, '800'); g.fillText(SC_RANK(c[0]), x + w * 0.24, y + h * 0.15);
    g.font = scFont(w * 0.2, F_UI); g.fillText(SC_SUIT[c[1]] || '', x + w * 0.24, y + h * 0.33);
    g.font = scFont(w * 0.62, F_UI); g.fillText(SC_SUIT[c[1]] || '', x + w * 0.56, y + h * 0.63);
  }
  g.restore();
}
const SC_PU = { A:'Ace boost +1', '2':'Two-tone', '5':'Extra seat' };
const SC_MAX_CARDS = 24;                                // (more than any hand can hold: a hand is never cut short)
// the hand's cards and combos, worked out once: sorted as the player sorts them, scoring cards lit, the combos that pay
function handModel(cards, powers, labels){
  const rv = c => c.rank === 0 ? 99 : (c.rank === 1 ? 14 : c.rank);
  const objs = cards.filter(c => Array.isArray(c)).slice(0, SC_MAX_CARDS).map(([rank, suit], i) => ({ id:'sh' + i, rank:+rank, suit:String(suit) }));
  if ((prefs.sort || 'rank') === 'suit') objs.sort((a, b) => ((a.rank === 0) - (b.rank === 0)) || a.suit.localeCompare(b.suit) || rv(a) - rv(b));
  else objs.sort((a, b) => rv(a) - rv(b) || a.suit.localeCompare(b.suit));
  const pus = powers.filter(p => Array.isArray(p)).map(p => ({ type:p[2] }));
  const ev = evaluate(objs, pus);
  const plain = l => String(l).replace(/<[^>]*>/g, '');
  const combos = ev.combos.filter(cb => cb.ids.length > 1 && (!labels.length || labels.some(l => plain(l) === plain(cb.label))));
  return { objs, combos, plain, lit:new Set(combos.flatMap(cb => cb.ids)) };
}
// the hand in a box: the cards in a row, as big as the box allows, with every combo's line and name drawn like the
// game's combo links (straights above the cards, pairs and flushes below), each on its own row so nothing overlaps
async function drawHand(g, hm, box, plainCards, handPack){
  const { objs, combos, plain, lit } = hm;
  const above = combos.filter(cb => cb.kind === 'straight'), below = combos.filter(cb => cb.kind !== 'straight');
  const n = objs.length; if (!n) return;
  const ROW = 30, GAP = 16, rows = above.length + below.length, MIN_H = 104;
  // more combos than lines fit with readable cards: the cards big and lit, the combos as chips under them (grouped)
  const lineRoom = box.h - MIN_H - (above.length ? GAP : 0) - (below.length ? GAP : 0);
  if (rows && rows * ROW > lineRoom + 20) return drawHandCompact(g, hm, box, plainCards, handPack);
  const padTop = above.length ? GAP + (above.length - 1) * ROW + 16 : 0, padBot = below.length ? GAP + (below.length - 1) * ROW + 16 : 0;
  const gap = n > 10 ? 6 : n > 6 ? 9 : 14;
  const w = Math.max(24, Math.min(132, (box.h - padTop - padBot) / 1.42, (box.w - gap * (n - 1)) / n)), h = w * 1.42;
  const total = n * w + (n - 1) * gap;
  const x0 = box.x + (box.w - total) / 2, y0 = box.y + Math.max(0, (box.h - (padTop + h + padBot)) / 2) + padTop;
  // a hand from the boards: the deck it was played with; the player's own hand: their deck
  const pack = handPack ? (typeof handPackOf === 'function' ? handPackOf(handPack) : handPack) : typeof currentPack === 'function' ? currentPack() : 'classic';
  for (let i = 0; i < n; i++){
    g.save(); if (lit.size && !lit.has(objs[i].id)) g.globalAlpha = .45;
    try { if (plainCards) throw 0; await drawPackCard(g, objs[i], x0 + i * (w + gap), y0, w, pack, lit.has(objs[i].id)); }
    catch (e) { scCard(g, x0 + i * (w + gap), y0, w, [objs[i].rank, objs[i].suit], lit.has(objs[i].id)); }   // a plain card if the pack can't be drawn
    g.restore();
  }
  if (!rows) return;
  const cx = id => { const i = objs.findIndex(o => o.id === id); return x0 + i * (w + gap) + w / 2; };
  const spread = Math.min(8, gap + w * 0.1);
  const draw = (cb, k, up) => {
    const col = (typeof LINK_COLORS !== 'undefined' && LINK_COLORS[cb.kind]) || SC.gold;
    const side = up ? above : below;
    const xs = cb.ids.map(id => { const on = side.filter(c2 => c2.ids.includes(id)); return cx(id) + (on.indexOf(cb) - (on.length - 1) / 2) * spread; });
    const x1 = Math.min(...xs), x2 = Math.max(...xs), edge = up ? y0 - 4 : y0 + h + 4, y = up ? y0 - GAP - k * ROW : y0 + h + GAP + k * ROW;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); xs.forEach(x => { g.moveTo(x, edge); g.lineTo(x, y); }); g.stroke();
    xs.forEach(x => { g.beginPath(); g.arc(x, edge, 3.5, 0, Math.PI * 2); g.fill(); });
    // its name and multiplier, on a dark pill on its line (kept inside the picture)
    const text = plain(cb.label) + '  ×' + fmtFit(cb.factor);
    g.font = scFont(17, F_UI, '800'); const tw = g.measureText(text).width + 20;
    const mx = Math.min(Math.max((x1 + x2) / 2, box.x + tw / 2), box.x + box.w - tw / 2);
    scRound(g, mx - tw / 2, y - 13, tw, 26, 13); g.fillStyle = '#0a2a23'; g.fill(); g.lineWidth = 2; g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, mx, y + 1);
  };
  below.forEach((cb, k) => draw(cb, k, false)); above.forEach((cb, k) => draw(cb, k, true));
}
// the compact hand: cards in a row (scoring ones lit), then each combo with its multiplier in chips, alike ones
// grouped ("10 straights ×8 each"), as many as two rows hold
async function drawHandCompact(g, hm, box, plainCards, handPack){
  const { objs, combos, plain, lit } = hm, n = objs.length;
  const CHIPS = 2 * 34 + 8 + 14;
  const gap = n > 10 ? 6 : n > 6 ? 9 : 14;
  const w = Math.max(24, Math.min(132, (box.h - CHIPS) / 1.42, (box.w - gap * (n - 1)) / n)), h = w * 1.42;
  const total = n * w + (n - 1) * gap, x0 = box.x + (box.w - total) / 2, y0 = box.y + Math.max(0, (box.h - CHIPS - h) / 2);
  const pack = handPack ? (typeof handPackOf === 'function' ? handPackOf(handPack) : handPack) : typeof currentPack === 'function' ? currentPack() : 'classic';
  for (let i = 0; i < n; i++){
    g.save(); if (lit.size && !lit.has(objs[i].id)) g.globalAlpha = .45;
    try { if (plainCards) throw 0; await drawPackCard(g, objs[i], x0 + i * (w + gap), y0, w, pack, lit.has(objs[i].id)); }
    catch (e) { scCard(g, x0 + i * (w + gap), y0, w, [objs[i].rank, objs[i].suit], lit.has(objs[i].id)); }
    g.restore();
  }
  const NAME = { straight:['straight', 'straights'], flush:['flush', 'flushes'], pair:['combo', 'combos'] };
  const groups = [];
  combos.forEach(cb => {
    const k = cb.kind === 'straight' ? 'straight:' + cb.factor : cb.label;
    const gr = groups.find(x => x.k === k); if (gr) gr.n++; else groups.push({ k, cb, n:1 });
  });
  const items = groups.map(({ cb, n:cnt }) => ({ text:cnt > 1 ? `${cnt} ${NAME[cb.kind][1]}  ×${fmtFit(cb.factor)} each` : `${plain(cb.label)}  ×${fmtFit(cb.factor)}`,
    color:(typeof LINK_COLORS !== 'undefined' && LINK_COLORS[cb.kind]) || SC.gold, edge:(typeof LINK_COLORS !== 'undefined' && LINK_COLORS[cb.kind]) || SC.gold }));
  // what doesn't fit in two rows: "+N more"
  const fit = [];
  g.font = scFont(18, F_UI, '800');
  let row = 0, used = 0;
  for (const it of items){
    const wd = g.measureText(it.text).width + 26;
    if (used && used + 8 + wd > box.w - 140){ row++; used = 0; }
    if (row > 1) break;
    fit.push(it); used += (used ? 8 : 0) + wd;
  }
  if (fit.length < items.length) fit.push({ text:`+${items.length - fit.length} more`, bare:true, color:SC.muted });
  scChips(g, fit, box.x + box.w / 2, y0 + h + 18, box.w, 2, true);
}
// chips in rows inside a width (right-aligned), as many as fit in `lines` rows; returns the height used
function scChips(g, items, right, top, maxW, lines, center){
  const H = 34, GAPX = 8, GAPY = 8, rowsOut = [[]];
  g.font = scFont(18, F_UI, '800');
  const widths = items.map(it => g.measureText(it.text).width + (it.bare ? 6 : 26));
  let used = 0;
  items.forEach((it, i) => {
    if (used && used + GAPX + widths[i] > maxW){ rowsOut.push([]); used = 0; }
    rowsOut[rowsOut.length - 1].push(i); used += (used ? GAPX : 0) + widths[i];
  });
  const shown = rowsOut.slice(0, lines);
  shown.forEach((row, r) => {
    const rw = row.reduce((a, i, k) => a + widths[i] + (k ? GAPX : 0), 0);
    let x = center ? right - rw / 2 : right - rw, y = top + r * (H + GAPY);
    row.forEach(i => {
      const it = items[i], wd = widths[i];
      if (!it.bare){ scRound(g, x, y, wd, H, H / 2); g.fillStyle = it.fill || 'rgba(4,26,21,.65)'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = it.edge || 'rgba(217,171,76,.45)'; g.stroke(); }
      g.fillStyle = it.color || '#eaf3ee'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = scFont(18, F_UI, '800');
      g.fillText(it.text, x + wd / 2, y + H / 2 + 1);
      x += wd + GAPX;
    });
  });
  return shown.length * (H + GAPY) - GAPY;
}
// fits text into a width by shrinking it
function scText(g, text, x, y, size, fam, weight, color, maxW, align = 'left'){
  let s = size; g.font = scFont(s, fam, weight);
  while (g.measureText(text).width > maxW && s > 12){ s -= 2; g.font = scFont(s, fam, weight); }
  g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
}
// what to draw for a moment (see momentOf in js/social.js); cards are [rank, suit] with an optional lit flag
function scContent(m){
  const f = v => v === 'Infinity' ? '∞' : fmtFit(v);
  const labels = (m.labels || []).join('  ×  ');
  if (m.kind === 'hand') return { eyebrow:'Big hand', pre:'×', big:f(m.mult), sub:labels, cards:m.cards };
  if (m.kind === 'besthand') return { eyebrow:'Today\'s best hands', pre:'#', big:String(m.rank), sub:`×${f(m.mult)} · ${labels}`, cards:m.cards };
  if (m.kind === 'tophand') return { eyebrow:'Top hand of the day', pre:'×', big:f(m.mult), sub:labels, cards:m.cards, medal:'👑' };
  if (m.kind === 'run') return { eyebrow:'Run over', pre:'', big:`Level ${m.level}`, sub:`${f(m.peak)} coins${Number(m.mult) > 0 || m.mult === 'Infinity' ? ` · best hand ×${f(m.mult)}` : ''}`, cards:m.cards, medal:String(m.level), medalSub:'LEVEL' };
  if (m.kind === 'daily') return { eyebrow:`Daily challenge · ${m.day || ''}`, pre:'#', big:String(m.rank), sub:`of ${m.players} today · level ${m.level} · ${f(m.peak)} coins`, cards:m.cards, medal:String(m.rank), medalSub:'DAILY' };
  if (m.kind === 'dailyinvite') return { eyebrow:`Daily challenge · ${m.day || ''}`, pre:'', big:'One deck, one try', sub:`Same cards for everyone today${m.players ? ` · ${m.players} played so far` : ''}`, cards:[], medal:'?', medalSub:'CAN YOU TOP IT' };
  if (m.kind === 'board') return { eyebrow:m.period === 'week' ? 'This week\'s leaderboard' : 'Today\'s leaderboard', pre:'#', big:String(m.rank), sub:`Level ${m.level} · ${f(m.peak)} coins`, cards:m.cards, medal:String(m.rank), medalSub:m.period === 'week' ? 'THIS WEEK' : 'TODAY' };
  return { eyebrow:'', pre:'', big:'', sub:'', cards:[] };
}
// a canvas that can't be exported (an image from another origin) falls back to plain cards
async function shareImage(m){
  try { return await shareImageOnce(m, false); }
  catch (e) { return shareImageOnce(m, true); }
}
async function shareImageOnce(m, plainCards){
  try { await Promise.all([`64px ${F_DISPLAY}`, `800 64px ${F_CARD}`, `700 30px ${F_CARD}`, `800 30px ${F_UI}`, `30px ${F_UI}`].map(f => document.fonts.load(f))); } catch(e){}
  const cv = document.createElement('canvas'); cv.width = SC.w; cv.height = SC.h;
  const g = cv.getContext('2d'), c = scContent(m);
  // felt with a soft light from above, a darker floor, and a brass rail
  const bg = g.createRadialGradient(SC.w * 0.42, SC.h * 0.18, 40, SC.w / 2, SC.h * 0.55, SC.w * 0.8);
  bg.addColorStop(0, '#2a6f58'); bg.addColorStop(0.55, '#113f34'); bg.addColorStop(1, '#05190f');
  g.fillStyle = bg; g.fillRect(0, 0, SC.w, SC.h);
  const vig = g.createLinearGradient(0, SC.h * 0.55, 0, SC.h); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = vig; g.fillRect(0, 0, SC.w, SC.h);
  g.lineWidth = 2; g.strokeStyle = 'rgba(217,171,76,.5)'; scRound(g, 16, 16, SC.w - 32, SC.h - 32, 26); g.stroke();
  // the header: a gold coin with a spade and the name; where to play, in a pill on the right
  const cx = 68, cy = 64;
  const coinG = g.createRadialGradient(cx - 7, cy - 9, 3, cx, cy, 24); coinG.addColorStop(0, '#fff3c4'); coinG.addColorStop(0.5, SC.brass); coinG.addColorStop(1, '#9b7426');
  g.beginPath(); g.arc(cx, cy, 23, 0, Math.PI * 2); g.fillStyle = coinG; g.fill();
  g.fillStyle = '#3b2a08'; g.font = scFont(25, F_UI); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♠', cx, cy + 1);
  scText(g, 'Bankroll', 104, 80, 44, F_DISPLAY, '', SC.gold, 360);
  const cta = 'Play free · @TheBankrollBot';
  g.font = scFont(22, F_UI, '800'); const ctw = g.measureText(cta).width + 36;
  scRound(g, SC.w - 52 - ctw, cy - 22, ctw, 44, 22);
  const cg = g.createLinearGradient(0, cy - 22, 0, cy + 22); cg.addColorStop(0, '#f7dc94'); cg.addColorStop(1, '#d4a548');
  g.fillStyle = cg; g.fill();
  g.fillStyle = '#2b1e05'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cta, SC.w - 52 - ctw / 2, cy + 1);
  const hasCards = Array.isArray(c.cards) && c.cards.length;
  const pus = (m.powers || []).filter(p => Array.isArray(p) && SC_PU[p[2]]);
  if (hasCards){
    const hm = handModel(c.cards, m.powers || [], m.labels || []);
    // what happened, on the left: an eyebrow and the big number
    scText(g, c.eyebrow.toUpperCase(), 60, 150, 22, F_UI, '800', SC.muted, 460);
    let bx = 58; const bigY = 226, bigSize = 88;
    if (c.pre){ g.font = scFont(bigSize * 0.5, F_UI, '800'); g.fillStyle = SC.brass; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(c.pre, bx, bigY - bigSize * 0.08); bx += g.measureText(c.pre).width + 6; }
    scText(g, c.big, bx, bigY, bigSize, F_UI, '800', SC.gold, 470 - (bx - 58));
    // (a hand's combos are the chips on the right; a run, a daily or a place has its numbers here)
    if (m.kind === 'besthand') scText(g, `×${m.mult === 'Infinity' ? '∞' : fmtFit(m.mult)} today`, 60, bigY + 32, 24, F_UI, '700', '#eaf3ee', 470);
    else if (c.sub && m.kind !== 'hand' && m.kind !== 'tophand') scText(g, c.sub, 60, bigY + 32, 24, F_UI, '700', '#eaf3ee', 470);
    // the power-ups the hand used, on the right (grouped: Ace boost ×2); the combos are named on their lines below
    const kinds = {};
    pus.forEach(p => { kinds[p[2]] = (kinds[p[2]] || 0) + 1; });
    const items = ['A', '2', '5'].filter(t => kinds[t]).map(t => ({ text:kinds[t] > 1 ? `${SC_PU[t].replace(' +1', '')}  ×${kinds[t]}` : SC_PU[t].replace(' +1', ''),
      color:SC.brass, fill:'rgba(217,171,76,.12)', edge:'rgba(217,171,76,.55)' }));
    if (items.length){
      scText(g, 'POWER-UPS', SC.w - 60, 150, 18, F_UI, '800', SC.muted, 300, 'right');
      scChips(g, items, SC.w - 60, 166, 560, 2);
    }
    // the hand, across the bottom
    g.fillStyle = 'rgba(217,171,76,.16)'; g.fillRect(48, 270, SC.w - 96, 2);
    await drawHand(g, hm, { x:60, y:286, w:SC.w - 120, h:SC.h - 286 - 30 }, plainCards, m.pack || (m.kind === 'tophand' || m.kind === 'besthand' ? 'unknown' : null));
  } else {
    // no cards: the moment on the left, a gold medal on the right, and what the game is underneath
    const top = 230;
    scText(g, c.eyebrow.toUpperCase(), 60, top, 26, F_UI, '800', SC.muted, 640);
    const bigY = top + 112, bigSize = 120;
    let bx = 58;
    if (c.pre){ g.font = scFont(bigSize * 0.55, F_UI, '800'); g.fillStyle = SC.brass; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(c.pre, bx, bigY - bigSize * 0.08); bx += g.measureText(c.pre).width + 6; }
    scText(g, c.big, bx, bigY, bigSize, F_UI, '800', SC.gold, 600 - (bx - 58));
    if (c.sub) scText(g, c.sub, 60, bigY + 54, 32, F_UI, '700', '#eaf3ee', 620);
    if (c.medal){
      const mx = 930, my = 330, R = 150;
      g.save(); g.shadowColor = 'rgba(245,217,140,.45)'; g.shadowBlur = 60;
      const mg = g.createRadialGradient(mx - 40, my - 50, 10, mx, my, R); mg.addColorStop(0, '#fff3c4'); mg.addColorStop(0.45, SC.brass); mg.addColorStop(1, '#8a6420');
      g.beginPath(); g.arc(mx, my, R, 0, Math.PI * 2); g.fillStyle = mg; g.fill(); g.restore();
      g.beginPath(); g.arc(mx, my, R - 16, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = 'rgba(90,60,10,.45)'; g.stroke();
      g.fillStyle = '#3b2a08'; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (c.medalSub){ g.font = scFont(24, F_UI, '800'); g.fillText(c.medalSub, mx, my - 92); }
      let ms = 128; g.font = scFont(ms, F_UI, '800'); while (g.measureText(c.medal).width > R * 1.4 && ms > 40){ ms -= 8; g.font = scFont(ms, F_UI, '800'); }
      g.fillText(c.medal, mx, my + 26);
    }
    g.fillStyle = 'rgba(217,171,76,.16)'; g.fillRect(48, SC.h - 96, SC.w - 96, 2);
    scText(g, 'Bet, chase combos that multiply each other, and cash out before the debt catches you.', 60, SC.h - 52, 24, F_UI, '600', SC.muted, SC.w - 120);
  }
  cv.getContext('2d').getImageData(0, 0, 1, 1);           // throws on a tainted canvas (then: plain cards)
  return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.88));
}
