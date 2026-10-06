const fs = require("fs"), path = require("path");
const [s, st, out] = process.argv.slice(2);
// 1) AST (inlined base64 pack in the Saloon Edition) -> files
const S = fs.readFileSync(s, "utf8");
const m = S.match(/^const AST = (.*?);?\s*$/m);
const a = JSON.parse(m[1].replace(/;\s*$/, ""));
const ext = { "image/png": "png", "audio/ogg": "ogg", "audio/mpeg": "mp3", "image/jpeg": "jpg" };
let n = 0;
const walk = (o, pre) => { for (const k in o) { const v = o[k]; if (typeof v === "string") { const mt = v.match(/^data:([^;]+);base64,(.*)$/s); if (!mt) continue; const f = path.join(out, (pre + k).replace(/\./g, "_") + "." + (ext[mt[1]] || "bin")); fs.writeFileSync(f, Buffer.from(mt[2], "base64")); n++; } else walk(v, pre + k + "."); } };
walk(a, ""); console.log("extracted", n, "files to", out);
// 2) Stockroom consts
const ST = fs.readFileSync(st, "utf8");
const consts = [...ST.matchAll(/^const ([A-Z_]+) = /gm)].map(x => x[1]);
console.log("stockroom consts:", consts.join(", "));
const grab = (name) => { const r = new RegExp("^const " + name + " = (.*?);?\\s*$", "m"); const mm = ST.match(r); if (!mm) return null; try { return JSON.parse(mm[1].replace(/;\s*$/, "")); } catch (e) { return "PARSE_FAIL " + e.message + " head=" + mm[1].slice(0, 160); } };
const A = grab("ASSETS");
if (Array.isArray(A)) {
  console.log("\n=== ASSETS (" + A.length + ") excluding Jorel's pack ===");
  const g = {}; for (const x of A) { if (/jorel/i.test(x.cat || "")) continue; (g[x.group || x.cat] ||= []).push(x); }
  for (const k in g) { console.log("\n[" + k + "]"); for (const x of g[k]) console.log("  " + x.name + "  " + (x.dims || x.dur || "") + "  " + Math.round(x.bytes / 1024) + "KB  " + String(x.rec && x.rec.verdict).toUpperCase() + " — " + String(x.rec && x.rec.reason).slice(0, 240)); }
} else console.log("ASSETS:", A);
for (const name of consts) { if (name === "ASSETS") continue; const v = grab(name); console.log("\n=== " + name + " ===\n" + (typeof v === "string" ? v : JSON.stringify(v, null, 1).slice(0, 12000))); }
