import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../lib/api";
import type { Product, Vendor } from "../lib/api";
import { daysUntil, downloadCsv, money, shortDate, statusLabel, stockStatus } from "../lib/format";
import Gauge from "./Gauge";
import { DownloadIcon, PlusIcon, SearchIcon } from "./Icons";
import ProductDrawer from "./ProductDrawer";

type Filter = "all" | "reorder" | "expiring";
type Sort = "name" | "stock" | "expiry" | "price";

function ExpiryCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="muted">No expiry</span>;
  const days = daysUntil(iso);
  const tone = days <= 0 || days <= 14 ? "crit" : days <= 30 ? "watch" : "";
  return (
    <div>
      <div className={tone ? `expiry ${tone}` : "expiry"}>{shortDate(iso)}</div>
      {days <= 30 && <div className="cell-sub">{days <= 0 ? "Expired" : `${days} days left`}</div>}
    </div>
  );
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, v] = await Promise.all([request<Product[]>("/products"), request<Vendor[]>("/vendors")]);
      setProducts(p);
      setVendors(v);
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

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category))].sort(),
    [products]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products
      .filter(p => {
        if (term && !p.name.toLowerCase().includes(term) && !p.sku.toLowerCase().includes(term)) return false;
        if (category !== "all" && p.category !== category) return false;
        if (filter === "reorder") return stockStatus(p) !== "OK";
        if (filter === "expiring") return p.expiresAt !== null && p.quantity > 0 && daysUntil(p.expiresAt) <= 30;
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "stock": return a.quantity / (a.reorderPoint || 1) - b.quantity / (b.reorderPoint || 1);
          case "expiry": return (a.expiresAt ? Date.parse(a.expiresAt) : Infinity) - (b.expiresAt ? Date.parse(b.expiresAt) : Infinity);
          case "price": return b.price - a.price;
          default: return a.name.localeCompare(b.name);
        }
      });
  }, [products, search, category, filter, sort]);

  const vendorName = (id: number | null) => vendors.find(v => v.id === id)?.name ?? "";

  function exportCsv() {
    downloadCsv("clinicops-inventory.csv", [
      ["SKU", "Name", "Category", "On hand", "Reorder point", "Unit price", "Expiry", "Vendor"],
      ...visible.map(p => [p.sku, p.name, p.category, p.quantity, p.reorderPoint, p.price.toFixed(2), p.expiresAt?.slice(0, 10) ?? "", vendorName(p.preferredVendorId)])
    ]);
  }

  const counts = {
    reorder: products.filter(p => stockStatus(p) !== "OK").length,
    expiring: products.filter(p => p.expiresAt && p.quantity > 0 && daysUntil(p.expiresAt) <= 30).length
  };

  return (
    <>
      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by name or SKU"
            aria-label="Search products"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>

        <div className="segmented" role="group" aria-label="Filter products">
          <button type="button" className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All {products.length}</button>
          <button type="button" className={filter === "reorder" ? "on" : ""} onClick={() => setFilter("reorder")}>Needs reorder {counts.reorder}</button>
          <button type="button" className={filter === "expiring" ? "on" : ""} onClick={() => setFilter("expiring")}>Expiring {counts.expiring}</button>
        </div>

        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select aria-label="Sort by" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="name">Sort: Name</option>
          <option value="stock">Sort: Lowest stock first</option>
          <option value="expiry">Sort: Soonest expiry</option>
          <option value="price">Sort: Highest price</option>
        </select>

        <div className="toolbar-end">
          <button type="button" className="button" onClick={exportCsv} disabled={visible.length === 0}>
            <DownloadIcon /> Export CSV
          </button>
          <button type="button" className="button primary" onClick={() => setEditing("new")}>
            <PlusIcon /> Add product
          </button>
        </div>
      </div>

      {error ? (
        <div className="empty-state">
          <h2>Inventory didn't load</h2>
          <p>{error}</p>
          <button type="button" className="button primary" onClick={() => { setLoading(true); void load(); }}>Try again</button>
        </div>
      ) : loading ? (
        <div className="loading">Loading inventory…</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <h2>No products yet</h2>
          <p>Add your first supply item to start tracking stock levels and expiry dates.</p>
          <button type="button" className="button primary" onClick={() => setEditing("new")}>Add product</button>
        </div>
      ) : (
        <section className="panel flush">
          <div className="table-wrap">
            <table className="table interactive">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>On hand</th>
                  <th>Expiry</th>
                  <th className="num">Unit price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="panel-empty">
                      No products match these filters.{" "}
                      <button type="button" className="link" onClick={() => { setSearch(""); setCategory("all"); setFilter("all"); }}>
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : visible.map(p => {
                  const status = stockStatus(p);
                  return (
                    <tr key={p.id} tabIndex={0} onClick={() => setEditing(p)} onKeyDown={e => { if (e.key === "Enter") setEditing(p); }}>
                      <td>
                        <div className="cell-title">{p.name}</div>
                        <div className="cell-sub">{p.sku}</div>
                      </td>
                      <td>{p.category}</td>
                      <td className="gauge-cell">
                        <Gauge quantity={p.quantity} reorderPoint={p.reorderPoint} />
                        <span className="gauge-text">{p.quantity} <em>· reorder at {p.reorderPoint}</em></span>
                      </td>
                      <td><ExpiryCell iso={p.expiresAt} /></td>
                      <td className="num">{money(p.price)}</td>
                      <td><span className={`chip ${status === "OK" ? "ok" : status === "LOW" ? "watch" : "crit"}`}>{statusLabel[status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <ProductDrawer
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          vendors={vendors}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </>
  );
}
