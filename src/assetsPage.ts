/**
 * /assets — every asset the game ships, with a preview, what it is for, and a notes box. Submit
 * POSTs the non-empty notes to the dev server (vite.config.ts `assetNotes`), which appends them
 * to ~/Desktop/tally-two-asset-notes.txt. Drafts survive a reload via localStorage until a submit
 * succeeds. A plain scrolling DOM page outside the game; main.ts renders it on that path.
 */
import "./styles/assets.css";
import { ASSET_ROWS, GROUPS, type AssetRow } from "./assetCatalog";

const DRAFT_KEY = "tally.assetNotes.draft";

function loadDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function preview(row: AssetRow): HTMLElement {
  if (row.kind === "image" && row.url) return el("img", { className: "ap-img", src: row.url, alt: "", loading: "lazy" });
  if (row.kind === "audio" && row.url) return el("audio", { className: "ap-audio", src: row.url, controls: true, preload: "none" });
  return el("span", { className: "ap-font western" }, "Tally Two");
}

export function renderAssetsPage(root: HTMLElement): void {
  document.body.style.overflow = "auto";
  root.style.height = "auto";
  const notes = loadDrafts();
  const save = () => localStorage.setItem(DRAFT_KEY, JSON.stringify(notes));
  const filled = () => ASSET_ROWS.filter((r) => (notes[r.name] ?? "").trim() !== "");

  const submit = el("button", { type: "button", className: "ap-submit" });
  const status = el("p", { className: "ap-status" });
  const refresh = () => {
    const n = filled().length;
    submit.textContent = `Submit ${n} note${n === 1 ? "" : "s"}`;
    submit.disabled = n === 0;
  };
  const areas: HTMLTextAreaElement[] = [];

  const main = el("main", { className: "ap" });
  main.append(
    el(
      "header",
      { className: "ap-head" },
      el("h1", { className: "western" }, "Tally Two assets"),
      el("p", { className: "muted" }, `${ASSET_ROWS.length} assets in use · `, el("a", { href: import.meta.env.BASE_URL }, "back to the game")),
    ),
  );
  for (const group of GROUPS) {
    const rows = ASSET_ROWS.filter((r) => r.group === group);
    const tbody = el("tbody");
    for (const row of rows) {
      const ta = el("textarea", { placeholder: "Add a note…", rows: 2, value: notes[row.name] ?? "" });
      ta.setAttribute("aria-label", `Notes for ${row.name}`);
      ta.addEventListener("input", () => {
        notes[row.name] = ta.value;
        save();
        refresh();
      });
      areas.push(ta);
      tbody.append(
        el(
          "tr",
          {},
          el("td", { className: "ap-prev" }, preview(row)),
          el("td", {}, el("code", {}, row.name), el("div", { className: "muted" }, row.file)),
          el("td", {}, row.use),
          el("td", { className: "ap-notes" }, ta),
        ),
      );
    }
    main.append(
      el(
        "section",
        { className: "ap-group" },
        el("h2", { className: "western" }, group + " ", el("span", { className: "muted" }, `(${rows.length})`)),
        el("table", { className: "ap-table" }, el("thead", {}, el("tr", {}, ...["Preview", "Asset", "Used for", "Notes"].map((h) => el("th", {}, h)))), tbody),
      ),
    );
  }
  submit.addEventListener("click", async () => {
    const list = filled();
    if (list.length === 0) return;
    submit.disabled = true;
    submit.textContent = "Saving…";
    try {
      const res = await fetch("/__asset-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(list.map((r) => ({ name: r.name, file: r.file, note: notes[r.name] }))),
      });
      const data = (await res.json().catch(() => ({}))) as { saved?: number; file?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      for (const k of Object.keys(notes)) delete notes[k];
      for (const a of areas) a.value = "";
      save();
      status.className = "ap-status ap-ok";
      status.textContent = `Saved ${data.saved} note${data.saved === 1 ? "" : "s"} to ${data.file}`;
    } catch (e) {
      status.className = "ap-status ap-error";
      status.textContent = `Not saved (${e instanceof Error ? e.message : String(e)}). Notes only save while running npm run dev.`;
    }
    refresh();
  });
  main.append(el("footer", { className: "ap-foot" }, submit, status));
  refresh();
  root.replaceChildren(main);
}
