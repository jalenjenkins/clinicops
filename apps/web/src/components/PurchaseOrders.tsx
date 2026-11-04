import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { patch, post, request } from "../lib/api";
import type { OrderStatus, Product, PurchaseOrder, Vendor } from "../lib/api";
import { money, poNumber, shortDate } from "../lib/format";
import { PlusIcon, TrashIcon } from "./Icons";
import { useToast } from "./Toast";

type Line = { key: number; productId: string; quantity: string };
type Tab = "all" | "open" | "RECEIVED";

const steps: { status: OrderStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "RECEIVED", label: "Received" }
];

function Progress({ order }: { order: PurchaseOrder }) {
  const index = steps.findIndex(s => s.status === order.status);
  const dates: Record<OrderStatus, string | null> = {
    DRAFT: order.createdAt,
    SUBMITTED: order.submittedAt,
    RECEIVED: order.receivedAt
  };

  return (
    <ol className="progress" aria-label={`Status: ${order.status.toLowerCase()}`}>
      {steps.map((step, i) => (
        <li key={step.status} className={i < index ? "done" : i === index ? "current" : ""}>
          <i />
          <span>{step.label}</span>
          {i <= index && dates[step.status] && <small>{shortDate(dates[step.status] as string).replace(/, \d{4}$/, "")}</small>}
        </li>
      ))}
    </ol>
  );
}

