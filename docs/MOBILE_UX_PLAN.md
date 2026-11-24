# Plan: Mobile UI/UX and motion pass

Status: **in progress, on `main`**. Phases 0–4 are done (see "Progress" at the end); Phase 5 is next. Decisions taken 2026-11 (§12): flick-to-play on by default; opponents are dealt to; no haptics for now (visual feedback only); losers' leftover cards are revealed only on Greenhorn; swipe-to-select adopted (reorder moves to press-and-hold, then drag).

Scope: `src/phaser/**`, `src/game/timing.ts`, `src/render/*Layout.ts`, a few new selectors in `src/game/selectors.ts`, and two new settings. The shell bridge is untouched. The engine, AI, stores, and audio stay as they are. This plan builds on the Phaser port (`PHASER_MIGRATION.md`) and keeps its contracts: the 440-px logical canvas, integer rest poses, the size floors (`theme.ts` `FS_MIN` / `TAP`), no rules in scenes, and no layout numbers outside `render/`.

## Prerequisite: `PERF_PLAN.md` lands first

This plan starts after the perf plan is implemented and committed, and builds on it instead of re-doing it. Where the two touch the same code:

| Perf plan item | What this plan does with it |
| --- | --- |
| 1.3 render on demand gets a live-tween counter and `DIRTY_MS` around 100 | `fx` handles (§2.2) use that counter and `markDirty()`; looping pulses count as animating only while visible. Re-check F2 (the torn card) first, since it may already be fixed. |
| 1.4 painted textures packed into one runtime atlas; 2.1 prewarm every `painted()` key in `Boot` | Every new painted state here (disabled and primary button faces, the playable glow, the edge glow, the "LAST CARD" tag, the coach mark, the deck) is added to the prewarm list and the atlas. No first-use rasterising during motion. |
| 2.2 BitmapText for counts, tallies and deltas | The count tick-down (§5.5) and poster count-up (§6.3) animate BitmapText, never `Text.setText` per frame. |
| 2.3 frame-aligned `phaserClock` | The `Sequencer` / skip (§2.5) and any presentation delays run on it, so skipping and pausing have one owner. |
| 2.4 deal sounds scheduled on the audio clock | The four-seat deal (§6.1) takes its per-card offsets from the same schedule, so each card lands on its tick. |
| 2.5 easing review (no long `Back.Out` settle; a snap on completion) | The motion tokens (§2.1) adopt that rule: `land` overshoot only on short (≤ 300 ms) moves, settles use `Cubic.Out` or a spring. |
| 3.2 `snap()` to device pixels replaces `Math.round` | Every "integer rest pose" in this plan means `snap()`; `fx.flyTo` ends on `snap()`. |
| 6 perf gates (no long task > 50 ms, p95 frame time) | Every phase here must pass them, so the swipe, deal and trick-clear animations are measured, not assumed. |

Before starting: confirm the perf work is committed (`git log`), rerun `npm run check` and the perf baseline, and re-read the files above, because line-level details in §0 may have moved.

## 0. Where it stands (audit, 2026-11, iPhone 15 landscape 852x393 in Chromium, `?seed=3`)

What already works: a landscape layout with the controls in the right-thumb zone; tap targets of 60 logical px or more; the select lift; a two-stage fly-in for plays; a staggered deal; render on demand; reduced-motion support; and audio cues for every action.

Problems found, most important first:

