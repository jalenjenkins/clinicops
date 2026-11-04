import { useCallback, useEffect, useState } from "react";
import { request } from "../lib/api";
import type { Movement, MovementType } from "../lib/api";
import { relativeTime } from "../lib/format";

const labels: Record<MovementType, string> = {
  INITIAL: "Created",
  RECEIPT: "Received",
  USAGE: "Used",
  ADJUSTMENT: "Adjusted"
};

const tone: Record<MovementType, string> = {
  INITIAL: "neutral",
  RECEIPT: "ok",
  USAGE: "watch",
  ADJUSTMENT: "info"
};

export default function Activity() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [type, setType] = useState<"all" | MovementType>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setMovements(await request<Movement[]>("/movements?limit=100"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = movements.filter(m => type === "all" || m.type === type);

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter activity">
          {(["all", "USAGE", "RECEIPT", "ADJUSTMENT", "INITIAL"] as const).map(t => (
            <button key={t} type="button" className={type === t ? "on" : ""} onClick={() => setType(t)}>
              {t === "all" ? "All" : labels[t]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="empty-state">
          <h2>Activity didn't load</h2>
          <p>{error}</p>
          <button type="button" className="button primary" onClick={() => { setLoading(true); void load(); }}>Try again</button>
        </div>
      ) : loading ? (
        <div className="loading">Loading activity…</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <h2>No activity to show</h2>
          <p>Stock changes, deliveries and adjustments are recorded here automatically.</p>
        </div>
      ) : (
        <section className="panel flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="num">Change</th>
                  <th className="num">Balance</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(m => (
                  <tr key={m.id}>
                    <td className="muted nowrap" title={new Date(m.createdAt).toLocaleString()}>{relativeTime(m.createdAt)}</td>
                    <td><div className="cell-title">{m.product.name}</div><div className="cell-sub">{m.product.sku}</div></td>
                    <td><span className={`chip ${tone[m.type]}`}>{labels[m.type]}</span></td>
                    <td className="num"><span className={`delta ${m.delta > 0 ? "up" : "down"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</span></td>
                    <td className="num">{m.quantityAfter}</td>
                    <td className="muted">{m.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
