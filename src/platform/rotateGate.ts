/**
 * The "turn your phone sideways" gate: a plain element over the whole page, shown by CSS alone
 * whenever the screen is upright (shell.css, the same query as env.upright). Being outside the
 * canvas, it covers every edge — notch and home indicator included — from the first frame of a
 * rotation, while iOS is still reporting the old viewport size, and nothing about it is rebuilt
 * when the size does change. The director pauses the game behind it (env.upright). WEB bucket.
 */
import wood from "../assets/sprites/wood.png?url";
import { COPY } from "../game/copy";

export function installRotateGate(): void {
  if (document.querySelector(".rotate-gate")) return;
  const gate = document.createElement("div");
  gate.className = "rotate-gate";
  gate.setAttribute("role", "alert");
  // the wood tile is 3x art: shown at a third of its size, as the canvas draws it
  gate.style.setProperty("--wood", `url("${wood}")`);
  const phone = document.createElement("div");
  phone.className = "rotate-phone";
  phone.appendChild(document.createElement("div")).className = "rotate-screen";
  const title = document.createElement("h1");
  title.className = "western";
  title.textContent = COPY.rotate.title;
  const body = document.createElement("p");
  body.textContent = COPY.rotate.body;
  gate.append(phone, title, body);
  document.body.appendChild(gate);
  // size the tile from the image itself, so it never depends on a hard-coded width
  const img = new Image();
  img.onload = () => gate.style.setProperty("--wood-size", `${img.naturalWidth / 3}px ${img.naturalHeight / 3}px`);
  img.src = wood;
}
