// Build a headless Node module from the prototype's engine + AI + test/sim functions (no DOM).
const fs = require("fs");
const [src, out] = process.argv.slice(2);
const js = fs.readFileSync(src, "utf8");
const cut = (from, to) => { const a = js.indexOf(from); const b = js.indexOf(to, a); if (a < 0 || b < 0) throw new Error("marker missing: " + from + " / " + to); return js.slice(a, b); };
const engine = cut("const RANKS", "/* ============================================================\n   GAME STATE");
const tests  = cut("function ruleTests(){", "function simGame(");
const sim    = cut("function simGame(", "function runSims(");
const mod = `"use strict";\n${engine}\n${tests}\n${sim}\n
function runSimsHeadless(n){
  let done=0, stalls=0, illegal=0, totalPlays=0, wins=[0,0,0,0], sharpWins=0, sharpGames=0;
  for(let i=0;i<n;i++){ const bench = i%4===0; const diffs = bench?["hard","easy","easy","easy"]:["medium","medium","medium","medium"];
    const r = simGame((i*2654435761 + 12345)>>>0, diffs); done++; totalPlays+=r.plays; illegal+=r.illegal; if(r.stalled) stalls++; else wins[r.winner]++; if(bench){sharpGames++; if(r.winner===0) sharpWins++} }
  return {done, stalls, illegal, avgPlays:+(totalPlays/done).toFixed(1), wins, sharpWins, sharpGames};
}
module.exports = { RANKS, SUITS, rk, st, cardCode, FIVECAT, DEFAULT_RULES, mulberry32, makeDeck, shuffle, straightInfo, classify, beats, describe, genMoves, legalMoves, roundScore, PERSONALITIES, partitionCount, controlSpend, unseenList, unbeatable, W, chooseMove, ruleTests, simGame, runSimsHeadless, _pcache };
`;
fs.writeFileSync(out, mod);
console.log("oracle written:", out, mod.length, "chars");
