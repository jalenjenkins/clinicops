// Pure functions (no database, no Express) so the business rules are easy to test.

const TARGET_MULTIPLIER = 2;      // restock up to 2x the reorder point
const EXPIRY_WINDOW_DAYS = 30;    // "expiring soon" horizon
const USAGE_WINDOW_DAYS = 30;     // look-back for average daily usage
const DAY_MS = 24 * 60 * 60 * 1000;

function stockStatus(product) {
  if (product.quantity === 0) return "OUT";
  if (product.quantity < product.reorderPoint) return "LOW";
  return "OK";
}

// Units already ordered (DRAFT or SUBMITTED) but not yet received, by product id.
function onOrderByProduct(orders) {
  const map = new Map();
  for (const order of orders) {
    if (order.status !== "DRAFT" && order.status !== "SUBMITTED") continue;
    for (const item of order.items) {
      map.set(item.productId, (map.get(item.productId) || 0) + item.quantity);
    }
  }
  return map;
}

// Average units consumed per day from USAGE movements in the look-back window.
function usagePerDay(movements, now = new Date(), windowDays = USAGE_WINDOW_DAYS) {
  const since = now.getTime() - windowDays * DAY_MS;
  const map = new Map();
  for (const m of movements) {
    if (m.type !== "USAGE" || new Date(m.createdAt).getTime() < since) continue;
    map.set(m.productId, (map.get(m.productId) || 0) + Math.abs(m.delta));
  }
  for (const [id, total] of map) map.set(id, total / windowDays);
  return map;
}

function daysUntil(date, now = new Date()) {
  return Math.ceil((new Date(date).getTime() - now.getTime()) / DAY_MS);
}

// Inventory position = on hand + on order. Only suggest what is still missing.
function buildReorderRecommendations(products, onOrder = new Map()) {
  return products
    .filter(p => p.quantity < p.reorderPoint)
    .map(p => {
      const incoming = onOrder.get(p.id) || 0;
      const targetStock = p.reorderPoint * TARGET_MULTIPLIER;
      const suggestedQuantity = Math.max(0, targetStock - p.quantity - incoming);
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        quantity: p.quantity,
        reorderPoint: p.reorderPoint,
        onOrder: incoming,
        targetStock,
        suggestedQuantity,
        estimatedCost: suggestedQuantity * p.price,
        preferredVendorId: p.preferredVendorId ?? null
      };
    })
    .filter(r => r.suggestedQuantity > 0)
    .sort((a, b) => a.quantity / (a.reorderPoint || 1) - b.quantity / (b.reorderPoint || 1));
}

function computeDashboard({ products, orders, movements, now = new Date() }) {
  const onOrder = onOrderByProduct(orders);
  const usage = usagePerDay(movements, now);

  const statusCounts = { OK: 0, LOW: 0, OUT: 0 };
  const byCategory = new Map();
  let totalUnits = 0;
  let inventoryValue = 0;

  for (const p of products) {
    statusCounts[stockStatus(p)] += 1;
    totalUnits += p.quantity;
    const value = p.quantity * p.price;
    inventoryValue += value;
    const entry = byCategory.get(p.category) || { category: p.category, value: 0, units: 0, products: 0 };
    entry.value += value;
    entry.units += p.quantity;
    entry.products += 1;
    byCategory.set(p.category, entry);
  }

  const expiring = products
    .filter(p => p.expiresAt && p.quantity > 0 && daysUntil(p.expiresAt, now) <= EXPIRY_WINDOW_DAYS)
    .map(p => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      quantity: p.quantity,
      expiresAt: p.expiresAt,
      daysLeft: daysUntil(p.expiresAt, now),
      valueAtRisk: p.quantity * p.price
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const openOrders = orders.filter(o => o.status === "DRAFT" || o.status === "SUBMITTED");
  const openOrderValue = openOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0), 0
  );

  const daysOfSupply = products
    .map(p => {
      const perDay = usage.get(p.id) || 0;
      return {
        productId: p.id,
        name: p.name,
        usagePerDay: perDay,
        daysOfSupply: perDay > 0 ? Math.floor(p.quantity / perDay) : null
      };
    })
    .filter(p => p.daysOfSupply !== null)
    .sort((a, b) => a.daysOfSupply - b.daysOfSupply);

  return {
    kpis: {
      totalProducts: products.length,
      totalUnits,
      inventoryValue,
      lowStockCount: statusCounts.LOW,
      outOfStockCount: statusCounts.OUT,
      expiringSoonCount: expiring.length,
      expiringValueAtRisk: expiring.reduce((s, e) => s + e.valueAtRisk, 0),
      openOrderCount: openOrders.length,
      openOrderValue
    },
    stockHealth: statusCounts,
    valueByCategory: [...byCategory.values()].sort((a, b) => b.value - a.value),
    expiring,
    daysOfSupply: daysOfSupply.slice(0, 6),
    reorderRecommendations: buildReorderRecommendations(products, onOrder)
  };
}

module.exports = {
  TARGET_MULTIPLIER,
  EXPIRY_WINDOW_DAYS,
  stockStatus,
  onOrderByProduct,
  usagePerDay,
  daysUntil,
  buildReorderRecommendations,
  computeDashboard
};
