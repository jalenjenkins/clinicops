import { stockStatus } from "../lib/format";

type Props = { quantity: number; reorderPoint: number };

/**
 * The stock gauge: a bar scaled so the reorder point sits at the halfway tick.
 * Left of the tick means "reorder"; the bar tops out at 2x the reorder point,
 * which is also the restock target used by the recommendations.
 */
export default function Gauge({ quantity, reorderPoint }: Props) {
  const status = stockStatus({ quantity, reorderPoint });
  const scale = Math.max(reorderPoint * 2, quantity, 1);
  const fill = Math.min(100, (quantity / scale) * 100);
  const tick = Math.min(100, (reorderPoint / scale) * 100);

  return (
    <div
      className="gauge"
      role="img"
      aria-label={`${quantity} on hand, reorder at ${reorderPoint}`}
    >
      <div className="gauge-track">
        <div className={`gauge-fill ${status.toLowerCase()}`} style={{ width: `${fill}%` }} />
        <div className="gauge-tick" style={{ left: `${tick}%` }} />
      </div>
    </div>
  );
}
