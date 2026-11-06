/**
 * /assets — every asset the game ships, with a preview, what it is for, and a notes box.
 * Submit POSTs the non-empty notes to the dev server (vite.config.ts `assetNotes`), which
 * appends them to ~/Desktop/tally-two-asset-notes.txt. Drafts survive a reload via
 * localStorage until a submit succeeds. A plain scrolling page outside the game's fit-scaled
 * canvas; main.tsx renders it instead of <App /> on that path.
 */
import "../../styles/assets.css";
import { useEffect, useState } from "react";
import { ASSET_ROWS, GROUPS, type AssetRow } from "./assetCatalog";

const DRAFT_KEY = "tally.assetNotes.draft";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "ok"; text: string } | { kind: "error"; text: string };

function loadDrafts(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function Preview({ row }: { row: AssetRow }) {
  if (row.kind === "image" && row.url) return <img className="ap-img" src={row.url} alt="" loading="lazy" />;
  if (row.kind === "audio" && row.url) return <audio className="ap-audio" src={row.url} controls preload="none" />;
  return <span className="ap-font western">Tally Two</span>;
}

export function AssetsPage() {
  const [notes, setNotes] = useState<Record<string, string>>(loadDrafts);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(notes));
  }, [notes]);

  const filled = ASSET_ROWS.filter((r) => (notes[r.name] ?? "").trim() !== "");

  const submit = async () => {
    if (filled.length === 0) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/__asset-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filled.map((r) => ({ name: r.name, file: r.file, note: notes[r.name] }))),
      });
      const data = (await res.json().catch(() => ({}))) as { saved?: number; file?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setNotes({});
      setStatus({ kind: "ok", text: `Saved ${data.saved} note${data.saved === 1 ? "" : "s"} to ${data.file}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", text: `Not saved (${msg}). Notes only save while running npm run dev.` });
    }
  };

  return (
    <main className="ap">
      <header className="ap-head">
        <h1 className="western">Tally Two assets</h1>
        <p className="muted">
          {ASSET_ROWS.length} assets in use · <a href={import.meta.env.BASE_URL}>back to the game</a>
        </p>
      </header>
      {GROUPS.map((group) => {
        const rows = ASSET_ROWS.filter((r) => r.group === group);
        return (
          <section key={group} className="ap-group">
            <h2 className="western">
              {group} <span className="muted">({rows.length})</span>
            </h2>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Asset</th>
                  <th>Used for</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name}>
                    <td className="ap-prev">
                      <Preview row={row} />
                    </td>
                    <td>
                      <code>{row.name}</code>
                      <div className="muted">{row.file}</div>
                    </td>
                    <td>{row.use}</td>
                    <td className="ap-notes">
                      <textarea
                        aria-label={`Notes for ${row.name}`}
                        placeholder="Add a note…"
                        rows={2}
                        value={notes[row.name] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [row.name]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      <footer className="ap-foot">
        <button type="button" className="ap-submit" disabled={filled.length === 0 || status.kind === "saving"} onClick={submit}>
          {status.kind === "saving" ? "Saving…" : `Submit ${filled.length} note${filled.length === 1 ? "" : "s"}`}
        </button>
        {(status.kind === "ok" || status.kind === "error") && <p className={`ap-status ap-${status.kind}`}>{status.text}</p>}
      </footer>
    </main>
  );
}
