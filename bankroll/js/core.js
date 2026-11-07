/* Bankroll · constants, state, helpers and hand scoring */
'use strict';

/* ================= constants ================= */
const SUITS = { S:{sym:'♠',red:false,name:'Spades'}, H:{sym:'♥',red:true,name:'Hearts'}, D:{sym:'♦',red:true,name:'Diamonds'}, C:{sym:'♣',red:false,name:'Clubs'} };
const RANKS = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_NAMES = ['','Aces','Twos','Threes','Fours','Fives','Sixes','Sevens','Eights','Nines','Tens','Jacks','Queens','Kings'];
const POWER = {
  1: { type:'A', cost:1, name:'Ace boost', short:'+1 multipliers' },
  2: { type:'2', cost:2, name:'Two-tone',  short:'Red/black suits' },
  5: { type:'5', cost:5, name:'Extra seat',short:'+1 seat' },
};
const SWAP_COST = 10, START_COINS = 50;
// price to pass level L: 100, 200, 500, 1000, 2000, 5000, …
const levelPrice = L => 100 * Math.pow(10, L - 1);   // 100, 1,000, 10,000, 100,000 …
const lvl = () => S.level || S.stats.shuffles || 1;
// A pilot build served from /bankroll-pilot/ (for trying rule changes) keeps its own save and settings, so it never
// touches the live game's. See README: Pilot builds.
const KEY_NS = typeof location !== 'undefined' && /\/bankroll-pilot\//.test(location.pathname || '') ? '-pilot' : '';
const SAVE_KEY = 'bankroll-save-v1' + KEY_NS, PREF_KEY = 'bankroll-prefs-v1' + KEY_NS;

/* ================= state ================= */
let S = null;
let prefs = { sound:true, sort:'rank' };
const ui = { armed:null, modal:null, seen:new Set(), flips:new Set(), flies:[] };

function store(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function load(k){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }catch(e){ return null; } }

