/**
 * ?dev=spike: the M0 crispness diagnostics, on the web. dpr and S (render/scale.ts); the checker
 * probe — a 32-px tile drawn pixelated, and a twin shifted half a device pixel that must look
 * grey while the original stays pure black and white (the original build plan §3.6); a 13-card fan at
 * fanLayout() positions; an fps counter; the three M0 cards (3♦ 2♠ A♣). Inline styles
 * throughout: nothing here ships to a player, and it mounts outside the providers.
 */
import { type CSSProperties, useEffect, useState } from "react";
import { useDevice } from "../platform/useDevice";
import { fanLayout } from "../render/fanLayout";
import { cardScale } from "../render/scale";
import { Card } from "../ui/Card";

/** Frames per second over the last second, from requestAnimationFrame. */
function useFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      if (now - since >= 1000) {
        setFps(Math.round((frames * 1000) / (now - since)));
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return fps;
}

const PAGE: CSSProperties = { width: "100%", maxWidth: 440, padding: 16, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, color: "var(--bone)" };
/* the checker is .checker-tile in base.css: an image-set, so at dpr 2/3 the browser draws the 2x/3x file 1:1 */
const CHECKER: CSSProperties = { width: 128, height: 64 };
/** One card per rank, suits cycling, already in hand order. */
const FAN = Array.from({ length: 13 }, (_, i) => i * 4 + (i % 4));
/** The hand strip on a 376-px phone after its 8 + 8 gutters: step 22, span 360. */
const FAN_AVAIL = 360;
const M0_CARDS = [0, 51, 45];

export function Spike() {
  const { dpr } = useDevice();
  const scale = cardScale(dpr);
  const fps = useFps();
  const fan = fanLayout(FAN.length, FAN_AVAIL);
  return (
    <main style={PAGE}>
      <h1 className="western" style={{ margin: 0, color: "var(--amber)" }}>
        Spike
      </h1>
      <p style={{ margin: 0 }}>
        dpr {dpr} · S {scale.S} · card {scale.pointW}x{scale.pointH} CSS px = {scale.deviceW}x{scale.deviceH} device px · {fps} fps
      </p>
      <section>
        <h2>Checker probe</h2>
        <p className="muted">Top: pure black and white. Twin, half a device pixel to the right: grey. Anything else is resampling.</p>
        <div className="checker-tile" style={CHECKER} />
        <div className="checker-tile" style={{ ...CHECKER, marginTop: 8, transform: "translateX(calc(0.5px / var(--dpr)))" }} />
      </section>
      <section>
        <h2>13-card fan</h2>
        <div className="handwrap" style={{ width: FAN_AVAIL + 16 }}>
          <div className="hand">
            {FAN.map((v, i) => (
              <Card key={v} value={v} style={{ transform: `translate(${fan.xs[i]}px, 0)` }} />
            ))}
          </div>
        </div>
        <p className="muted">
          step {fan.step} · span {fan.span} · x0 {fan.x0}
        </p>
      </section>
      <section>
        <h2>M0 cards: 3♦ 2♠ A♣</h2>
        <div style={{ display: "flex", gap: 12 }}>
          {M0_CARDS.map((v) => (
            <Card key={v} value={v} />
          ))}
        </div>
      </section>
    </main>
  );
}
