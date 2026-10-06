// Differential check: the TypeScript engine + AI against the browser prototype's engine,
// driven move by move on the same seeds with the same random stream. The prototype's
// functions are loaded from reference/proto-oracle.cjs (its <script> with the DOM cut away;
// the same file lives in the handoff package's reference/ folder, this copy is vendored so a
// bare clone of tally-web can run the check).
//   npm run verify:port -- 2000
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { makeDeck, mulberry32, shuffle } from "../src/engine/cards";
import { classify } from "../src/engine/combos";
import { beats } from "../src/engine/compare";
import { deal, reduce } from "../src/engine/reducer";
import { DEFAULT_RULES, withRules } from "../src/engine/rules";
import { publicView } from "../src/engine/state";
import { chooseMove } from "../src/ai/choose";
import { genMoves, legalMoves } from "../src/ai/moves";
import { partitionCount } from "../src/ai/partition";
import { PERSONALITIES } from "../src/ai/personalities";

const require = createRequire(import.meta.url);
const o = require("../reference/proto-oracle.cjs");

const KEYS = ["marshal", "outlaw", "gambler", "marshal"];
const SEATS = KEYS.map((k, i) => ({ name: "S" + i, kind: "ai", personality: k }));

/** The prototype's simGame loop, instrumented to record every decision. */
function oracleTrace(seed, diffs) {
  const rng = o.mulberry32(seed);
  const deck = o.shuffle(o.makeDeck(), rng);
  const hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  hands.forEach((h) => h.sort((a, b) => a - b));
  const g = { players: hands.map((h) => ({ hand: h })), turn: hands.findIndex((h) => h.includes(0)), lastPlay: null, lastBy: null, passesInRow: 0, played: new Set(), history: [] };
  const trace = [];
  let plays = 0;
  while (plays < 600) {
    const me = g.turn;
    const hand = g.players[me].hand;
    const pub = { me, counts: g.players.map((p) => p.hand.length), lastPlay: g.lastPlay, passesInRow: g.passesInRow, played: g.played, need3D: o.DEFAULT_RULES.mustLeadWith3D && g.lastPlay === null && g.history.length === 0 };
    const pers = Object.assign({ key: KEYS[me] }, o.PERSONALITIES[KEYS[me]]);
    const mv = o.chooseMove(pub, hand, pers, o.DEFAULT_RULES, rng, diffs[me]);
    trace.push({ seat: me, cards: mv ? mv.cards.slice() : null });
    if (mv) {
      const gone = new Set(mv.cards);
      g.players[me].hand = hand.filter((c) => !gone.has(c));
      mv.cards.forEach((c) => g.played.add(c));
      g.lastPlay = mv;
      g.lastBy = me;
      g.passesInRow = 0;
      g.history.push(1);
      plays++;
      if (g.players[me].hand.length === 0) return { trace, winner: me, hands };
    } else {
      g.passesInRow++;
      if (g.passesInRow >= 3) {
        g.lastPlay = null;
        g.passesInRow = 0;
        g.turn = g.lastBy;
        continue;
      }
    }
    g.turn = (g.turn + 1) % 4;
  }
  return { trace, winner: -1, hands };
}

/** The same game through the real reducer and the TS chooseMove, sharing one rng stream like the prototype did. */
function portTrace(seed, diffs) {
  const rng = mulberry32(seed);
  shuffle(makeDeck(), rng); // advance the stream exactly as the prototype's deal did (deal() below shuffles identically on its own)
  let g = deal(seed, DEFAULT_RULES, SEATS);
  const trace = [];
  let steps = 0;
  while (g.phase === "playing" && steps++ < 1000) {
    const me = g.turn;
    const mv = chooseMove(publicView(g, me), g.players[me].hand, PERSONALITIES[KEYS[me]], DEFAULT_RULES, rng, diffs[me]);
    trace.push({ seat: me, cards: mv ? mv.cards.slice() : null });
    g = reduce(g, mv ? { type: "PLAY", player: me, cards: mv.cards } : { type: "PASS", player: me });
  }
  return { trace, winner: g.phase === "roundover" ? g.turn : -1, hands: g.players.map((p) => p.hand), state: g };
}

