# Tally Two — handoff package (reconstructed)

This folder is the handoff package the web build (`../tally-web/`) was built from: the browser prototype that is the behaviour spec, the asset pack it uses, the plan that turns it into a Vite + React app, and the documents that record the decisions behind it.

**It is a reconstruction.** The original handoff folder (the plan's `H`, `/Users/jordanboudreau/Desktop/Tally Two/tally-two-handoff`) was not on this machine. It was rebuilt on 2026-10-05 from the user's claude.ai artifacts and from the web build itself. What that means for each part:

| Path | Status | What it is |
| --- | --- | --- |
| `reference/tally-two-saloon.html` | **verbatim** (the artifact) | the browser prototype, "Tally Two — Saloon Edition": engine, AI, UI, sounds and six display sprites in one 2.4 MB file. **Line 327 is a 2.4 MB data-URI line; never open it in an editor** — read lines 1-326 and 328-1286. The plan's `P:<line>` references are about one line lower than the file on disk; search for the text. |
| `reference/tally-two-prototype-v1.html` | **verbatim** (the artifact) | the earlier prototype (1,190 lines, external Google Fonts link), kept for history; the saloon file supersedes it |
| `reference/tally-two-stockroom.html` | **verbatim** (the artifact) | the Stockroom asset ledger page: every file in the pack with a verdict and a reason. Line 256 is 89 KB; do not read it directly — run `node reference/stockroom-extract.cjs reference/tally-two-saloon.html reference/tally-two-stockroom.html /tmp/stockroom-out` to print the verdicts and groups |
| `reference/proto-oracle.cjs` | **generated** here | the prototype's engine + AI + sim functions as a headless Node module, cut out of the saloon file by `make-oracle.cjs`; `tally-web`'s `npm run verify:port` plays against it |
| `reference/make-oracle.cjs`, `reference/stockroom-extract.cjs` | **new** here | the two helper scripts above |
| `assets/cards/` | **verbatim** | the 52-card atlas and card back at @1x/@2x/@3x (6 PNGs) |
| `assets/proto/` | **verbatim** (decoded from `P:327`) | the six display sprites: wood 96x96, felt 32x32, three portraits 64x64, wanted 61x71 |
| `assets/checker.png` | **verbatim** | the 32x32 crispness-probe checkerboard (109 bytes) |
| `assets/audio/sfx/` (73 `.ogg`), `assets/audio/music/` (5 `.ogg`) | **verbatim** | the Ogg Vorbis masters of the kept sound pack as they could be recovered |
| `assets/audio/m4a/{sfx,music}/` (34 + 3 `.m4a`) | **new** here | AAC transcodes of the 37 files the web build wires (iOS Safari cannot decode Vorbis); recipe in `../tally-web/docs/ASSETS.md` §4 |
| `docs/WEB-PLAN.md` | **verbatim** (the artifact) | the implementation plan, Sep 22, 2026 — the document the web build follows |
| `docs/DECISIONS.md`, `docs/ENGINE.md`, `docs/ASSET-DECISIONS.md`, `docs/BUILD-PLAN.md` | **re-created** here | reconstructed from the plan's citations, the code, the ledger and the artifacts; each file says what it was rebuilt from, and where it had to summarise rather than quote |
| `src/`, `scripts/` | **re-created, but they live in `../tally-web`** | the handoff's engine, AI, render maths and scripts were re-created as TypeScript directly in `tally-web/src/{engine,ai,render}` and `tally-web/scripts/` — the files the plan calls "verbatim copies" — and proven identical to the prototype (below). There is no second copy here on purpose |
| `docs/ASSET-MAP.md`, `docs/SKIA-SPIKE.md`, `assets/manifest.json`, `reference/README.md`, the tileset sheets (`assets/art/tilesets/`), Jorel's card pack, `assets/audio/probe.html` | **not reconstructed** | the plan cites them (crop provenance, the iPhone device matrix, loop durations, the Ogg probe); what it quotes of them has been folded into `DECISIONS.md`, `ASSETS.md` and `ARCHITECTURE.md` |

## Reading order

1. **Prove it runs.** In `../tally-web`: `nvm use 24 && npm install && npm run check`. Exit 0 means the engine type-checks with and without the DOM lib, the suites pass, 300 AI games end legally and the app builds.
2. **Open the prototype** (`reference/tally-two-saloon.html`) in a phone-sized browser window and play a round. Everything the web app does on the table, this file did first; it is the spec.
3. **Read `docs/DECISIONS.md`**: what was decided and why — Hong Kong rules with every disputed rule a flag, portrait phone, 96x128 cards at an integer scale, settings-only persistence, a pure reducer that throws on illegal actions, and "Hard is not measurably stronger than Medium".
4. **Read `docs/WEB-PLAN.md`**: §1-2 for what exists, §3 for the architecture (the three buckets in §3.2 are the one thing to hold in your head), §5 for the milestones and their gates, §8 for the open questions.
5. Then as needed: `docs/ENGINE.md` (the API, the action list, the AI turn recipe), `docs/ASSET-DECISIONS.md` (the triage) with `../tally-web/docs/ASSETS.md` (what is wired), `docs/BUILD-PLAN.md` (the original React Native plan, summarised).

## Verification numbers

Everything the web build's engine and AI do was checked against the prototype, not just re-typed from it:

- `npm run verify:port -- 600` (in `../tally-web`) replays **600 games move-for-move** against `reference/proto-oracle.cjs` — same seeds, same random stream, three difficulty mixes — plus 3,000 random hands x 2 rule sets through `classify`/`beats`/`genMoves`/`legalMoves`/`partitionCount`: **0 mismatches**, 600/600 identical, 600/600 same winner.
- `npm run sim -- 300` runs 300 AI-only games through the real `reduce()`, which throws on any illegal action: **0 illegal actions, 0 stalls**. Its difficulty numbers (75 games per matchup): **Card sharp beats three Greenhorns 64 %, Regular beats three Greenhorns 63 %, Card sharp beats three Regulars 33 %** (even odds would be 25 %) — Hard is not stronger than Medium, which is the finding `DECISIONS.md` records.
- Audio: the kept pack is Ogg Vorbis; iOS Safari cannot decode it in Web Audio and ffmpeg is not installed here, so the 37 wired files were transcoded to AAC `.m4a` with libsndfile (python `soundfile` in a venv) + macOS `afconvert` (`-f m4af -d aac -b 128000` for SFX, `-b 160000` for music, `-q 127 -s 0`). `afinfo` confirms gapless metadata — ost_1: 5,251,476 valid frames + 2,112 priming = 119.081 s. Loop ends: ost_1 119.081 s, ost_3 107.714 s, ost_4 103.109 s, CardsMovingLoop03 10.069 s.
- Deviations from the plan's slot table recorded in `../tally-web/docs/ASSETS.md`: `sfx-play-five` wires CardSlide 01/03/05 (the Stockroom ledger marks `CardSlide` LIVE and the files exist; the plan's substitute CardGenericMovesLong 05/06/07 is not used); `music-title` stays silent; the app icon is composed from the wood tile and the card back rather than cut from B-11.
- Toolchain: Node 24.15 through nvm (the plan was written against 22.17); the sim and the verifier run with `--experimental-strip-types`, which Node 24 accepts; Vite 8.3, React 19.3, TypeScript 6.0, Vitest 5.0, vite-plugin-pwa 2.0.
