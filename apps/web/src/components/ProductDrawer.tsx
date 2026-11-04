import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { patch, post, put, request } from "../lib/api";
import type { Movement, Product, Vendor } from "../lib/api";
import { relativeTime } from "../lib/format";
import Drawer from "./Drawer";
import { useToast } from "./Toast";

type Props = {
  product: Product | null; // null = add mode
  vendors: Vendor[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
};

type Draft = {
  name: string;
  sku: string;
  category: string;
  quantity: string;
  reorderPoint: string;
  price: string;
  expiresAt: string;
  preferredVendorId: string;
};

const toDraft = (p: Product | null): Draft => ({
  name: p?.name ?? "",
  sku: p?.sku ?? "",
  category: p?.category ?? "",
  quantity: String(p?.quantity ?? 0),
  reorderPoint: String(p?.reorderPoint ?? 20),
  price: String(p?.price ?? ""),
  expiresAt: p?.expiresAt ? p.expiresAt.slice(0, 10) : "",
  preferredVendorId: p?.preferredVendorId ? String(p.preferredVendorId) : ""
});

export default function ProductDrawer({ product, vendors, categories, onClose, onSaved }: Props) {
  const notify = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [current, setCurrent] = useState<Product | null>(product);
  const [history, setHistory] = useState<Movement[]>([]);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const productId = product?.id;

  const loadHistory = useCallback(async () => {
    if (!productId) return;
    try {
      setHistory(await request<Movement[]>(`/movements?productId=${productId}&limit=8`));
    } catch {
      setHistory([]);
    }
  }, [productId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const set = (field: keyof Draft) => (value: string) =>
    setDraft(previous => ({ ...previous, [field]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    const body = {
      name: draft.name,
      sku: draft.sku,
      category: draft.category || "General",
      quantity: current ? current.quantity : Number(draft.quantity),
      reorderPoint: Number(draft.reorderPoint),
      price: Number(draft.price),
      expiresAt: draft.expiresAt || null,
      preferredVendorId: draft.preferredVendorId ? Number(draft.preferredVendorId) : null
    };

    try {
      if (product) {
        await put(`/products/${product.id}`, body);
        notify("success", `Saved ${draft.name}`);
      } else {
        await post("/products", body);
        notify("success", `Added ${draft.name} to inventory`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save the product");
    } finally {
      setSaving(false);
    }
  }

  async function adjust(sign: 1 | -1) {
    const amount = Number(delta);
    if (!current || !Number.isInteger(amount) || amount <= 0) {
      setFormError("Enter a whole number greater than zero to adjust stock.");
      return;
    }

    setAdjusting(true);
    setFormError("");
    try {
      const updated = await patch<Product>(`/products/${current.id}/stock`, {
        adjustment: sign * amount,
        ...(note.trim() ? { note: note.trim() } : {})
      });
      setCurrent(updated);
      setDraft(previous => ({ ...previous, quantity: String(updated.quantity) }));
      setDelta("");
      setNote("");
      notify("success", `${sign > 0 ? "Added" : "Removed"} ${amount} · ${updated.quantity} on hand`);
      onSaved();
      void loadHistory();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't adjust stock");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <Drawer
      title={product ? product.name : "Add product"}
      subtitle={product ? `${product.sku} · ${current?.quantity ?? product.quantity} on hand` : "New items start with the quantity you enter."}
      onClose={onClose}
    >
      <form onSubmit={save} className="form" id="product-form">
        <label className="field span-2">
          <span>Name</span>
          <input required value={draft.name} onChange={e => set("name")(e.target.value)} placeholder="Nitrile gloves (M)" />
        </label>
        <label className="field">
          <span>SKU</span>
          <input required value={draft.sku} onChange={e => set("sku")(e.target.value)} placeholder="GLV-001" />
        </label>
        <label className="field">
          <span>Category</span>
          <input list="category-options" value={draft.category} onChange={e => set("category")(e.target.value)} placeholder="PPE" />
          <datalist id="category-options">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="field">
          <span>On hand</span>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={draft.quantity}
            disabled={Boolean(product)}
            onChange={e => set("quantity")(e.target.value)}
          />
          {product && <small>Change this with Adjust stock below so it's logged.</small>}
        </label>
        <label className="field">
          <span>Reorder point</span>
          <input required type="number" min="0" step="1" value={draft.reorderPoint} onChange={e => set("reorderPoint")(e.target.value)} />
          <small>Restock when on hand drops below this.</small>
        </label>
        <label className="field">
          <span>Unit price</span>
          <input required type="number" min="0" step="0.01" value={draft.price} onChange={e => set("price")(e.target.value)} placeholder="0.00" />
        </label>
        <label className="field">
          <span>Expiry date</span>
          <input type="date" value={draft.expiresAt} onChange={e => set("expiresAt")(e.target.value)} />
        </label>
        <label className="field span-2">
          <span>Preferred vendor</span>
          <select value={draft.preferredVendorId} onChange={e => set("preferredVendorId")(e.target.value)}>
            <option value="">None</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <small>Used when drafting purchase orders from the reorder queue.</small>
        </label>
      </form>

      {formError && <p role="alert" className="form-error">{formError}</p>}

      <div className="drawer-actions">
        <button type="submit" form="product-form" className="button primary" disabled={saving}>
          {saving ? "Saving…" : product ? "Save changes" : "Add product"}
        </button>
        <button type="button" className="button" onClick={onClose}>Cancel</button>
      </div>

      {product && current && (
        <>
          <section className="drawer-section">
            <h3>Adjust stock</h3>
            <div className="adjust-row">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Units"
                aria-label="Units to adjust"
                value={delta}
                onChange={e => setDelta(e.target.value)}
              />
              <input
                placeholder="Note (optional), e.g. expired, cycle count"
                aria-label="Note"
                value={note}
                maxLength={200}
                onChange={e => setNote(e.target.value)}
              />
            </div>
            <div className="adjust-buttons">
              <button type="button" className="button" disabled={adjusting || current.quantity === 0} onClick={() => void adjust(-1)}>
                Remove from stock
              </button>
              <button type="button" className="button" disabled={adjusting} onClick={() => void adjust(1)}>
                Add to stock
              </button>
            </div>
          </section>

          <section className="drawer-section">
            <h3>History</h3>
            {history.length === 0 ? (
              <p className="muted">No movements recorded for this product yet.</p>
            ) : (
              <ul className="plain-list compact">
                {history.map(m => (
                  <li key={m.id}>
                    <div>
                      <div className="cell-title">{m.note ?? m.type.toLowerCase()}</div>
                      <div className="cell-sub">{relativeTime(m.createdAt)} · {m.quantityAfter} after</div>
                    </div>
                    <span className={`delta ${m.delta > 0 ? "up" : "down"}`}>{m.delta > 0 ? "+" : ""}{m.delta}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Drawer>
  );
}