function sameTrace(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].seat !== b[i].seat) return false;
    if ((a[i].cards === null) !== (b[i].cards === null)) return false;
    if (a[i].cards && a[i].cards.join(",") !== b[i].cards.join(",")) return false;
  }
  return true;
}

/** Unit-level agreement on random hands: classification, comparison, move generation, partition. */
function unitDiff(seeds) {
  const rng = mulberry32(99);
  const rules = [DEFAULT_RULES, withRules({ straightWrap: true, flushSuitFirst: false })];
  let fails = 0;
  for (let i = 0; i < seeds; i++) {
    const deck = shuffle(makeDeck(), rng);
    const n = [1, 2, 3, 4, 5][Math.floor(rng() * 5)];
    const a = deck.slice(0, n);
    const b = deck.slice(n, 2 * n);
    const fail = (...what) => {
      fails++;
      if (fails <= 10) console.error(...what);
    };
    for (const R of rules) {
      const ca = classify(a, R);
      const oa = o.classify(a, R);
      if ((ca && ca.type + ":" + ca.key) !== (oa && oa.type + ":" + oa.key)) fail("classify", a, ca, oa);
      const cb = classify(b, R);
      const ob = o.classify(b, R);
      if (ca && cb && beats(ca, cb) !== o.beats(oa, ob)) fail("beats", a, b);
    }
    const hand = deck.slice(0, 13).sort((x, y) => x - y);
    for (const R of rules) {
      const gm = genMoves(hand, R).map((m) => m.cards.join(","));
      const om = o.genMoves(hand, R).map((m) => m.cards.join(","));
      if (gm.join("|") !== om.join("|")) fail("genMoves order/content differs for", hand, R);
      const last = classify(deck.slice(13, 14), R);
      const lm = legalMoves(hand, last, R, false).map((m) => m.cards.join(","));
      const olm = o.legalMoves(hand, last, R, false).map((m) => m.cards.join(","));
      if (lm.join("|") !== olm.join("|")) fail("legalMoves differs", hand);
      if (partitionCount(hand, R) !== o.partitionCount(hand, R)) fail("partitionCount differs", hand, R);
    }
  }
  return fails;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2]) || 1000;
  const t0 = Date.now();
  const unitFails = unitDiff(3000);
  const DIFFS = [
    ["medium", "medium", "medium", "medium"],
    ["hard", "easy", "easy", "easy"],
    ["easy", "hard", "medium", "easy"],
  ];
  let games = 0;
  let mismatches = 0;
  let winnerAgree = 0;
  for (let i = 0; i < n; i++) {
    const seed = (i * 2654435761 + 12345) >>> 0;
    const diffs = DIFFS[i % DIFFS.length];
    const a = oracleTrace(seed, diffs);
    const b = portTrace(seed, diffs);
    games++;
    if (!sameTrace(a.trace, b.trace)) {
      mismatches++;
      if (mismatches <= 5) {
        const k = a.trace.findIndex((t, j) => !b.trace[j] || t.seat !== b.trace[j].seat || String(t.cards) !== String(b.trace[j].cards));
        console.error(`seed ${seed} (${diffs.join("/")}) diverges at step ${k}: oracle`, a.trace[k], "port", b.trace[k]);
      }
    } else if (a.winner === b.winner) winnerAgree++;
  }
  console.log(`unit-level mismatches (classify/beats/genMoves/legalMoves/partition over 3000 random hands x 2 rule sets): ${unitFails}`);
  console.log(`full games compared: ${games}; identical move-for-move: ${games - mismatches}; same winner: ${winnerAgree}; ${Date.now() - t0} ms`);
  if (unitFails === 0 && mismatches === 0) console.log("✓ the TypeScript port is move-for-move identical to the prototype");
  else {
    console.log("✗ port differs from the prototype");
    process.exit(1);
  }
}