function makeDeck(){
  const d = [];
  for (const s of ['S','H','D','C']) for (let r = 1; r <= 13; r++) d.push({ id:'k'+(S.uid++), rank:r, suit:s });
  d.push({ id:'k'+(S.uid++), rank:0, suit:'JR' });
  d.push({ id:'k'+(S.uid++), rank:0, suit:'JB' });
  for (let i = d.length - 1; i > 0; i--){ const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

/* ================= seeded shuffles ================= */
// A run's seed fixes the order of every deck in that run, so a run can be replayed.
const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newSeed(){ let s = ''; for (let i = 0; i < 8; i++){ s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)]; if (i === 3) s += '-'; } return s; }
function cleanSeed(x){ const t = String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); return t.length < 4 ? null : (t.length > 4 ? t.slice(0, 4) + '-' + t.slice(4) : t); }
function seedState(seed){ let h = 2166136261 >>> 0; for (const ch of seed){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; }
function rand(){ // mulberry32, state kept in the save so a reload continues the same sequence
  let t = (S.rng = (S.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function newGame(seed){
  S = { v:SAVE_VERSION, seed: cleanSeed(seed) || newSeed(), history:[], runLedger:{}, uid:1, coins:START_COINS, debt:0, bet:0, betInput:1, deck:[], throwaway:[], discard:[], hand:[], faceDown:[],
        powerups:[], jokerSeen:[], pending:null, swapTen:null, swapCard:null, phase:'bet', result:null, over:null,
        level:1, stats:{ sets:0, cashouts:0, bestPayout:0, peak:START_COINS, shuffles:1, discards:0, biggestWin:0, biggestLoss:0, bestMult:0 }, bestHand:null };
  S.rng = seedState(S.seed);
  S.runId = S.seed + '-' + Date.now().toString(36);   // identifies this run on the leaderboard
  S.rules = RULES;
  S.seedChosen = !!cleanSeed(seed);                   // the player picked this seed (a "seeded" run)
  S.official = null;                                  // set when the website's server issued this run
  S.log = [];                                         // every move, so the run can be replayed and verified
  S.deck = makeDeck();
  ui.seen.clear(); ui.armed = null; ui.modal = null; ui.prev = null;
  newSet();
}

/* ================= save versioning ================= */
// Bump SAVE_VERSION when the save format changes, and teach migrate() to upgrade older saves.
const SAVE_VERSION = 3;
const RULES = 6;   // 6: keeping a power-up costs 2×, 4×, 8× … its price per card; 5: upkeep doubled from 1×; 4: the Ace boost adds once to three/four of a kind; 3: half a bet to deal; 2: an extra bet to deal, card debt ×1.5 per card, level prices ×10 (bump when the rules change)
function migrate(s){
  if (!s || !Array.isArray(s.deck) || !s.phase) return null;
  if (s.v && s.v > SAVE_VERSION) return null;            // saved by a newer version: start fresh
  ['throwaway','discard','hand','faceDown','powerups','jokerSeen'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
  // saved under the old debt rules (no extra bet to deal, 1 bet per card): carry on from the debt as card debt, and
  // keep the run off the leaderboard, since the server replays every run under the current rules
  if (s.rules !== RULES){ if (!Array.isArray(s.cardSteps)) s.cardSteps = s.phase !== 'bet' && s.debt > 0 ? [s.debt] : []; s.official = null; s.rules = RULES; }
  s.stats = Object.assign({ sets:0, cashouts:0, bestPayout:0, peak:s.coins || 0, shuffles:1, discards:0, biggestWin:0, biggestLoss:0 }, s.stats || {});
  s.level = s.level || s.stats.shuffles || 1;
  if (s.handStart == null && s.phase !== 'bet') s.handStart = s.coins + (s.bet || 0);
  if (!s.seed) s.seed = newSeed();
  if (s.rng == null) s.rng = seedState(s.seed);
  if (!s.runId) s.runId = s.seed + '-' + Date.now().toString(36);
  s.history = Array.isArray(s.history) ? s.history : [];
  s.runLedger = s.runLedger || {};
  if (!Array.isArray(s.log)) s.log = null;            // runs from before move logging can't be verified
  s.stats.bestMult = s.stats.bestMult || 0;
  s.v = SAVE_VERSION;
  return s;
}

/* ================= helpers ================= */
const isJoker = c => c.rank === 0;
const isRed = c => c.suit === 'H' || c.suit === 'D' || c.suit === 'JR';
const capacity = () => 5 + S.jokerSeen.length + S.powerups.filter(p => p.type === '5').length;
// power-up prices double with each level: level 1 = the base price, level 2 = ×2, level 3 = ×4 …
const powerCost = rank => POWER[rank].cost * Math.pow(2, lvl() - 1);
const swapCost = () => SWAP_COST * Math.pow(2, lvl() - 1);   // the 10 take-back fee doubles too
// a power-up costs its price (by level) to buy, and keeping it doubles that for every card: 2×, 4×, 8× its price …
// (p.paid = cards it has paid upkeep for so far)
const upkeepOf = p => powerCost(p.card.rank) * Math.pow(2, (p.paid || 0) + 1);
const upkeep = () => S.powerups.reduce((a, p) => a + upkeepOf(p), 0);
// Amounts have no upper limit. Up to 999 billion they're written out (or as K / M / B in tight spots); from a trillion
// on they switch to scientific notation, 1.23e12, which stays short however large the number grows.
const SCI_FROM = 1e12;
const sci = n => { const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (!isFinite(a)) return s + '∞';
  let e = Math.floor(Math.log10(a)), m = a / Math.pow(10, e);
  m = Math.floor(m * 100 + 1e-6) / 100; if (m >= 10){ m /= 10; e++; }            // round down, like the K / M / B forms (the 1e-6 absorbs float error)
  return s + String(+m.toFixed(2)) + 'e' + e; };
const fmt = n => Math.abs(n) >= SCI_FROM ? sci(n) : Math.round(n).toLocaleString('en-US');
// for tight boxes: a million and up becomes 1.25M / 12.5M / 125M / 1.25B …, then 1.25e12 and so on, so any amount fits
const fmtFit = n => { const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= SCI_FROM) return sci(n);
  if (a < 1e6) return fmt(n);
  const [d, u] = a >= 1e9 ? [1e9, 'B'] : [1e6, 'M'], v = a / d;
  return s + (v >= 100 ? Math.floor(v) : v >= 10 ? Math.floor(v * 10) / 10 : Math.floor(v * 100) / 100) + u; };
// for the tightest spots (power-up chips, price lists): 10,000 and up becomes 12.8K / 1.28M / …
const fmtShort = n => Math.abs(n) < 1e4 ? fmt(n) : Math.abs(n) < 1e6 ? (Math.floor(n / 100) / 10).toString().replace(/\.0$/, '') + 'K' : fmtFit(n);
// a font-size step for a number box by how long its text is
const fitCls = str => { const n = String(str).length; return n >= 8 ? 'f4' : n >= 7 ? 'f3' : n >= 6 ? 'f2' : n >= 5 ? 'f1' : ''; };
function cardName(c){
  if (isJoker(c)) return (c.suit === 'JR' ? 'Red' : 'Black') + ' Joker';
  return RANKS[c.rank] + SUITS[c.suit].sym;
}
function cardSpan(c){ return `<span class="${isRed(c) ? 'r' : ''}">${cardName(c)}</span>`; }
const coin = '<span class="coin" aria-hidden="true"></span>';

/* ================= scoring ================= */
function evaluate(cards, pups){
  const boost = pups.filter(p => p.type === 'A').length;
  const twoTone = pups.some(p => p.type === '2');
  const combos = [];
  const byRank = {};
  cards.forEach(c => { if (!isJoker(c)) (byRank[c.rank] = byRank[c.rank] || []).push(c); });
  // pairs: a pair ×2, three of a kind ×4, four of a kind ×8 (n of a kind = 2^(n−1)); the Ace boost adds to that once
  Object.keys(byRank).map(Number).sort((a, b) => (b === 1 ? 14 : b) - (a === 1 ? 14 : a)).forEach(r => {
    const g = byRank[r]; if (g.length < 2) return;
    const pairs = g.length - 1;
    const name = g.length === 2 ? 'Pair' : g.length === 3 ? 'Three' : g.length === 4 ? 'Four' : g.length + '×';
    combos.push({ kind:'pair', label: g.length === 2 ? `Pair of ${RANK_NAMES[r]}` : `${name} ${RANK_NAMES[r]}`,
      note: '', factor: Math.pow(2, pairs) + boost, each: Math.pow(2, pairs) + boost, count: 1, ids: g.map(c => c.id) });
  });
  // straights: every 5-long run of consecutive ranks (ace high or low)
  const has = r => !!byRank[r === 14 ? 1 : r];
  for (let s = 1; s <= 10; s++){
    let ok = true; for (let k = 0; k < 5; k++) if (!has(s + k)){ ok = false; break; }
    if (ok){
      const ids = []; for (let k = 0; k < 5; k++){ const r = s + k === 14 ? 1 : s + k; ids.push(byRank[r][0].id); }
      combos.push({ kind:'straight', label:`Straight ${RANKS[s]}–${RANKS[s + 4]}`, factor: 5 + boost, each: 5 + boost, count:1, ids });
    }
  }
  // flushes: 5+ of one suit (or one colour under Two-tone, jokers included)
  const groups = {};
  cards.forEach(c => {
    let key; if (twoTone) key = isRed(c) ? 'red' : 'black'; else if (!isJoker(c)) key = c.suit; else return;
    (groups[key] = groups[key] || []).push(c);
  });
  Object.entries(groups).forEach(([k, g]) => {
    if (g.length >= 5) combos.push({ kind:'flush', label: twoTone ? (k === 'red' ? 'Red flush' : 'Black flush') : `Flush ${SUITS[k].sym}`,
      note: g.length > 5 ? `${g.length} cards` : '', factor: 5 + boost, each: 5 + boost, count:1, ids: g.map(c => c.id) });
  });
  const mult = combos.length ? combos.reduce((m, c) => m * c.factor, 1) : 0;
  return { mult, combos, boost, twoTone };
}
