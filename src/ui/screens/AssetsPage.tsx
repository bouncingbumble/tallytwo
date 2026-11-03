/**
 * /assets — every asset the game ships, with a preview and what it is for. A plain scrolling
 * page outside the game's fit-scaled canvas; main.tsx renders it instead of <App /> on that path.
 */
import "../../styles/assets.css";
import { ASSET_ROWS, GROUPS, type AssetRow } from "./assetCatalog";

function Preview({ row }: { row: AssetRow }) {
  if (row.kind === "image" && row.url) return <img className="ap-img" src={row.url} alt="" loading="lazy" />;
  if (row.kind === "audio" && row.url) return <audio className="ap-audio" src={row.url} controls preload="none" />;
  return <span className="ap-font western">Tally Two</span>;
}

export function AssetsPage() {
  return (
    <main className="ap">
      <header className="ap-head">
        <h1 className="western">Tally Two assets</h1>
        <p className="muted">
          {ASSET_ROWS.length} assets in use · <a href="/">back to the game</a>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}