export default function PurchaseOrders() {
  const notify = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("all");

  const [composing, setComposing] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: "", quantity: "10" }]);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, p, o] = await Promise.all([
        request<Vendor[]>("/vendors"),
        request<Product[]>("/products"),
        request<PurchaseOrder[]>("/purchase-orders")
      ]);
      setVendors(v);
      setProducts(p);
      setOrders(o);
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

  const productById = useMemo(() => new Map(products.map(p => [String(p.id), p])), [products]);
  const orderTotal = (o: PurchaseOrder) => o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const draftTotal = lines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    return sum + (product ? product.price * (Number(line.quantity) || 0) : 0);
  }, 0);

  const updateLine = (key: number, change: Partial<Line>) =>
    setLines(current => current.map(l => (l.key === key ? { ...l, ...change } : l)));

  function resetComposer() {
    setComposing(false);
    setVendorId("");
    setLines([{ key: Date.now(), productId: "", quantity: "10" }]);
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    const items = lines.map(l => ({ productId: Number(l.productId), quantity: Number(l.quantity) }));

    if (new Set(items.map(i => i.productId)).size !== items.length) {
      notify("error", "Each product can appear only once per order. Combine the quantities into one line.");
      return;
    }

    setCreating(true);
    try {
      const order = await post<PurchaseOrder>("/purchase-orders", { vendorId: Number(vendorId), items });
      notify("success", `${poNumber(order.id)} saved as a draft`);
      resetComposer();
      await load();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Couldn't create the order");
    } finally {
      setCreating(false);
    }
  }

  async function advance(order: PurchaseOrder, action: "submit" | "receive") {
    setBusyId(order.id);
    try {
      await patch(`/purchase-orders/${order.id}/${action}`);
      notify(
        "success",
        action === "submit"
          ? `${poNumber(order.id)} submitted to ${order.vendor.name}`
          : `${poNumber(order.id)} received. Stock levels are updated.`
      );
      await load();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Couldn't update the order");
    } finally {
      setBusyId(null);
    }
  }

  const shown = orders.filter(o => tab === "all" || (tab === "open" ? o.status !== "RECEIVED" : o.status === tab));
  const openCount = orders.filter(o => o.status !== "RECEIVED").length;

  return (
    <>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Filter orders">
          <button type="button" className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>All {orders.length}</button>
          <button type="button" className={tab === "open" ? "on" : ""} onClick={() => setTab("open")}>Open {openCount}</button>
          <button type="button" className={tab === "RECEIVED" ? "on" : ""} onClick={() => setTab("RECEIVED")}>Received {orders.length - openCount}</button>
        </div>
        <div className="toolbar-end">
          {!composing && (
            <button type="button" className="button primary" onClick={() => setComposing(true)}>
              <PlusIcon /> New purchase order
            </button>
          )}
        </div>
      </div>

      {composing && (
        <form className="panel composer" onSubmit={createOrder}>
          <header className="panel-header">
            <div>
              <h2>New purchase order</h2>
              <p>Saved as a draft. Nothing is sent to the vendor until you submit it.</p>
            </div>
          </header>

          <label className="field narrow">
            <span>Vendor</span>
            <select required value={vendorId} onChange={e => setVendorId(e.target.value)}>
              <option value="">Choose a vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>

          <div className="lines">
            <div className="lines-head"><span>Product</span><span>Quantity</span><span className="num">Line total</span><span /></div>
            {lines.map(line => {
              const product = productById.get(line.productId);
              return (
                <div className="line" key={line.key}>
                  <select required aria-label="Product" value={line.productId} onChange={e => updateLine(line.key, { productId: e.target.value })}>
                    <option value="">Choose a product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    aria-label="Quantity"
                    value={line.quantity}
                    onChange={e => updateLine(line.key, { quantity: e.target.value })}
                  />
                  <span className="num">{product ? money(product.price * (Number(line.quantity) || 0)) : "—"}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => setLines(current => current.filter(l => l.key !== line.key))}
                  >
                    <TrashIcon />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="composer-footer">
            <button
              type="button"
              className="button ghost"
              onClick={() => setLines(current => [...current, { key: Date.now(), productId: "", quantity: "10" }])}
            >
              <PlusIcon /> Add another product
            </button>
            <div className="composer-total">Order total <strong>{money(draftTotal)}</strong></div>
          </div>

          <div className="drawer-actions">
            <button type="submit" className="button primary" disabled={creating}>{creating ? "Saving…" : "Save as draft"}</button>
            <button type="button" className="button" onClick={resetComposer}>Cancel</button>
          </div>
        </form>
      )}

      {error ? (
        <div className="empty-state">
          <h2>Orders didn't load</h2>
          <p>{error}</p>
          <button type="button" className="button primary" onClick={() => { setLoading(true); void load(); }}>Try again</button>
        </div>
      ) : loading ? (
        <div className="loading">Loading orders…</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <h2>{orders.length === 0 ? "No purchase orders yet" : "No orders in this view"}</h2>
          <p>{orders.length === 0 ? "Create an order by hand, or draft them from the reorder queue on Overview." : "Switch the filter above to see other orders."}</p>
        </div>
      ) : (
        <div className="order-list">
          {shown.map(order => {
            const open = expanded === order.id;
            return (
              <article key={order.id} className="order">
                <div className="order-main">
                  <button
                    type="button"
                    className="order-toggle"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : order.id)}
                  >
                    <span className="order-id">{poNumber(order.id)}</span>
                    <span className="order-vendor">{order.vendor.name}</span>
                    <span className="cell-sub">{order.items.length} {order.items.length === 1 ? "item" : "items"} · {money(orderTotal(order))}</span>
                  </button>

                  <Progress order={order} />

                  <div className="order-action">
                    {order.status === "DRAFT" && (
                      <button type="button" className="button primary" disabled={busyId === order.id} onClick={() => void advance(order, "submit")}>
                        {busyId === order.id ? "Submitting…" : "Submit order"}
                      </button>
                    )}
                    {order.status === "SUBMITTED" && (
                      <button type="button" className="button primary" disabled={busyId === order.id} onClick={() => void advance(order, "receive")}>
                        {busyId === order.id ? "Receiving…" : "Mark received"}
                      </button>
                    )}
                    {order.status === "RECEIVED" && <span className="chip ok">Stock updated</span>}
                  </div>
                </div>

                {open && (
                  <div className="order-detail">
                    <table className="table compact">
                      <thead>
                        <tr><th>Product</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr>
                      </thead>
                      <tbody>
                        {order.items.map(item => (
                          <tr key={item.id}>
                            <td><div className="cell-title">{item.product.name}</div><div className="cell-sub">{item.product.sku}</div></td>
                            <td className="num">{item.quantity}</td>
                            <td className="num">{money(item.unitPrice)}</td>
                            <td className="num">{money(item.quantity * item.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
