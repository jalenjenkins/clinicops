export const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export type Vendor = { id: number; name: string; email?: string | null; phone?: string | null };

export type Product = {
  id: number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  price: number;
  expiresAt: string | null;
  preferredVendorId: number | null;
};

export type ProductForm = {
  name: string;
  sku: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  price: number;
  expiresAt: string; // YYYY-MM-DD or ""
  preferredVendorId: number | null;
};

export type OrderStatus = "DRAFT" | "SUBMITTED" | "RECEIVED";

export type OrderItem = {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  product: { id: number; name: string; sku: string };
};

export type PurchaseOrder = {
  id: number;
  status: OrderStatus;
  createdAt: string;
  submittedAt: string | null;
  receivedAt: string | null;
  vendor: Vendor;
  items: OrderItem[];
};

export type MovementType = "INITIAL" | "RECEIPT" | "USAGE" | "ADJUSTMENT";

export type Movement = {
  id: number;
  type: MovementType;
  delta: number;
  quantityAfter: number;
  note: string | null;
  createdAt: string;
  product: { id: number; name: string; sku: string };
};

export type Recommendation = {
  productId: number;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  reorderPoint: number;
  onOrder: number;
  targetStock: number;
  suggestedQuantity: number;
  estimatedCost: number;
  preferredVendorId: number | null;
};

export type Dashboard = {
  kpis: {
    totalProducts: number;
    totalUnits: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    expiringValueAtRisk: number;
    openOrderCount: number;
    openOrderValue: number;
  };
  stockHealth: { OK: number; LOW: number; OUT: number };
  valueByCategory: { category: string; value: number; units: number; products: number }[];
  expiring: {
    productId: number;
    name: string;
    sku: string;
    quantity: number;
    expiresAt: string;
    daysLeft: number;
    valueAtRisk: number;
  }[];
  daysOfSupply: { productId: number; name: string; usagePerDay: number; daysOfSupply: number }[];
  reorderRecommendations: Recommendation[];
};

type ErrorBody = {
  error?: string;
  details?: { field: string; message: string }[];
};

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers
    });
  } catch {
    throw new Error("Can't reach the ClinicOps API. Check that the server is running on port 3001.");
  }

  const body = (await response.json().catch(() => ({}))) as ErrorBody & T;

  if (!response.ok) {
    const details = body.details?.map(d => `${d.field}: ${d.message}`).join(", ");
    throw new Error(details || body.error || `Request failed (${response.status})`);
  }

  return body;
}

export const post = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data) });

export const put = <T,>(path: string, data: unknown) =>
  request<T>(path, { method: "PUT", body: JSON.stringify(data) });

export const patch = <T,>(path: string, data?: unknown) =>
  request<T>(path, { method: "PATCH", body: data === undefined ? undefined : JSON.stringify(data) });
