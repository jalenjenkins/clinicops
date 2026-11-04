import { useCallback, useEffect, useState } from "react";
import { request, post } from "../lib/api";
import type { Dashboard, Movement, PurchaseOrder, Vendor } from "../lib/api";
import { money, moneyShort, poNumber, relativeTime } from "../lib/format";
import Gauge from "./Gauge";
import { useToast } from "./Toast";

type Props = { onNavigate: (page: "inventory" | "orders" | "activity") => void };

export default function Overview({ onNavigate }: Props) {
  const notify = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [recent, setRecent] = useState<Movement[]>([]);
  const [error, setError] = useState("");
  const [drafting, setDrafting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [dashboard, vendorList, movements] = await Promise.all([
        request<Dashboard>("/dashboard"),
        request<Vendor[]>("/vendors"),
        request<Movement[]>("/movements?limit=6")
      ]);
      setData(dashboard);
      setVendors(vendorList);
      setRecent(movements);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="empty-state">
        <h2>The dashboard didn't load</h2>
        <p>{error}</p>
        <button type="button" className="button primary" onClick={() => void load()}>Try again</button>
      </div>
    );
  }

  if (!data) return <div className="loading">Loading overview…</div>;

  const { kpis, stockHealth, valueByCategory, expiring, daysOfSupply } = data;
  const reorderPoints = data.reorderRecommendations;
  const vendorName = (id: number | null) => vendors.find(v => v.id === id)?.name ?? "No preferred vendor";
  const withVendor = reorderPoints.filter(r => r.preferredVendorId !== null);
  const withoutVendor = reorderPoints.length - withVendor.length;
  const reorderCost = reorderPoints.reduce((sum, r) => sum + r.estimatedCost, 0);
  const totalProducts = Math.max(kpis.totalProducts, 1);
  const maxCategory = Math.max(...valueByCategory.map(c => c.value), 1);

  async function draftOrders() {
    setDrafting(true);
    const groups = new Map<number, typeof reorderPoints>();
    for (const rec of withVendor) {
      groups.set(rec.preferredVendorId as number, [...(groups.get(rec.preferredVendorId as number) ?? []), rec]);
    }

    const created: PurchaseOrder[] = [];
    try {
      for (const [vendorId, recs] of groups) {
        created.push(await post<PurchaseOrder>("/purchase-orders", {
          vendorId,
          items: recs.map(r => ({ productId: r.productId, quantity: r.suggestedQuantity }))
        }));
      }
      notify("success", `Created ${created.length} draft ${created.length === 1 ? "order" : "orders"} (${created.map(o => poNumber(o.id)).join(", ")}). Review and submit them under Purchase orders.`);
      onNavigate("orders");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Couldn't create the draft orders");
      void load();
    } finally {
      setDrafting(false);
    }
  }

  const summary: string[] = [];
  if (kpis.outOfStockCount) summary.push(`${kpis.outOfStockCount} out of stock`);
  if (kpis.lowStockCount) summary.push(`${kpis.lowStockCount} running low`);
  if (kpis.expiringSoonCount) summary.push(`${kpis.expiringSoonCount} expiring within 30 days`);

  return (
    <>
      <p className="lede">
        {summary.length === 0
          ? "Everything is stocked and in date. Nothing needs attention today."
          : <>Needs attention: <strong>{summary.join(", ")}</strong>.</>}
      </p>

      <section className="ledger" aria-label="Key figures">
        <div className="ledger-cell">
          <span className="ledger-value">{moneyShort(kpis.inventoryValue)}</span>
          <span className="ledger-label">On the shelf · {kpis.totalUnits.toLocaleString()} units across {kpis.totalProducts} products</span>
        </div>
        <div className="ledger-cell">
          <span className={`ledger-value ${kpis.lowStockCount + kpis.outOfStockCount ? "crit" : ""}`}>
            {kpis.lowStockCount + kpis.outOfStockCount}
          </span>
          <span className="ledger-label">Below reorder point, {kpis.outOfStockCount} of them empty</span>
        </div>
        <div className="ledger-cell">
          <span className={`ledger-value ${kpis.expiringSoonCount ? "watch" : ""}`}>{kpis.expiringSoonCount}</span>
          <span className="ledger-label">Expiring in 30 days · {money(kpis.expiringValueAtRisk)} at risk</span>
        </div>
        <div className="ledger-cell">
          <span className="ledger-value">{kpis.openOrderCount}</span>
          <span className="ledger-label">Open orders worth {money(kpis.openOrderValue)}</span>
        </div>
      </section>

      <div className="split">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Reorder queue</h2>
              <p>
                {reorderPoints.length === 0
                  ? "Nothing to reorder."
                  : `${reorderPoints.length} ${reorderPoints.length === 1 ? "product" : "products"} · about ${money(reorderCost)} to restock`}
              </p>
            </div>
            {withVendor.length > 0 && (
              <button type="button" className="button primary" disabled={drafting} onClick={() => void draftOrders()}>
                {drafting ? "Creating drafts…" : `Draft ${new Set(withVendor.map(r => r.preferredVendorId)).size} purchase ${new Set(withVendor.map(r => r.preferredVendorId)).size === 1 ? "order" : "orders"}`}
              </button>
            )}
          </header>

          {reorderPoints.length === 0 ? (
            <div className="panel-empty">Every product is above its reorder point or already on order.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>On hand</th>
                    <th className="num">Order</th>
                    <th>Vendor</th>
                    <th className="num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {reorderPoints.map(rec => (
                    <tr key={rec.productId}>
                      <td>
                        <div className="cell-title">{rec.name}</div>
                        <div className="cell-sub">{rec.sku}</div>
                      </td>
                      <td className="gauge-cell">
                        <Gauge quantity={rec.quantity} reorderPoint={rec.reorderPoint} />
                        <span className="gauge-text">
                          {rec.quantity} of {rec.reorderPoint}
                          {rec.onOrder > 0 && <em> · {rec.onOrder} on order</em>}
                        </span>
                      </td>
                      <td className="num strong">{rec.suggestedQuantity}</td>
                      <td className={rec.preferredVendorId ? "" : "muted"}>{vendorName(rec.preferredVendorId)}</td>
                      <td className="num">{money(rec.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {withoutVendor > 0 && (
            <p className="panel-note">
              {withoutVendor} {withoutVendor === 1 ? "product has" : "products have"} no preferred vendor, so
              {withoutVendor === 1 ? " it isn't" : " they aren't"} included in the drafts. Set one in Inventory.
            </p>
          )}
        </section>

        <div className="stack">
          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Expiring soon</h2>
                <p>Use or rotate these first</p>
              </div>
            </header>
            {expiring.length === 0 ? (
              <div className="panel-empty">Nothing expires in the next 30 days.</div>
            ) : (
              <ul className="plain-list">
                {expiring.map(item => (
                  <li key={item.productId}>
                    <div>
                      <div className="cell-title">{item.name}</div>
                      <div className="cell-sub">{item.quantity} units · {money(item.valueAtRisk)}</div>
                    </div>
                    <span className={`chip ${item.daysLeft <= 14 ? "crit" : "watch"}`}>
                      {item.daysLeft <= 0 ? "Expired" : `${item.daysLeft} days`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <header className="panel-header">
              <div>
                <h2>Days of supply</h2>
                <p>At the last 30 days of usage</p>
              </div>
            </header>
            {daysOfSupply.length === 0 ? (
              <div className="panel-empty">Usage will show up once stock is adjusted.</div>
            ) : (
              <ul className="plain-list">
                {daysOfSupply.map(item => (
                  <li key={item.productId}>
                    <div>
                      <div className="cell-title">{item.name}</div>
                      <div className="cell-sub">{item.usagePerDay.toFixed(1)} used per day</div>
                    </div>
                    <span className={`chip ${item.daysOfSupply <= 7 ? "crit" : item.daysOfSupply <= 14 ? "watch" : "ok"}`}>
                      {item.daysOfSupply} days
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="split even">
        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Stock health</h2>
              <p>{kpis.totalProducts} products</p>
            </div>
          </header>
          <div className="segments" role="img" aria-label={`${stockHealth.OK} in stock, ${stockHealth.LOW} low, ${stockHealth.OUT} out`}>
            {stockHealth.OK > 0 && <div className="segment ok" style={{ flexGrow: stockHealth.OK }} />}
            {stockHealth.LOW > 0 && <div className="segment low" style={{ flexGrow: stockHealth.LOW }} />}
            {stockHealth.OUT > 0 && <div className="segment out" style={{ flexGrow: stockHealth.OUT }} />}
          </div>
          <ul className="legend">
            <li><i className="dot ok" />In stock <b>{stockHealth.OK}</b> <span>{Math.round((stockHealth.OK / totalProducts) * 100)}%</span></li>
            <li><i className="dot low" />Low <b>{stockHealth.LOW}</b> <span>{Math.round((stockHealth.LOW / totalProducts) * 100)}%</span></li>
            <li><i className="dot out" />Out <b>{stockHealth.OUT}</b> <span>{Math.round((stockHealth.OUT / totalProducts) * 100)}%</span></li>
          </ul>

          <h3 className="subhead">Value by category</h3>
          <ul className="bars">
            {valueByCategory.map(c => (
              <li key={c.category}>
                <span className="bar-label">{c.category}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(c.value / maxCategory) * 100}%` }} /></span>
                <span className="bar-value">{moneyShort(c.value)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p>Every stock change is logged</p>
            </div>
            <button type="button" className="button ghost" onClick={() => onNavigate("activity")}>View all</button>
          </header>
          {recent.length === 0 ? (
            <div className="panel-empty">No stock movements yet.</div>
          ) : (
            <ul className="plain-list">
              {recent.map(m => (
                <li key={m.id}>
                  <div>
                    <div className="cell-title">{m.product.name}</div>
                    <div className="cell-sub">{m.note ?? m.type.toLowerCase()} · {relativeTime(m.createdAt)}</div>
                  </div>
                  <span className={`delta ${m.delta > 0 ? "up" : "down"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
