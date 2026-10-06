"use strict";
const RANKS  = ["3","4","5","6","7","8","9","10","J","Q","K","A","2"];
const SUITS  = ["♦","♣","♥","♠"];
const SUITNM = ["Diamonds","Clubs","Hearts","Spades"];
const RNAME  = ["Three","Four","Five","Six","Seven","Eight","Nine","Ten","Jack","Queen","King","Ace","Deuce"];
const RPLUR  = ["Threes","Fours","Fives","Sixes","Sevens","Eights","Nines","Tens","Jacks","Queens","Kings","Aces","Deuces"];
const rk = v => v >> 2;
const st = v => v & 3;
const cardCode = v => RANKS[rk(v)] + "DCHS"[st(v)];
const FIVECAT = {straight:0, flush:1, fullhouse:2, four:3, straightflush:4};

const DEFAULT_RULES = {
  passLocksOut:false,
  straightWrap:false,      // allow A-2-3-4-5 and 2-3-4-5-6 (ranked lowest)
  flushSuitFirst:true,     // HK: suit decides, then high card
  mustLeadWith3D:true,
  laterRoundLead:"winner"  // winner | loser | threeD
};

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeDeck(){const d=[];for(let i=0;i<52;i++)d.push(i);return d}
function shuffle(arr,rng){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

function straightInfo(sorted, rules){
  const rs = sorted.map(rk);
  if(new Set(rs).size !== 5) return null;
  const s = rs.slice().sort((a,b)=>a-b);
  if(s[4] <= 11 && s[4]-s[0] === 4) return {pos:s[4], top:sorted[4]};
  if(rules.straightWrap){
    const key = s.join(",");
    if(key === "0,1,2,11,12") return {pos:-2, top:sorted.find(c=>rk(c)===2)};  // A-2-3-4-5
    if(key === "0,1,2,3,12")  return {pos:-1, top:sorted.find(c=>rk(c)===3)};  // 2-3-4-5-6
  }
  return null;
}

function classify(cards, rules){
  const cs = cards.slice().sort((a,b)=>a-b), n = cs.length;
  const mk = (type,key) => ({type,key,cards:cs});
  if(n === 1) return mk("single", cs[0]);
  if(n === 2) return rk(cs[0])===rk(cs[1]) ? mk("pair", cs[1]) : null;
  if(n === 3) return (rk(cs[0])===rk(cs[1]) && rk(cs[1])===rk(cs[2])) ? mk("triple", cs[2]) : null;
  if(n !== 5) return null;

  const cnt = {};
  for(const c of cs) cnt[rk(c)] = (cnt[rk(c)]||0) + 1;
  const ranks = Object.keys(cnt).map(Number);
  const flush = cs.every(c => st(c) === st(cs[0]));
  const str   = straightInfo(cs, rules);

  if(str && flush) return mk("straightflush", str.pos*4 + st(str.top));
  if(ranks.length === 2){
    const [a,b] = ranks;
    if(cnt[a]===4 || cnt[b]===4) return mk("four",      cnt[a]===4 ? a : b);
    if(cnt[a]===3 || cnt[b]===3) return mk("fullhouse", cnt[a]===3 ? a : b);
    return null;
  }
  if(flush) return mk("flush", rules.flushSuitFirst ? st(cs[0])*16 + rk(cs[4]) : cs[4]);
  if(str)   return mk("straight", str.pos*4 + st(str.top));
  return null;
}

function beats(a, b){
  if(!b) return true;
  if(a.cards.length !== b.cards.length) return false;
  if(a.cards.length === 5){
    const ca = FIVECAT[a.type], cb = FIVECAT[b.type];
    return ca !== cb ? ca > cb : a.key > b.key;
  }
  return a.type === b.type && a.key > b.key;
}

function describe(combo){
  if(!combo) return "—";
  const c = combo.cards, hi = c[c.length-1];
  switch(combo.type){
    case "single":  return RNAME[rk(hi)] + " of " + SUITNM[st(hi)];
    case "pair":    return "Pair of " + RPLUR[rk(hi)];
    case "triple":  return "Three " + RPLUR[rk(hi)];
    case "straight":return "Straight, " + RNAME[rk(hi)] + " high";
    case "flush":   return "Flush in " + SUITNM[st(hi)] + ", " + RNAME[rk(hi)] + " high";
    case "fullhouse":{
      const cnt={}; c.forEach(v=>cnt[rk(v)]=(cnt[rk(v)]||0)+1);
      const t=+Object.keys(cnt).find(r=>cnt[r]===3), p=+Object.keys(cnt).find(r=>cnt[r]===2);
      return "Full House, " + RPLUR[t] + " over " + RPLUR[p];
    }
    case "four":{
      const cnt={}; c.forEach(v=>cnt[rk(v)]=(cnt[rk(v)]||0)+1);
      const q=+Object.keys(cnt).find(r=>cnt[r]===4);
      return "Four " + RPLUR[q];
    }
    case "straightflush": return "Straight Flush in " + SUITNM[st(hi)] + ", " + RNAME[rk(hi)] + " high";
  }
  return combo.type;
}

/* ---- move generation (structural, not brute force) ---- */
function pick(arr, k){
  const out=[], cur=[];
  (function rec(i){ if(cur.length===k){out.push(cur.slice());return} for(;i<arr.length;i++){cur.push(arr[i]);rec(i+1);cur.pop()} })(0);
  return out;
}
function cross(groups, cap){
  let out=[[]];
  for(const g of groups){
    const next=[];
    for(const p of out){ for(const c of g){ next.push(p.concat(c)); if(next.length>=cap) break } if(next.length>=cap) break }
    out=next;
  }
  return out;
}

function genMoves(hand, rules){
  const out=[], seen=new Set();
  const add = cs => {
    const k = cs.slice().sort((a,b)=>a-b).join(",");
    if(seen.has(k)) return;
    const m = classify(cs, rules);
    if(m){ seen.add(k); out.push(m) }
  };
  const byRank={}, bySuit={};
  for(const c of hand){ (byRank[rk(c)] ||= []).push(c); (bySuit[st(c)] ||= []).push(c) }

  for(const c of hand) add([c]);
  for(const r in byRank){
    const g = byRank[r];
    if(g.length >= 2) pick(g,2).forEach(add);
    if(g.length >= 3) pick(g,3).forEach(add);
  }
  // four of a kind + kicker
  for(const r in byRank){
    const g = byRank[r];
    if(g.length === 4) for(const c of hand) if(rk(c) !== +r) add(g.concat(c));
  }
  // full houses — one representative per (triple rank, pair rank); key only depends on the triple
  for(const rt in byRank){
    if(byRank[rt].length < 3) continue;
    const trip = byRank[rt].slice(0,3);
    for(const rp in byRank){
      if(rp === rt || byRank[rp].length < 2) continue;
      add(trip.concat(byRank[rp].slice(0,2)));
    }
  }
  // flushes
  for(const s in bySuit){ const g=bySuit[s]; if(g.length >= 5) pick(g,5).forEach(add) }
  // straights
  const windows=[];
  for(let s=0;s<=7;s++) windows.push([s,s+1,s+2,s+3,s+4]);
  if(rules.straightWrap) windows.push([11,12,0,1,2],[12,0,1,2,3]);
  for(const w of windows){
    if(!w.every(r => byRank[r] && byRank[r].length)) continue;
    cross(w.map(r => byRank[r]), 48).forEach(add);
  }
  return out;
}

function legalMoves(hand, lastPlay, rules, need3D){
  let ms = genMoves(hand, rules).filter(m => beats(m, lastPlay));
  if(need3D) ms = ms.filter(m => m.cards.includes(0));
  return ms;
}

/* ---- scoring ---- */
function roundScore(counts){ // counts[i] = cards left
  const pay = counts.map(n => n * (n >= 13 ? 3 : n >= 10 ? 2 : 1));
  const pot = pay.reduce((a,b)=>a+b,0);
  return counts.map((n,i) => n === 0 ? pot : -pay[i]);
}

/* ============================================================
   AI — pure. Receives public state + own hand only.
   ============================================================ */
const PERSONALITIES = {
  marshal:{name:"Marshal Cobb", face:"🤠", control:9,  noise:0.00, passBias:1.0,
    barks:{play:["Steady now.","That'll hold.","Mind yourself."], pass:["I'll wait.","Not worth it."], win:["Justice served."]}},
  outlaw:{name:"Dusty Vane",  face:"🥷", control:2,  noise:0.05, passBias:0.3,
    barks:{play:["Eat that.","Too slow.","Comin' through."], pass:["Tch.","Fine."], win:["Told ya."]}},
  gambler:{name:"Lucky Pearl", face:"🎩", control:5,  noise:0.16, passBias:0.7,
    barks:{play:["Feelin' lucky.","Let's see now.","Care to fold?"], pass:["Hmm.","I'll sit this one."], win:["House always wins."]}}
};

const _pcache = new Map();
function partitionCount(hand, rules){
  if(!hand.length) return 0;
  const key = hand.join(",") + "|" + (rules.straightWrap?1:0);
  const hit = _pcache.get(key);
  if(hit !== undefined) return hit;
  let rem = hand.slice(), plays = 0, guard = 0;
  while(rem.length && guard++ < 20){
    const ms = genMoves(rem, rules);
    if(!ms.length){ plays += rem.length; break }
    let best = ms[0];
    for(const m of ms){
      if(m.cards.length > best.cards.length || (m.cards.length === best.cards.length && m.key < best.key)) best = m;
    }
    plays++;
    const gone = new Set(best.cards);
    rem = rem.filter(c => !gone.has(c));
  }
  if(_pcache.size > 60000) _pcache.clear();
  _pcache.set(key, plays);
  return plays;
}

function controlSpend(move){ // 2s and aces are the cards worth keeping
  let s = 0;
  for(const c of move.cards){ if(rk(c) === 12) s += 3; else if(rk(c) === 11) s += 1 }
  return s;
}

function unseenList(pub, hand){
  const u = [];
  for(let v=0; v<52; v++) if(!pub.played.has(v) && !hand.includes(v)) u.push(v);
  return u;
}
// Can anything still out there beat this? (singles, pairs and triples only)
function unbeatable(move, unseen){
  const n = move.cards.length;
  if(n === 1) return !unseen.some(v => v > move.key);
  if(n === 2 || n === 3){
    const byRank = {};
    for(const v of unseen) (byRank[rk(v)] ||= []).push(v);
    for(const r in byRank) if(byRank[r].length >= n && r*4 + 3 > move.key) return false;
    return true;
  }
  return false;
}

const W = {           // heuristic weights, tuned against the sim harness
  endgameAt:2, hardControl:4, perType:3, keyW:0.1,
  fiveBonus:2.5, endgameSingle:4, safeBonus:2, hardPass:0.55
};

function chooseMove(pub, hand, pers, rules, rng, difficulty){
  const moves = legalMoves(hand, pub.lastPlay, rules, pub.need3D);
  if(!moves.length) return null;

  // Out in one — always take it.
  const finisher = moves.find(m => m.cards.length === hand.length);
  if(finisher) return finisher;

  if(difficulty === "easy"){
    const sorted = moves.slice().sort((a,b) => a.key - b.key || a.cards.length - b.cards.length);
    const i = Math.min(sorted.length-1, Math.floor(Math.abs(rng()-rng()) * sorted.length));
    return (rng() < 0.12 && pub.lastPlay) ? null : sorted[i];
  }

  const hard = difficulty === "hard";
  if(!hard && rng() < pers.noise) return moves[Math.floor(rng()*moves.length)];

  const pressure = Math.min(...pub.counts.filter((_,i) => i !== pub.me));
  const endgame  = pressure <= W.endgameAt;
  const before   = partitionCount(hand, rules);
  const control  = hard ? W.hardControl : pers.control;
  const unseen   = hard ? unseenList(pub, hand) : null;

  // Sample the cheapest few of every shape, so five-card hands stay in contention.
  const groups = {};
  for(const m of moves) (groups[m.type] ||= []).push(m);
  const cand = [];
  for(const k in groups){ groups[k].sort((a,b) => a.key - b.key); cand.push(...groups[k].slice(0, W.perType)) }

  let best = null, bestCost = Infinity, bestAfter = 0;
  for(const m of cand){
    const gone  = new Set(m.cards);
    const after = partitionCount(hand.filter(c => !gone.has(c)), rules);
    let cost = after*10 + controlSpend(m) * (endgame ? 1 : control) + m.key * W.keyW;
    if(m.cards.length === 5) cost -= W.fiveBonus;              // five-card hands unload fastest
    if(endgame && m.cards.length === 1) cost += W.endgameSingle; // stop feeding cheap singles
    if(hard && unbeatable(m, unseen)) cost -= W.safeBonus;       // card counting
    if(cost < bestCost){ bestCost = cost; best = m; bestAfter = after }
  }
  if(!best) return moves[0];

  // Following: is taking this trick worth what it costs?
  if(pub.lastPlay){
    const pb = hard ? W.hardPass : pers.passBias;
    if(bestAfter >= before && !endgame && rng() < pb) return null;
    if(controlSpend(best) >= 3 && !endgame && pub.passesInRow < 2 && rng() < pb*0.6) return null;
  }
  return best;
}


function ruleTests(){
  const R = Object.assign({}, DEFAULT_RULES);
  const C = (code) => { // "TS" -> value
    const m = code.match(/^(10|[23456789JQKA])([DCHS])$/);
    return RANKS.indexOf(m[1]) * 4 + "DCHS".indexOf(m[2]);
  };
  const H = codes => codes.split(" ").map(C);
  let pass = 0, fail = 0; const log = [];
  const check = (name, got, want) => {
    if(got === want){ pass++ } else { fail++; log.push("FAIL " + name + ": got " + got + ", wanted " + want) }
  };
  const type = codes => { const c = classify(H(codes), R); return c ? c.type : "null" };

  check("single",        type("9S"), "single");
  check("pair",          type("9S 9H"), "pair");
  check("mixed two",     type("9S 8H"), "null");
  check("triple",        type("4D 4C 4H"), "triple");
  check("four cards",    type("4D 4C 4H 4S"), "null");
  check("low straight",  type("3D 4C 5H 6S 7D"), "straight");
  check("A-high straight", type("10D JC QH KS AD"), "straight");
  check("2 not in straight", type("JD QC KH AS 2D"), "null");
  check("flush",         type("3H 5H 9H JH KH"), "flush");
  check("full house",    type("KD KC KH 4S 4D"), "fullhouse");
  check("four + kicker", type("KD KC KH KS 4D"), "four");
  check("straight flush",type("3H 4H 5H 6H 7H"), "straightflush");
  check("gap is nothing",type("3D 4C 6H 7S 8D"), "null");

  const cmp = (a,b) => beats(classify(H(a),R), classify(H(b),R));
  check("2 beats ace",        cmp("2D","AS"), true);
  check("spade beats heart",  cmp("9S","9H"), true);
  check("heart beats club",   cmp("9H","9C"), true);
  check("club beats diamond", cmp("9C","9D"), true);
  check("flush over straight",cmp("3H 5H 9H JH KH","10D JC QH KS AD"), true);
  check("boat over flush",    cmp("4D 4C 4H 5S 5D","AH KH QH JH 9H"), true);
  check("quads over boat",    cmp("4D 4C 4H 4S 5D","AD AC AH KS KD"), true);
  check("sf over quads",      cmp("3H 4H 5H 6H 7H","AD AC AH AS KD"), true);
  check("pair can't take single", cmp("9S 9H","AS"), false);
  check("suit decides flushes",   cmp("3S 5S 9S JS QS","AH KH QH JH 9H"), true);

  // properties over random hands
  const rng = mulberry32(7);
  let anti = 0, refl = 0;
  for(let i=0;i<4000;i++){
    const d = shuffle(makeDeck(), rng);
    const n = [1,2,3,5][Math.floor(rng()*4)];
    const a = classify(d.slice(0,n), R), b = classify(d.slice(n,n*2), R);
    if(!a || !b) continue;
    if(beats(a,b) && beats(b,a)) anti++;
    if(beats(a,a)) refl++;
  }
  check("beats is antisymmetric", anti, 0);
  check("nothing beats itself",   refl, 0);

  // every five-card category against every other
  const samples = {straight:"3D 4C 5H 6S 7D", flush:"3H 5H 9H JH KH", fullhouse:"KD KC KH 4S 4D",
                   four:"KD KC KH KS 4D", straightflush:"3H 4H 5H 6H 7H"};
  const order = ["straight","flush","fullhouse","four","straightflush"];
  let matrixOK = true;
  for(let i=0;i<order.length;i++) for(let j=0;j<order.length;j++){
    if(i === j) continue;
    if(cmp(samples[order[i]], samples[order[j]]) !== (i > j)) matrixOK = false;
  }
  check("five-card category matrix", matrixOK, true);

  return (fail === 0 ? "✓ " : "✗ ") + pass + " passed, " + fail + " failed\n" + log.join("\n");
}


function simGame(seed, diffs){
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(), rng);
  const keys = ["marshal","outlaw","gambler","marshal"];
  const hands = [[],[],[],[]];
  for(let i=0;i<52;i++) hands[i%4].push(deck[i]);
  hands.forEach(h => h.sort((a,b)=>a-b));
  const g = {players:hands.map(h=>({hand:h,passed:false})), turn:hands.findIndex(h=>h.includes(0)),
             lastPlay:null, lastBy:null, passesInRow:0, played:new Set(), history:[]};
  let plays = 0, illegal = 0;
  while(plays < 600){
    const me = g.turn, hand = g.players[me].hand;
    const pub = {me, counts:g.players.map(p=>p.hand.length), lastPlay:g.lastPlay,
                 passesInRow:g.passesInRow, played:g.played,
                 need3D:DEFAULT_RULES.mustLeadWith3D && g.lastPlay===null && g.history.length===0};
    const pers = Object.assign({key:keys[me]}, PERSONALITIES[keys[me]]);
    const mv = chooseMove(pub, hand, pers, DEFAULT_RULES, rng, diffs[me]);
    if(mv){
      if(!beats(mv, g.lastPlay) || !mv.cards.every(c => hand.includes(c))) illegal++;
      const gone = new Set(mv.cards);
      g.players[me].hand = hand.filter(c => !gone.has(c));
      mv.cards.forEach(c => g.played.add(c));
      g.lastPlay = mv; g.lastBy = me; g.passesInRow = 0;
      g.history.push(1); plays++;
      if(g.players[me].hand.length === 0)
        return {winner:me, plays, illegal, counts:g.players.map(p=>p.hand.length)};
    } else {
      if(!g.lastPlay) illegal++;          // passing on your own lead is never legal
      g.passesInRow++;
      if(g.passesInRow >= 3){ g.lastPlay = null; g.passesInRow = 0; g.turn = g.lastBy; continue }
    }
    g.turn = (g.turn + 1) % 4;
  }
  return {winner:-1, plays, illegal, stalled:true, counts:g.players.map(p=>p.hand.length)};
}



function runSimsHeadless(n){
  let done=0, stalls=0, illegal=0, totalPlays=0, wins=[0,0,0,0], sharpWins=0, sharpGames=0;
  for(let i=0;i<n;i++){ const bench = i%4===0; const diffs = bench?["hard","easy","easy","easy"]:["medium","medium","medium","medium"];
    const r = simGame((i*2654435761 + 12345)>>>0, diffs); done++; totalPlays+=r.plays; illegal+=r.illegal; if(r.stalled) stalls++; else wins[r.winner]++; if(bench){sharpGames++; if(r.winner===0) sharpWins++} }
  return {done, stalls, illegal, avgPlays:+(totalPlays/done).toFixed(1), wins, sharpWins, sharpGames};
}
module.exports = { RANKS, SUITS, rk, st, cardCode, FIVECAT, DEFAULT_RULES, mulberry32, makeDeck, shuffle, straightInfo, classify, beats, describe, genMoves, legalMoves, roundScore, PERSONALITIES, partitionCount, controlSpend, unseenList, unbeatable, W, chooseMove, ruleTests, simGame, runSimsHeadless, _pcache };
