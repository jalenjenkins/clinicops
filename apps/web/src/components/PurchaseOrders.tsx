
import { useEffect, useState } from "react";

const API = "http://localhost:3001/api";

type Vendor = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  sku: string;
};

type OrderItem = {
  id: number;
  quantity: number;
  unitPrice: number;
  product: Product;
};

type PurchaseOrder = {
  id: number;
  status: "DRAFT" | "SUBMITTED" | "RECEIVED";
  createdAt: string;
  vendor: Vendor;
  items: OrderItem[];
};

export default function PurchaseOrders() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function getJSON(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Unable to load data");
    return response.json();
  }

  async function loadData() {
    setLoading(true);
    try {
      const [v, p, o] = await Promise.all([
        getJSON(`${API}/vendors`),
        getJSON(`${API}/products`),
        getJSON(`${API}/purchase-orders`)
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
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function createOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`${API}/purchase-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: Number(vendorId),
          items: [
            { productId: Number(productId), quantity }
          ]
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to create order");
      }

      setVendorId("");
      setProductId("");
      setQuantity(1);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: number, action: "submit" | "receive") {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/purchase-orders/${id}/${action}`,
        { method: "PATCH" }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to update order");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const orderTotal = (order: PurchaseOrder) =>
    order.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

  return (
    <section>
      <h2>Purchase Orders</h2>
      <p>Create orders and receive medical supplies.</p>

      {error && <p role="alert" style={{ color: "red" }}>{error}</p>}

      <h3>Create Purchase Order</h3>
      <form onSubmit={createOrder}>
        <label>
          Vendor{" "}
          <select
            required
            value={vendorId}
            onChange={e => setVendorId(e.target.value)}
          >
            <option value="">Select vendor</option>
            {vendors.map(vendor => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>{" "}

        <label>
          Product{" "}
          <select
            required
            value={productId}
            onChange={e => setProductId(e.target.value)}
          >
            <option value="">Select product</option>
            {products.map(product => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </select>
        </label>{" "}

        <label>
          Quantity{" "}
          <input
            type="number"
            min="1"
            step="1"
            required
            value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
          />
        </label>{" "}

        <button disabled={busy} type="submit">
          Create Draft Order
        </button>
      </form>

      <h3>Order History</h3>

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No purchase orders yet.</p>
      ) : (
        <table border={1} cellPadding={12}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Vendor</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>PO-{String(order.id).padStart(4, "0")}</td>
                <td>{order.vendor.name}</td>
                <td>
                  {order.items.map(item => (
                    <div key={item.id}>
                      {item.product.name} × {item.quantity}
                    </div>
                  ))}
                </td>
                <td>${orderTotal(order).toFixed(2)}</td>
                <td>{order.status}</td>
                <td>
                  {order.status === "DRAFT" && (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(order.id, "submit")}
                    >
                      Submit
                    </button>
                  )}
                  {order.status === "SUBMITTED" && (
                    <button
                      disabled={busy}
                      onClick={() => changeStatus(order.id, "receive")}
                    >
                      Receive
                    </button>
                  )}
                  {order.status === "RECEIVED" && "Completed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
