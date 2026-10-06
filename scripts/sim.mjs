// The legality-and-termination gate, plus difficulty numbers.
//   npm run sim -- 300        (default 1000)
// Every game runs through the real reduce(), which throws on any illegal action, so
// "0 errors" is a proof, not a shadow implementation agreeing with itself.
import { pathToFileURL } from "node:url";
import { mulberry32 } from "../src/engine/cards";
import { deal, reduce } from "../src/engine/reducer";
import { DEFAULT_RULES } from "../src/engine/rules";
import { aiTurn } from "../src/ai/aiTurn";
import { clearPartitionCache } from "../src/ai/partition";

export const SIM_SEATS = [
  { name: "A", kind: "ai", personality: "marshal" },
  { name: "B", kind: "ai", personality: "outlaw" },
  { name: "C", kind: "ai", personality: "gambler" },
  { name: "D", kind: "ai", personality: "marshal" },
];

/** AI randomness is a second stream off the seed, so a game replays from its seed alone. */
export const aiRngFor = (seed) => mulberry32(seed ^ 0x9e3779b9);

export function playGame(seed, diffs, rules = DEFAULT_RULES) {
  const rng = aiRngFor(seed);
  let g = deal(seed, rules, SIM_SEATS);
  const actions = [];
  let errors = 0;
  while (g.phase === "playing" && actions.length < 600) {
    const a = aiTurn(g, g.turn, rng, diffs[g.turn]);
    try {
      g = reduce(g, a);
    } catch (e) {
      errors++;
      console.error(`seed ${seed} step ${actions.length}: ${e.message}`);
      break;
    }
    actions.push(a);
  }
  return {
    winner: g.phase === "roundover" ? g.turn : -1,
    plays: actions.filter((a) => a.type === "PLAY").length,
    passes: actions.filter((a) => a.type === "PASS").length,
    errors,
    stalled: g.phase === "playing",
    counts: g.players.map((p) => p.hand.length),
    actions,
  };
}

const MATCHUPS = [
  { name: "all Regular", diffs: ["medium", "medium", "medium", "medium"], bench: null },
  { name: "Card sharp vs three Greenhorns", diffs: ["hard", "easy", "easy", "easy"], bench: 0 },
  { name: "Regular vs three Greenhorns", diffs: ["medium", "easy", "easy", "easy"], bench: 0 },
  { name: "Card sharp vs three Regulars", diffs: ["hard", "medium", "medium", "medium"], bench: 0 },
];

export function run(n, seedBase = 1000) {
  clearPartitionCache();
  const t0 = Date.now();
  const stats = MATCHUPS.map(() => ({ games: 0, wins: [0, 0, 0, 0], plays: 0 }));
  let errors = 0;
  let stalls = 0;
  for (let i = 0; i < n; i++) {
    const m = i % MATCHUPS.length;
    const r = playGame(seedBase + i, MATCHUPS[m].diffs);
    errors += r.errors;
    if (r.stalled) stalls++;
    else stats[m].wins[r.winner]++;
    stats[m].games++;
    stats[m].plays += r.plays;
  }
  return { n, errors, stalls, ms: Date.now() - t0, stats };
}

export function report(res) {
  const lines = [];
  lines.push(`${res.errors === 0 && res.stalls === 0 ? "✓" : "✗"} ${res.n} games in ${res.ms} ms`);
  lines.push(`illegal actions : ${res.errors}`);
  lines.push(`stalled games   : ${res.stalls}`);
  res.stats.forEach((s, i) => {
    const m = MATCHUPS[i];
    const avg = (s.plays / Math.max(1, s.games)).toFixed(1);
    if (m.bench === null) lines.push(`${m.name.padEnd(32)} ${s.games} games, seat wins ${s.wins.join("/")}, avg ${avg} plays`);
    else {
      const pct = Math.round((100 * s.wins[m.bench]) / Math.max(1, s.games));
      lines.push(`${m.name.padEnd(32)} ${s.games} games, seat 0 wins ${s.wins[m.bench]} (${pct}%; even odds would be 25%)`);
    }
  });
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2]) || 1000;
  const res = run(n);
  console.log(report(res));
  if (res.errors === 0 && res.stalls === 0) console.log("✓ legality and termination gates pass");
  else {
    console.log("✗ legality and termination gates FAIL");
    process.exit(1);
  }
}