| # | Finding | Where |
| --- | --- | --- |
| F1 | **Dimmed cards bleed through each other.** A dim card is drawn at `alpha 0.85`, so in an overlapping fan you can see the card underneath and the saloon behind it (mirrored indices show through). It looks broken. | `cards.ts` `#draw` |
| F2 | **A card rendered torn mid-flight** (a diagonal cut across the face) in one capture of the play fly. The cause is unknown: render-on-demand skipping a frame, the `destination-out` shadow texture, or the capture itself. Reproduce it on a device first. | `Trick.ts`, `onDemand.ts`, `cards.ts` |
| F3 | **A disabled primary button still looks like the main call to action.** "Play" at 50 % alpha stays amber and is the brightest thing in the column, even while the status line says "you'll have to pass". The real action, Pass, looks secondary. | `widgets.ts` `Button.setEnabled`, `Side.ts` |
| F4 | **No "your turn" moment.** Only an AI badge gets the active ring. When the turn comes to the player, only a 15-px status line changes (plus a sound, which may be muted). | `Seat.ts`, `Side.ts` |
| F5 | **Your own play does not leave your hand.** The played cards are destroyed in the hand, and new cards appear at a fixed point (`HAND_DROP`) under the felt. There is no continuity from finger to table. | `Hand.ts` `update`, `Trick.ts` `#make` |
| F6 | **The trick clear is a hard cut.** Groups `destroy()` with no motion, so you cannot see who took the trick. Passes are an instant stamp. | `Trick.ts` `update`, `Seat.ts` |
| F7 | **The deal comes out of nowhere.** Cards fly in from off-screen top-left. There is no deck, and opponents are not dealt to (their counts just read 13). | `Hand.ts` `#layout` |
| F8 | **Selection is hard to hit and hard to read.** Overlapped cards expose about 41–58 px. Multi-card plays need one tap per card. The lift is 14 px and partly covered by the felt edge. A tap that makes no legal move gives no explanation. | `Hand.ts`, `fanLayout.ts` `SELECT_LIFT` |
| F9 | **Buttons have only a texture swap for feedback.** There is no scale "squish", no haptics (iOS Safari has no `navigator.vibrate`, and the bridge's `haptic` only fires for deal/slap/win), and tapping a disabled control gets no response. | `widgets.ts`, `store.ts` |
| F10 | **Overlays and screens cut in.** The poster is a 180-ms alpha fade and its numbers are static. Sheets pop in. Title → table is a scene swap. A resize restarts every scene, which loses any in-flight motion. | `Poster.ts`, `sheet.ts`, `director.ts` |
| F11 | **Motion numbers are scattered.** `motion.ts` holds some, and there are literals in `Title.ts` (200/420/500), `Poster.ts` (180) and `widgets.ts` (150). This breaks the "every ms in one place" rule in `timing.ts`. Reduced motion is read once at module load and is not a setting. | `motion.ts` |
| F12 | **The title is static apart from the door swing.** No idle life (lamp flicker, door sway) and no attract motion on the primary button. | `Title.ts` |

## 1. Target principles

These define "best practice" for this game. Every phase below is checked against them.

1. **Feedback within 100 ms of every touch**, visual (and audio where it fits). Nothing the player touches is ever silent. No haptics for now (§12).
2. **One clear primary action at a time.** The primary style follows whichever action is actually available: Play when a legal play is selected, Pass when forced, Next round on the poster.
3. **Object permanence.** A card is one object for its whole life: deck → hand → felt → discard. It always moves and never teleports. Uses the FLIP technique: record the start position, move the object, animate the difference.
4. **Motion explains state:** whose turn, who played, who took the trick, who's low, what scored.
5. **Durations follow the mobile norm.** Micro-feedback 80–150 ms, UI transitions 200–350 ms, emphasis 400–700 ms. Ease-out to enter, ease-in to exit, a spring/back for things that land. Nothing blocks input longer than it must. The player can always tap through (skip) a long animation.
6. **Thumb-first.** Primary controls in the bottom-right thumb arc, gestures as shortcuts (never the only way), and hit areas larger than the art.
7. **Accessibility and comfort.** A reduced-motion setting (as well as the OS flag), colour plus shape for state (not colour alone), and nothing that flashes more than 3 Hz.
8. **60 fps on an iPhone SE-class device.** Frame cost stays flat while idle (keep render on demand), with no texture regeneration and no allocation in hot paths.

## 2. Phase 0: Foundations (no visible change) — 2–3 d

1. **Motion tokens.** Move every presentation duration and easing into one place. Make `src/game/timing.ts` the single source and add a `MOTION` block, or add a PURE `src/render/motion.ts` and extend the "one place" rule to it:
   - `MICRO 100`, `PRESS 80`, `SLIDE 160`, `UI_IN 260`, `UI_OUT 180`, `EMPHASIS 450`, plus the existing `PLAY_FLY_MS`, `DEAL_*`, `BARK`, `ANNOUNCE`.
   - Named easings: `enter: Cubic.Out`, `exit: Cubic.In`, `land: Back.Out(1.4)`, `spring` (a custom ease or `Elastic.Out(1, 0.6)`).
   - Remove the literals in `Title.ts`, `Poster.ts` and `widgets.ts`. Extend `boundary.test.ts` so it fails on any numeric `duration:` / `delay:` / `after(<n>)` literal under `src/phaser/**`.
2. **`src/phaser/fx.ts`, a juice kit.** Small, pure helpers built on tweens, each respecting reduced motion: `press(obj)` (scale to 0.94 and back), `pop(obj)`, `shake(obj, px)`, `pulse(obj)` (looping, cancelable), `flyTo(obj, x, y, opts)` that ends on an integer pose, `countUp(text, from, to)`, `stagger(list, fn)`. Each returns a handle with `.skip()`, which jumps to the end state.
3. **Live reduced-motion setting.** Add `opts.motion: "full" | "reduced"`, defaulting from `prefers-reduced-motion` and watching the media query. Replace the `reduced` constant with `settings.opts.motion`. Under reduced motion, positional moves become ≤ 120 ms cross-fades, there is no shake or pulse, and staggers become 0.
4. **Haptics: deferred.** No vibration work in this pass. The existing bridge `haptic` (deal/slap/win) stays as it is. `fx` helpers take an optional `feedback` kind (`select | invalid | turn | clear | win | press`) that is a no-op for now, so a later haptics port is a one-file change.
5. **Skippable sequencing.** Add a `Sequencer` per scene. A tap on the felt during a non-interactive animation (deal, trick clear, poster count-up) calls `.skip()` on the running handles. The store's timers still pace the AI, so skipping only shortens the visuals, never the game clock.
6. **Baselines.** Extend `e2e/play.mjs` to save screenshots per device (`e2e/shots/`) and record a Chromium performance trace of one round. This gives the frame-time baseline for Phase 6.

## 3. Phase 1: Fix the defects — 1–2 d

- **F1:** Dim with tint only (`setTint` around 0x8c8880 plus a dark overlay image drawn above the face, opaque), never with alpha. Add a test in `probe` that every hand card's face alpha is 1.
- **F2:** Reproduce on hardware at 60 fps with `?debug=render`, which forces a full render every frame.
  - If it disappears, the bug is in `onDemand.ts` (likely `animating()` missing a tween chain's gap between steps). Fix it by checking `tweens.getChains()` or marking dirty for the whole chain's duration.
  - If it persists, rebuild the shadow without `destination-out`: a separate opaque shadow image offset under the face.
- **F3:** Add `Button.setKind()` and a real disabled look: a desaturated oak face, dimmed label, no amber. `SideView` gives the primary style to whichever of Play / Pass is the move: Play if `exact`; Pass if `canPass && legal.length === 0`; otherwise neither is primary. The rule lives in a selector (`selectors.primaryAction(view)`), not in the scene.
- **F9 (part):** Tapping a disabled button calls `shake(4px)` and briefly flashes the status line. Status text already explains why.

## 4. Phase 2: The hand — 5–7 d

Everything here is in `Hand.ts` plus geometry in `fanLayout.ts`.

1. **Hit areas.**
   - Each card's interactive zone is its exposed strip plus the full height *above* it up to the lift, so a selected card is as easy to tap again.
   - The rightmost card gets its full width.
   - On canvases where the step drops below 44 logical px, raise the fan into a slight arc (y offset and ±1.5° rotation toward the ends, ending on whole px with angle 0 for the integer-pose rule at rest, or a documented exception for the arc) so each index corner stays visible.
2. **Swipe-to-select (adopted).** Press a card and slide sideways across the fan: every card the finger passes takes the *first card's new state*. If the first card was unselected, the swipe selects; if it was selected, the swipe deselects. One swipe picks a pair, a straight or a full house.

   **Gesture arbitration.** Every press on the hand resolves to exactly one gesture, in a small pure state machine (`render/handGesture.ts`, unit-tested with synthetic pointer traces; `Hand.ts` only feeds it events). All thresholds are tokens:

   | Gesture | How it starts | What it does |
   | --- | --- | --- |
   | **Tap** | released before `DRAG_THRESHOLD` (6 px) and before `HOLD_MS` | toggles the card (as today) |
   | **Swipe-select** | moves ≥ 6 px, mostly horizontal (\|dx\| > \|dy\|), before `HOLD_MS` | paints the selection across the cards passed |
   | **Flick-to-play** | moves ≥ 6 px, mostly *upward*, starting on an already-selected card, before `HOLD_MS` | drags the selected group; plays on release past the felt edge if `exact` (item 4) |
   | **Hold-to-rearrange** | held still for `HOLD_MS` (180 ms) | the card lifts and scales to 1.08 (this doubles as the peek, replacing item 6), then follows the finger to reorder as today |

   An upward move from an *unselected* card counts as swipe-select, so a sloppy thumb never plays anything.

   **Paint rules.**
   - *Range-based, not sticky.* The selection equals the press-time selection with every card between the first card and the card currently under the finger set to the paint state. Sliding back un-paints the cards the finger retreats from, so mistakes undo themselves before release.
   - *Hit-testing uses the fan geometry, not object hits.* The card under the finger is `fanLayout` index from `pointer.worldX`, using each card's exposed strip, so thin overlapped strips still register. Vertical drift is allowed anywhere from the felt edge down to the bottom of the screen.
   - *Commits live.* Each change calls `store.setSelection(...)`, so dimming, the Play button and the amber "playable" glow update as you swipe. Painting goes through the same `canToggle` guard as taps, so it works exactly when tapping does.
   - The `select` sound plays on each card that changes state, throttled to one every 40 ms. Each painted card does a 60-ms `pop`.
   - The paint resolution is pure: `paintSelection(pressSel, fromIdx, toIdx, order, state)` in `render/` or `game/`, unit-tested.

   **Reorder moves to hold-then-drag.** This replaces the current "any drag reorders". The 180-ms hold gets a visible response: the card lifts and casts a deeper shadow at once, so it is clear the card has been picked up. `suitSortRuns` on drop and the `reorder` sound stay as today.

   **Settings.** "Swipe to select" is **on by default**. Turned off, sideways drags reorder immediately, as today, and flick-to-play still works.

   **Discoverability.** On the first deal with Hints on (the first-time player default), a one-time coach mark shows a finger sliding across two cards with "Swipe to pick several". It dismisses on the first swipe or after 4 s, and is never shown again (stored in settings as `seen.swipeHint`).

   **Follow-on changes.**
   - `e2e/play.mjs`: the existing "drag the 3♦ to the right end" check becomes a hold-then-drag. New checks: a swipe over 3 cards selects 3; sliding back un-paints; a swipe starting on a selected card deselects; an upward drag from an unselected card plays nothing.
   - `README.md` and `ARCHITECTURE.md` §9 "Hand order" text is updated to describe the new gestures.
3. **Clearer selection.**
   - Raise `SELECT_LIFT` from 14 to 26 using the `land` ease, keeping the ring and deep shadow.
   - Move the hand row's z-order so lifted cards always draw above the felt edge.
   - Selected cards that form a legal play (`exact !== null`) get a soft amber under-glow on the group, which is the "this can be played" signal.
4. **Flick to play.** Dragging the selected group upward past the felt's edge (≥ 40 px, velocity-assisted) plays it if `exact`. Otherwise the group springs back with a `shake`. **On by default** (with a Settings switch to turn it off). This is a shortcut only: the Play button stays. Tapping or dragging a single card must never play it: the flick only applies to an already-selected group dragged upward, so it cannot collide with tap-to-select or sideways reorder.
5. **Hand → felt continuity (F5).** On the human's PLAY, the hand hands its `CardView`s to `TrickView`, using an `adopt(cards, fromWorldPos)` API, instead of destroying them. The trick animates them from their exact hand positions, scaling 96→72 along a slight arc, with the existing stack-then-spread. The remaining hand closes the gap with `SETTLE_MS` as today.
6. **Peek.** This folds into hold-to-rearrange. The 180-ms hold lifts the card at 1.08×; holding still for 400 ms more grows it to 1.5× above the fan until the finger moves or lifts. Useful on the SE, where indices are small.
7. **Invalid-tap feedback.** Tapping a card that cannot join any legal move (`live` excludes it) gives a 4-px shake. On the first occurrence per match, the status line shows a short reason from `copy.ts`.

## 5. Phase 3: Turn flow and table readability — 3–4 d

1. **Your turn (F4).** When the turn passes to the human:
   - A soft amber edge-glow pulses once along the top of the hand row.
   - The primary button (per Phase 1) does a single `pop`.
   - The status line slides in (and the existing `yourTurn` sound plays).
   - After 8 s idle, one gentle `pulse` repeats on the primary button (nothing on a timer that nags; one reminder only).
2. **Opponent turn.**
   - The active badge's ring breathes, a slow 1.2-s alpha loop (cheap: one image).
   - Animated "…" thinking dots sit under the name while the AI thinks, driven by the store's think timer so they stop exactly when it plays.
   - The play still flies from the portrait. Add a small portrait "nudge" (2-px lunge toward the felt) at launch.
3. **Pass.** The "passed" stamp drops in at scale 1.4 → 1 with `land` easing, plus `pass` audio (already present).
4. **Trick clear (F6).** When the last pass clears the trick:
   - Hold for 250 ms so the winning play is read.
   - The winning group gets an amber flash.
   - All groups slide together toward the winner's badge (or toward the hand for the human), scaling to 0.5 and fading.
   - The winner's badge `pop`s.
   - Requires the clear's winner, which `trickStart` / `lastBy` already provide, exposed as `selectors.trickWinner`.
5. **Counts and danger.** The card count ticks down with a tiny `pop` per play. At ≤ 3 cards the count turns red (as today) and adds a one-shot shake. At 1 card there is a persistent small "LAST CARD" tag on the badge (shape plus colour, not colour alone).
6. **Sign and status.** Text changes cross-fade over 120 ms instead of snapping. Pass the text through `fitWidth` / `maxLines` as today.

## 6. Phase 4: Deal and round transitions — 3–4 d

1. **Deal (F7). Decided: opponents are dealt to.**
   - A face-down deck sits centre-felt (`card_back`).
   - It deals round-robin to all four seats: 52 card backs, 14 ms stagger, opponents' cards shrinking into their portraits and their counts ticking up.
   - The player's cards land face-down in the fan, then flip in a wave (scaleX 1→0, swap frame, 0→1; 220 ms, 25 ms stagger), then the sort settles.
   - Total ≤ 1.6 s at `normal` speed and skippable by tap. Keep `DEAL_STAGGER_MS` semantics: rename it or add a `DEAL_SEAT_STAGGER_MS`.
2. **Round end.**
   - The winning last card gets a 300-ms hold and a slow-motion slap (scale 1.15 → 1, small camera shake of 2 px).
   - **Greenhorn only** (`opts.difficulty === "easy"`): the losers' leftover hands then fan face-up over their badges (about 1.5 s, skippable, staying until the poster appears), because remaining cards *are* the penalty and seeing them teaches. On Regular and Card sharp the hands stay hidden. The rule is one selector, `selectors.revealLeftovers(game, opts)`, never an `if` in the scene. Unit-test it for all three difficulties.
3. **Poster (F10).**
   - The paper drops in from above with `spring` easing, 450 ms, and a slight rotation that settles to 0.
   - The rows stagger in at 60 ms each.
   - Round deltas count up, and totals tick from the old to the new value with the `tally` sfx per tick (throttled).
   - Buttons enable after the count, or immediately on a skip tap.
   - On close, the poster lifts away (`UI_OUT`) before the next deal starts.
4. **Final round / match over.** Keep the banner, but slam it in with a `land` ease. The final poster gets a confetti-free "gold" variant (an amber rule, a sparkle on the winner's frame), on theme for a saloon.

## 7. Phase 5: Screens, sheets and navigation — 2–3 d

1. **Scene transitions.**
   - Title → Table: the doors swing open, then a 300-ms camera zoom through the doors with a cross-fade (not a cut).
   - Table → Title (Saddle up): fade through `oakDeep`.
   - The director owns transitions (`transition(from, to, kind)`), so scenes stay transition-agnostic.
2. **Sheets.** Settings and How to play slide up from the bottom (`UI_IN`, `enter`) over a dim that fades in. They close by:
   - tapping the dim,
   - a downward swipe on the panel's header (drag-to-dismiss with a velocity threshold),
   - or an explicit ✕ button (TAP-sized, top-right).
   The scroll body gets momentum and rubber-band ends (it currently tracks the finger only).
3. **Resize without amnesia.** Today a viewport change restarts every scene. Change this to a `relayout()` path that recomputes `tableLayout` and tweens views to their new rects (`SLIDE`). A restart is kept only when the resolution changes (dpr/zoom bucket), since textures must be re-rasterised. This covers rotation, Safari's toolbar collapse, and the island side switching.
4. **Title life (F12).** A lamp flicker (random alpha jitter on the glow, ≤ 2 Hz), a slow ±1° door sway every few seconds, and a breathing `pulse` on "Deal me in" after 3 s idle. All of it stops under reduced motion.
5. **Settings additions:** Motion (Full / Reduced), "Flick to play" (on by default), and "Swipe to select" (on by default). The `Picker` / `Switch` already exist.

## 8. Phase 6: Performance and robustness — 2 d (runs alongside Phases 2–5)

- **Pool `CardView`s:** 52 face cards plus about 16 backs, created once per scene and recycled between hand, trick and deck (this goes with the object-permanence work in Phase 2.5). No `new CardView` during a round.
- **Painted textures:** everything is pre-baked at scene create (the button up/down/disabled faces, glows, badge states). Assert in DEV that no `painted()` cache miss happens after the first 2 s of a round.
- **Render on demand:** `fx` handles call `markDirty()` for their full duration, and looping pulses count as "animating" only while visible. Confirm that idle frame cost returns to near zero within 300 ms of the last tween (perf trace vs the Phase 0 baseline).
- **Budget:** ≤ 120 live tweens at peak (the deal), ≤ 8 ms script per frame on an SE-class device, and no GC spikes over 4 ms during a trick clear.
- **WebGL context loss:** handle `contextlost` / `contextrestored` by re-running `painted()` bakes. It must be tested on device (backgrounding during the deal).

## 9. Phase 7: Tests and gates — 2 d

- **Unit (node):**
  - `motion` tokens are monotonic and within the duration bands in §1.5.
  - `selectors.primaryAction`, `trickWinner`, and swipe-paint resolution (a pure `paintSelection(start, passed, selection)`) in `render/` or `game/`.
  - `fanLayout` arc keeps index corners exposed at the three device widths.
- **`boundary.test.ts`:** no timing literals in `src/phaser/**`, and no `alpha` writes on `CardView.face`.
- **`e2e/play.mjs` additions:**
  - After any settle, every hand card has face alpha 1 and is at an integer pose.
  - A swipe across 3 cards selects 3.
  - Flick-to-play plays a legal pair.
  - A tap on disabled Play leaves the state unchanged.
  - With reduced motion, a full round completes with no tween over 120 ms.
  - A skip tap during the deal reaches an interactive hand within 200 ms.
  - Screenshot diffs against the Phase 0 baselines, with intentional changes re-baselined per phase.
- **Device checklist (manual, real iPhone):**
  - flick-to-play never fires on a sideways reorder or a single-card tap,
  - swipe vs reorder disambiguation with a thumb,
  - F2 gone,
  - 60 fps in Safari's frame meter during deal and trick clear,
  - rotation and toolbar collapse mid-animation.

## 10. Order and effort

| Phase | Depends on | Size |
| --- | --- | --- |
| 0 Foundations | — | 2–3 d |
| 1 Defects (F1, F2, F3) | 0 (tokens) | 1–2 d |
| 2 Hand (incl. swipe-to-select gesture machine) | 0, 1 | 5–7 d |
| 3 Turn flow | 0 | 3–4 d |
| 4 Deal / round / poster | 2 (pooling, adopt) | 3–4 d |
| 5 Screens / sheets / resize | 0 | 2–3 d |
| 6 Performance | in parallel | 2 d |
| 7 Tests | per phase | 2 d |
| **Total** | | **~3–4 weeks** |

Phase 1 is shippable on its own and fixes what players notice first. Phases 2 and 3 carry most of the "feels like a mobile game" value.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Swipe-to-select fights drag-to-reorder and flick | One gesture state machine with direction and time thresholds as tokens, unit-tested against recorded traces and tuned on a real phone. Range-based paint undoes mistakes before release. A Settings switch restores the old drag-to-reorder. |
| Existing players expect drag-to-reorder | A visible lift at 180 ms, the coach mark, and the Settings switch. |
| More motion slows the game for experienced players | All non-interactive sequences are skippable by tap. Game speed `fast` scales presentation tokens by 0.7. Reduced motion is a first-class setting. |
| Render-on-demand misses frames with chained/looping tweens (possibly F2) | `fx` handles own `markDirty`. A `?debug=render` full-render switch to compare. |
| Resize relayout drifts from a fresh build | e2e compares the probe rects after relayout with a fresh restart at the same size. |
| Accidental flick-to-play (on by default) | Only an already-selected group dragged upward past the felt edge plays, only if `exact`. Sideways motion never counts. A Settings switch turns it off. |

## 12. Decisions

| Question | Decision |
| --- | --- |
| Flick-to-play | **On by default**, with a Settings switch |
| Deal to opponents | **Yes**: all four seats are dealt to (≈ +0.6 s per round, skippable) |
| Haptics | **None for now**; the hook point stays a no-op (§2.4) |
| Reveal losers' leftover cards | **Greenhorn only** (`difficulty: "easy"`) |
| Swipe-to-select | **Adopted**, on by default; reorder becomes hold-then-drag (§4.2) |

## Progress

**Phase 0, done.**
- Motion tokens: `MOTION`, `EASE`, `DOORS_FRAMES_MS` and `COPIED_MS` in `game/timing.ts`. `boundary.test.ts` fails on a number literal in any `phaser/` tween or timer.
- Settings › Motion has three values: **Auto / Full / Reduced**, not the two first planned. Auto follows the device's reduce-motion flag live; the prototype's `reduceMotion: true` maps to Reduced.
- `phaser/fx.ts` provides `pop`, `shake`, `pulse` and `press`. Buttons squish under a finger.
- Baseline screenshots were captured with `e2e/play.mjs`. The perf branch already supplies the frame-time baseline (`e2e/perf.mjs`).

Deviations from the plan:
- The `Sequencer` / tap-to-skip (§2.5) moves to Phase 4, where the first skippable sequence (the deal) is built.
- The no-op haptic hook (§2.4) was not added: there was nothing to hang it on yet.
- `flyTo` / `countUp` / `stagger` join `fx.ts` with their first users (Phases 2 and 4).

**Phase 1, done.**
- **F1:** greyed and older trick cards are darkened by tint only and stay opaque. The e2e check "dimmed cards stay opaque" covers it.
- **F2:** see Phase 2: the tear is real, but only in headless Chromium.
- **F3:** `selectors.primaryAction` (tested) decides the amber button. Pass turns amber when nothing in hand can beat the table. A switched-off filled button has a flat dark face instead of 50 % alpha. `Button.setKind()` paints the alternative faces up front.
- **F9 (part):** a tap on a disabled button shakes it, and the status line pops.

**Phase 2, done.**
- **Gestures** (`render/handGesture.ts`, pure, 9 tests on pointer traces): tap, swipe-to-select (range-based, un-paints on the way back), flick-to-play (from a selected card, ≥ 40 px or flung, legal plays only), and hold-to-rearrange (180 ms; a 1.5× peek after another 400 ms).
- **Settings:** Swipe to select and Flick to play (both on by default), plus `swipeHintSeen`.
- **Hit areas:** one touch zone over the fan, from above a lifted card to the bottom edge. Each card owns its exposed strip (`cardIndexAt`).
- **Selection:** `SELECT_LIFT` 14 → 26. Selected cards glow amber when they form a legal play (a `glow` frame on the card sheet).
- **Hand → felt (F5):** your cards fly from exactly where they were, at their hand size, in a layer above the hand, then settle into the trick (`HandView.poseOf`, `TrickView.setOverLayer`).
- **"No" feedback:** tapping a card that cannot join a legal play wobbles it (`fx.wobble`, a rotation, because a sideways shake would fight the card's slide). A flick that is not a play springs back and wobbles.
- **Coach mark:** "Swipe across your cards to pick several" plus a sweeping finger, shown once to Hints-on players (`shouldCoach`, tested). It goes on the first swipe or after 4 s.
- **e2e:** new checks for hold-then-drag, swipe and un-paint, deselect by swipe, an upward drag from an unselected card plays nothing, and a flick plays the 3♦. 121 checks pass on all four devices.
- **Perf gate:** on the iPhone profile, 2 hitches, 46 draws per frame, worst frame 95 ms (was 113).
- **Docs:** README and ARCHITECTURE §9 describe the gestures.
- **Gesture timing uses `performance.now()`, not the frame clock.** A slow frame in headless Chromium had turned holds into swipes.

F2 found: the torn card mid-flight appears in about 2 of 14 rotating frames in **headless Chromium**, with render-on-demand on or off, and also before the perf work. **WebKit shows none** across the same frames. The amber ring draws fully while one triangle of the face is missing, which points at Chromium's software GL (SwiftShader), not the game. It still needs one look in real desktop Chrome with a GPU.

Not done in Phase 2:
- **The fan arc for narrow fans (§4.1).** It is only needed below a 44-px step: desktop (34 px) and the iPhone SE (41 px). The exposed-strip hit-testing already covers taps there.
- **A first-time status reason for invalid taps (§4.7).** The status line already says why ("doesn't beat it", "not a hand").
- **`CardView` pooling.** This stays in Phase 6; the hand hands cards over by pose instead (same on screen, no shared objects).

**Phase 3, done.**
- **Table events** (`selectors.tableEvents`, pure, 3 tests): from two consecutive states, whose turn just began, who played, who passed, and who took the trick (three passes cleared it). One call per render feeds every cue. A rebuild replays nothing.
- **Your turn (F4):** an amber glow swells once along the top of the hand row, and the asked-for control (`primaryAction`, else Hint) is nudged. After 8 s with no touch there is one more nudge (or the glow again). Any touch or the turn moving on cancels it.
- **Opponents:**
  - the ring flares in when their turn starts;
  - thinking dots step every 400 ms while they are on turn (still under reduced motion);
  - the portrait lunges toward the felt as they play;
  - "passed" drops in like a stamp (scale 1.4 → 1, `land`);
  - the count pops as it ticks down, and wobbles as it reaches 3;
  - a red **LAST CARD** tag pops onto the portrait at one card (words as well as colour).
- **Trick clear (F6):** the trick holds for 250 ms while the winning play pops, then sweeps into the winner's portrait (or the hand for the player), shrinking and fading. The winner's portrait pops on arrival. The felt's "`<name>` leads" line shows once the cards have gone. A play made during the sweep starts the next trick beside it.
- **Sign and status:** a change eases up 4 px as it fades in (120 ms), instead of snapping.
- **Fix:** `fx.pop` / `pulse` now scale relative to the object's resting scale. A portrait drawn with `setDisplaySize` rests near 0.28, and popping it from 1 had blown it up to fill the corner.
- **Perf gate:** on the iPhone profile, 3 hitches, ≤ 48 draws, worst frame 117 ms. The dots raise frames drawn from 76 % to 82 % of frames.
- **Deviation:** no looping "breathing" ring. A loop would make render-on-demand draw every frame of every AI think (most of a game), so the ring flares in once and the dots step on a timer instead. The primary-button pop at turn start only happens when a control *is* primary (usually Pass when stuck); at an ordinary turn start the hand glow is the cue.

**Phase 4, done.**
- **Deal (F7)** (`table/Deal.ts`, `DEAL` / `dealTotalMs` in `timing.ts`):
  - A short deck sits on the felt. 52 backs leave it round-robin, 14 ms apart.
  - Opponents' backs shrink into their portraits while their counts tick up from 0 (`SeatView.setDealt`).
  - Your backs land face-down in your fan slots, then flip over left to right (`HandView.flipIn`).
  - About 1.5 s in all. `timing.test.ts` pins it inside the earliest first AI move at every speed, so the deal never overlaps play.
  - A tap anywhere finishes it at once (`DealRun.finish`), and the hand ignores input until then.
  - Under reduced motion it finishes immediately.
  - When it ends, the opening turn gets its cue and a newcomer gets the swipe coach mark.
- **Round end:**
  - The last play lands, holds 300 ms, then slaps down (1.15 → 1) with a 3-px camera jolt (`TrickView.slap`).
  - On Greenhorn (`selectors.revealLeftovers`, tested), the losers' leftover cards come out of their portraits face-up, one after another, and fan across their badges.
  - The store waits a fixed `ROUND_END.revealHoldMs` (1.5 s) more before scoring so they can be read. A fake-clock test pins the round-over → poster wait for both Regular and Greenhorn.
- **Poster:**
  - It drops in on a spring, turned −3°, and settles square. Rows arrive 60 ms apart.
  - Round scores count up from 0 and tallies from last round's value, with a throttled tick sound.
  - The buttons sleep until the count ends; a tap anywhere, including on a sleeping button, finishes it.
  - A button lifts the poster away before it acts.
  - The final poster gets an amber rule and five glints around the winner's frame.
  - The probe now reports the poster buttons' enabled state, and the e2e `tap()` waits for a control to wake.
- **Final-round banner:** slammed in (scale 1.5 → 1, `land`) instead of sliding.
- **Sequencer:** each skippable sequence owns its own `finish()` (the deal's, the poster's). A shared class was not needed.
- **Fix: a hold whose timer frame came late is still a hold.** `resolveGesture` checks the elapsed time first; there is a test for it. A busy deal frame in headless Chromium had turned the e2e's hold-then-drag into a swipe.
- **Fix:** dealt backs scale relative to their resting scale, like `fx.pop`. A 3x back rests near 0.25.
- **Perf gate:** on the iPhone profile, 3 hitches, ≤ 53 draws, worst frame 90 ms. Uploads rose 344 → 408 from the poster counters and the deal's backs. e2e 121/121 on all four devices.
- **F2 again:** in headless Chromium, rotated backs and the turned poster show the same torn triangles; WebKit captures of the same frames are clean.
- **Not done:** skipping the Greenhorn leftover reveal by tap. It is covered by the poster when the store's timer runs out, so a skip would save nothing.
