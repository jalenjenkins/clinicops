import type { Product } from "./api";

export const money = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const moneyShort = (value: number) =>
  value >= 10000
    ? `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`
    : money(value);

export const poNumber = (id: number) => `PO-${String(id).padStart(4, "0")}`;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

export function shortDate(iso: string): string {
  // Expiry dates are stored as UTC midnight, so format in UTC to avoid off-by-one days.
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type StockStatus = "OK" | "LOW" | "OUT";

export function stockStatus(p: Pick<Product, "quantity" | "reorderPoint">): StockStatus {
  if (p.quantity === 0) return "OUT";
  return p.quantity < p.reorderPoint ? "LOW" : "OK";
}

export const statusLabel: Record<StockStatus, string> = {
  OK: "In stock",
  LOW: "Low stock",
  OUT: "Out of stock"
};

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map(r => r.map(escape).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
