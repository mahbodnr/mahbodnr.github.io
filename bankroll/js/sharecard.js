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
// the hand: sorted as the player sorts it (rank or suit), scoring cards lit, every combo's line and name drawn like the
// game's combo links (straights above the cards, pairs and flushes below)
async function drawHand(g, cards, powers, labels, plainCards){
  const rv = c => c.rank === 0 ? 99 : (c.rank === 1 ? 14 : c.rank);
  const objs = cards.filter(c => Array.isArray(c)).slice(0, 9).map(([rank, suit], i) => ({ id:'sh' + i, rank:+rank, suit:String(suit) }));
  if ((prefs.sort || 'rank') === 'suit') objs.sort((a, b) => ((a.rank === 0) - (b.rank === 0)) || a.suit.localeCompare(b.suit) || rv(a) - rv(b));
  else objs.sort((a, b) => rv(a) - rv(b) || a.suit.localeCompare(b.suit));
  const pus = powers.filter(p => Array.isArray(p)).map(p => ({ type:p[2] }));
  const ev = evaluate(objs, pus);
  const plain = l => String(l).replace(/<[^>]*>/g, '');
  const combos = ev.combos.filter(cb => cb.ids.length > 1 && (!labels.length || labels.some(l => plain(l) === plain(cb.label))));
  const lit = new Set(combos.flatMap(cb => cb.ids));
  const above = combos.filter(cb => cb.kind === 'straight'), below = combos.filter(cb => cb.kind !== 'straight');
  const n = objs.length, areaX = 596, areaW = 568, ROW = 30, GAP = 18;
  const gap = n > 6 ? 8 : 12, w = Math.min(122, (areaW - gap * (n - 1)) / n), h = w * 1.42, total = n * w + (n - 1) * gap;
  const padTop = above.length ? GAP + above.length * ROW : 0, padBot = below.length ? GAP + below.length * ROW : 0;
  const x0 = areaX + (areaW - total) / 2, y0 = 135 + Math.max(0, (370 - (padTop + h + padBot)) / 2) + padTop;
  const pack = typeof currentPack === 'function' ? currentPack() : 'classic';
  for (let i = 0; i < n; i++){
    g.save(); if (lit.size && !lit.has(objs[i].id)) g.globalAlpha = .5;
    try { if (plainCards) throw 0; await drawPackCard(g, objs[i], x0 + i * (w + gap), y0, w, pack, lit.has(objs[i].id)); }
    catch (e) { scCard(g, x0 + i * (w + gap), y0, w, [objs[i].rank, objs[i].suit], lit.has(objs[i].id)); }   // a plain card if the pack can't be drawn
    g.restore();
  }
  const cx = id => { const i = objs.findIndex(o => o.id === id); return x0 + i * (w + gap) + w / 2; };
  const draw = (cb, k, up) => {
    const col = (typeof LINK_COLORS !== 'undefined' && LINK_COLORS[cb.kind]) || SC.gold;
    const side = up ? above : below;
    const xs = cb.ids.map(id => cx(id) + (side.filter(c2 => c2.ids.includes(id)).indexOf(cb) - (side.filter(c2 => c2.ids.includes(id)).length - 1) / 2) * 8);
    const x1 = Math.min(...xs), x2 = Math.max(...xs), edge = up ? y0 - 4 : y0 + h + 4, y = up ? y0 - GAP - k * ROW : y0 + h + GAP + k * ROW;
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); xs.forEach(x => { g.moveTo(x, edge); g.lineTo(x, y); }); g.stroke();
    xs.forEach(x => { g.beginPath(); g.arc(x, edge, 4, 0, Math.PI * 2); g.fill(); });
    // its name, on a dark pill in the middle of the line
    const text = plain(cb.label) + '  ×' + cb.factor;
    g.font = scFont(17, F_UI, '800'); const tw = g.measureText(text).width + 18, mx = Math.min(Math.max((x1 + x2) / 2, areaX + tw / 2), areaX + areaW - tw / 2);
    scRound(g, mx - tw / 2, y - 13, tw, 26, 13); g.fillStyle = '#0a2a23'; g.fill(); g.lineWidth = 2; g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, mx, y + 1);
  };
  below.forEach((cb, k) => draw(cb, k, false)); above.forEach((cb, k) => draw(cb, k, true));
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
  // felt, a rail of brass, a soft light from above
  const bg = g.createRadialGradient(SC.w / 2, SC.h * 0.35, 60, SC.w / 2, SC.h / 2, SC.w * 0.75);
  bg.addColorStop(0, '#22644f'); bg.addColorStop(0.6, '#0f3b31'); bg.addColorStop(1, '#061c18');
  g.fillStyle = bg; g.fillRect(0, 0, SC.w, SC.h);
  g.lineWidth = 3; g.strokeStyle = 'rgba(217,171,76,.55)'; scRound(g, 18, 18, SC.w - 36, SC.h - 36, 28); g.stroke();
  // the name: a gold coin with a spade, and the word
  const cx = 74, cy = 78;
  const coinG = g.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, 30); coinG.addColorStop(0, '#fff3c4'); coinG.addColorStop(0.5, SC.brass); coinG.addColorStop(1, '#9b7426');
  g.beginPath(); g.arc(cx, cy, 28, 0, Math.PI * 2); g.fillStyle = coinG; g.fill();
  g.fillStyle = '#3b2a08'; g.font = scFont(30, F_UI); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♠', cx, cy + 1);
  scText(g, 'Bankroll', 118, 98, 54, F_DISPLAY, '', SC.gold, 400);
  const hasCards = Array.isArray(c.cards) && c.cards.length;
  // what happened: an eyebrow, the big number, a line under it
  const top = hasCards ? 190 : 270;
  scText(g, c.eyebrow.toUpperCase(), 60, top, 26, F_UI, '800', SC.muted, 700);
  // the big line: a symbol (× or #) in the sturdy UI font, then the number in the display font
  const bigY = top + (hasCards ? 96 : 120), bigSize = hasCards ? 108 : 132;
  let bx = 58;
  if (c.pre){ g.font = scFont(bigSize * 0.55, F_UI, '800'); g.fillStyle = SC.brass; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(c.pre, bx, bigY - bigSize * 0.08); bx += g.measureText(c.pre).width + 6; }
  scText(g, c.big, bx, bigY, bigSize, F_UI, '800', SC.gold, 500 - (bx - 58));     // a sturdy face: the display serif's 4 reads as a 1
  if (c.sub) scText(g, c.sub, 60, bigY + 50, 34, F_UI, '700', '#eaf3ee', 520);
  // the power-ups the hand used
  const pus = (m.powers || []).filter(p => Array.isArray(p) && SC_PU[p[2]]);
  if (pus.length) scText(g, 'With ' + pus.map(p => `${SC_RANK(p[0])}${SC_SUIT[p[1]] || ''} ${SC_PU[p[2]]}`).join(' · '), 60, bigY + 96, 28, F_UI, '700', SC.brass, 520);
  // no cards to show: a gold medal on the right
  if (!hasCards && c.medal){
    const mx = 880, my = 300, R = 150;
    g.save(); g.shadowColor = 'rgba(245,217,140,.45)'; g.shadowBlur = 60;
    const mg = g.createRadialGradient(mx - 40, my - 50, 10, mx, my, R); mg.addColorStop(0, '#fff3c4'); mg.addColorStop(0.45, SC.brass); mg.addColorStop(1, '#8a6420');
    g.beginPath(); g.arc(mx, my, R, 0, Math.PI * 2); g.fillStyle = mg; g.fill(); g.restore();
    g.beginPath(); g.arc(mx, my, R - 16, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = 'rgba(90,60,10,.45)'; g.stroke();
    g.fillStyle = '#3b2a08'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (c.medalSub){ g.font = scFont(24, F_UI, '800'); g.fillText(c.medalSub, mx, my - 92); }
    let ms = 128; g.font = scFont(ms, F_UI, '800'); while (g.measureText(c.medal).width > R * 1.4 && ms > 40){ ms -= 8; g.font = scFont(ms, F_UI, '800'); }
    g.fillText(c.medal, mx, my + 26);
  }
  // the cards, on the right: the player's pack, sorted their way, combos drawn as in the game
  if (hasCards) await drawHand(g, c.cards, m.powers || [], m.labels || [], plainCards);
  // where to play
  g.fillStyle = 'rgba(217,171,76,.18)'; g.fillRect(40, SC.h - 112, SC.w - 80, 2);
  scText(g, 'Bet, chase combos that multiply each other, cash out before the debt catches you.', 60, SC.h - 62, 24, F_UI, '600', SC.muted, 660);
  scText(g, 'Play free · @TheBankrollBot', SC.w - 60, SC.h - 62, 28, F_UI, '800', SC.gold, 360, 'right');
  cv.getContext('2d').getImageData(0, 0, 1, 1);           // throws on a tainted canvas (then: plain cards)
  return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.9));
}
