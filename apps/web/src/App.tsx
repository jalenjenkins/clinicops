import { useEffect, useState } from "react";
import "./App.css";
import PurchaseOrders from "./components/PurchaseOrders";

type Product = {
  id: number;
  name: string;
  sku: string;
  quantity: number;
  reorderPoint: number;
  price: number;
};

type ProductForm = Omit<Product, "id">;

const API = "http://localhost:3001/api";

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  quantity: 0,
  reorderPoint: 10,
  price: 0
};

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [activePage, setActivePage] = useState<"inventory" | "orders">("inventory");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] =
    useState<"all" | "low" | "healthy">("all");


  async function loadProducts() {
    setLoading(true);

    try {
      const response = await fetch(`${API}/products`);
      if (!response.ok) throw new Error("Unable to load inventory");
      setProducts(await response.json());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  // useEffect(() => {
  //   loadProducts();
  // }, []);

  useEffect(() => {
    if (activePage === "inventory") {
      void loadProducts();
    }
  }, [activePage]);

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingId
        ? `${API}/products/${editingId}`
        : `${API}/products`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save product");
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      reorderPoint: product.reorderPoint,
      price: product.price
    });
  }

  async function adjustStock(product: Product, adjustment: number) {
    try {
      const response = await fetch(`${API}/products/${product.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to adjust stock");
      }

      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  const totalValue = products.reduce(
    (sum, product) => sum + product.quantity * product.price,
    0
  );

  const lowStockCount = products.filter(
    product => product.quantity < product.reorderPoint
  ).length;
  const totalUnits = products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase());

    const isLowStock = product.quantity < product.reorderPoint;

    const matchesFilter =
      stockFilter === "all" ||
      (stockFilter === "low" && isLowStock) ||
      (stockFilter === "healthy" && !isLowStock);

    return matchesSearch && matchesFilter;
  });
  const reorderRecommendations = products
    .filter(product => product.quantity < product.reorderPoint)
    .map(product => {
      const targetStock = product.reorderPoint * 2;
      const suggestedQuantity = targetStock - product.quantity;

      return {
        ...product,
        targetStock,
        suggestedQuantity,
        estimatedCost: suggestedQuantity * product.price
      };
    });

  const totalReorderCost = reorderRecommendations.reduce(
    (sum, product) => sum + product.estimatedCost,
    0
  );
  return (
    <main style={{ padding: 32, maxWidth: 1200, margin: "auto" }}>
      <h1>ClinicOps</h1>
      <p>Healthcare Inventory Management</p>
      <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActivePage("inventory")}
        >
          Inventory
        </button>

        <button
          type="button"
          onClick={() => setActivePage("orders")}
        >
          Purchase Orders
        </button>
      </nav>
      {activePage === "inventory" && (
        <>
          <section>
            <h2>Inventory Overview</h2>
            <p>Total Products: {products.length}</p>
            <p>Total Units: {totalUnits}</p>
            <p>Low Stock: {lowStockCount}</p>
            <p>Total Inventory Value: ${totalValue.toFixed(2)}</p>
          </section>
          <section style={{ marginTop: 32 }}>
            <h2>Reorder Recommendations</h2>

            {reorderRecommendations.length === 0 ? (
              <p>All products are sufficiently stocked.</p>
            ) : (
              <>
                <p>
                  {reorderRecommendations.length} products need restocking.
                </p>

                <p>
                  Estimated Reorder Cost: ${totalReorderCost.toFixed(2)}
                </p>

                <table border={1} cellPadding={12}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Current Stock</th>
                      <th>Reorder Point</th>
                      <th>Suggested Quantity</th>
                      <th>Estimated Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reorderRecommendations.map(product => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.quantity}</td>
                        <td>{product.reorderPoint}</td>
                        <td>{product.suggestedQuantity}</td>
                        <td>${product.estimatedCost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
          {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

          <section>
            <h2>{editingId ? "Edit Product" : "Add Product"}</h2>

            <form onSubmit={saveProduct}>
              {(["name", "sku", "quantity", "reorderPoint", "price"] as const)
                .map(field => (
                  <label
                    key={field}
                    style={{ display: "block", marginBottom: 12 }}
                  >
                    {field}
                    <input
                      required
                      type={field === "name" || field === "sku" ? "text" : "number"}
                      min={field === "name" || field === "sku" ? undefined : 0}
                      step={field === "price" ? "0.01" : "1"}
                      value={form[field]}
                      onChange={event => setForm(previous => ({
                        ...previous,
                        [field]:
                          field === "name" || field === "sku"
                            ? event.target.value
                            : Number(event.target.value)
                      }))}
                      style={{ marginLeft: 12 }}
                    />
                  </label>
                ))}

              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Product" : "Add Product"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ ...emptyForm });
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </section>

          <section style={{ marginTop: 32 }}>
            <h2>Inventory</h2>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input
                type="text"
                placeholder="Search products or SKU..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />

              <select
                value={stockFilter}
                onChange={event =>
                  setStockFilter(event.target.value as "all" | "low" | "healthy")
                }
              >
                <option value="all">All Stock</option>
                <option value="low">Low Stock</option>
                <option value="healthy">Healthy Stock</option>
              </select>
            </div>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <table border={1} cellPadding={12}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Quantity</th>
                    <th>Reorder Point</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (<tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.quantity}</td>
                    <td>{product.reorderPoint}</td>
                    <td>${product.price.toFixed(2)}</td>
                    <td>
                      {product.quantity < product.reorderPoint
                        ? "Low Stock"
                        : "In Stock"}
                    </td>
                    <td>
                      <button onClick={() => editProduct(product)}>
                        Edit
                      </button>
                      <button onClick={() => adjustStock(product, 1)}>
                        +1
                      </button>
                      <button onClick={() => adjustStock(product, -1)}>
                        -1
                      </button>
                    </td>
                  </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {activePage === "orders" && <PurchaseOrders />}
    </main>
  );
}

export default App;