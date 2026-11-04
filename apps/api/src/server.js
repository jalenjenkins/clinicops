const { PrismaClient } = require("@prisma/client");
const { computeDashboard } = require("./analytics");
const {
  productSchema,
  stockAdjustmentSchema,
  purchaseOrderSchema,
  validate
} = require("./validation");
const prisma = new PrismaClient();
const express = require("express");
const cors = require("cors");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("Origin not allowed by CORS"));
  }
}));
app.use(express.json());

app.param("id", (req, res, next, value) => {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      error: "Invalid resource ID"
    });
  }

  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "clinicops-api"
  });
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: "asc" }
    });

    res.json(products);
  } catch (error) {
    console.error("Failed to load products:", error);

    res.status(500).json({
      error: "Failed to load inventory"
    });
  }
});

// Zod has already validated and trimmed the body; this maps it to a Prisma payload.
function productData(body) {
  return {
    name: body.name,
    sku: body.sku,
    quantity: body.quantity,
    reorderPoint: body.reorderPoint,
    price: body.price,
    category: body.category,
    expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00.000Z`) : null,
    preferredVendorId: body.preferredVendorId ?? null
  };
}

// Every change to on-hand quantity goes through here so the audit trail stays complete.
function recordMovement(tx, { productId, type, delta, quantityAfter, note }) {
  return tx.stockMovement.create({
    data: { productId, type, delta, quantityAfter, note: note || null }
  });
}

app.post("/api/products", validate(productSchema), async (req, res) => {
  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: productData(req.body) });

      if (created.quantity > 0) {
        await recordMovement(tx, {
          productId: created.id,
          type: "INITIAL",
          delta: created.quantity,
          quantityAfter: created.quantity,
          note: "Product created"
        });
      }

      return created;
    });

    res.status(201).json(product);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A product with this SKU already exists"
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ error: "Preferred vendor not found" });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to create product" });
  }
});

app.put("/api/products/:id", validate(productSchema), async (req, res) => {
  const id = Number(req.params.id);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });

      if (!existing) {
        const error = new Error("Product not found");
        error.status = 404;
        throw error;
      }

      const updated = await tx.product.update({
        where: { id },
        data: productData(req.body)
      });

      // Editing the quantity directly is a manual correction; log it.
      if (updated.quantity !== existing.quantity) {
        await recordMovement(tx, {
          productId: id,
          type: "ADJUSTMENT",
          delta: updated.quantity - existing.quantity,
          quantityAfter: updated.quantity,
          note: "Quantity edited"
        });
      }

      return updated;
    });

    res.json(product);
  } catch (error) {
    if (error.status === 404 || error.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }

    if (error.code === "P2003") {
      return res.status(400).json({ error: "Preferred vendor not found" });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to update product" });
  }
});

app.patch("/api/products/:id/stock", validate(stockAdjustmentSchema), async (req, res) => {
  const id = Number(req.params.id);
  const { adjustment, note } = req.body;

  try {
    const product = await prisma.$transaction(async (tx) => {
      // The quantity guard makes the decrement atomic: stock can never go negative.
      const result = await tx.product.updateMany({
        where: { id, quantity: { gte: -adjustment } },
        data: { quantity: { increment: adjustment } }
      });

      if (result.count === 0) {
        const error = new Error("Product not found or insufficient stock");
        error.status = 409;
        throw error;
      }

      const updated = await tx.product.findUnique({ where: { id } });

      await recordMovement(tx, {
        productId: id,
        type: adjustment < 0 ? "USAGE" : "ADJUSTMENT",
        delta: adjustment,
        quantityAfter: updated.quantity,
        note
      });

      return updated;
    });

    res.json(product);
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to adjust stock" });
  }
});

// GET: Recent stock movements (audit trail), newest first
app.get("/api/movements", async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 25, 1), 100);
  const productId = req.query.productId === undefined ? null : Number(req.query.productId);

  if (productId !== null && (!Number.isSafeInteger(productId) || productId <= 0)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  try {
    const movements = await prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    res.json(movements);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load activity" });
  }
});

// GET: Everything the Overview page needs in one round trip
app.get("/api/dashboard", async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [products, orders, movements] = await Promise.all([
      prisma.product.findMany(),
      prisma.purchaseOrder.findMany({
        where: { status: { in: ["DRAFT", "SUBMITTED"] } },
        include: { items: true }
      }),
      prisma.stockMovement.findMany({
        where: { type: "USAGE", createdAt: { gte: since } }
      })
    ]);

    res.json(computeDashboard({ products, orders, movements }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load dashboard" });
  }
});

const validId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// GET: List all vendors
app.get("/api/vendors", async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: "asc" }
    });
    res.json(vendors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load vendors" });
  }
});

// GET: List purchase orders with vendor and product details
app.get("/api/purchase-orders", async (req, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        vendor: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load orders" });
  }
});

// POST: Create a draft purchase order
app.post("/api/purchase-orders", validate(purchaseOrderSchema), async (req, res) => {
  const vendorId = validId(req.body?.vendorId);
  const items = req.body?.items;

  if (!vendorId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Valid vendor and at least one item required"
    });
  }

  const productIds = new Set();

  for (const item of items) {
    const productId = validId(item?.productId);

    if (
      !productId ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      productIds.has(productId)
    ) {
      return res.status(400).json({
        error: "Each product must be unique with a positive integer quantity"
      });
    }

    productIds.add(productId);
  }

  try {
    const [vendor, products] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: vendorId } }),
      prisma.product.findMany({
        where: { id: { in: [...productIds] } }
      })
    ]);

    if (!vendor || products.length !== productIds.size) {
      return res.status(400).json({
        error: "Vendor or product not found"
      });
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    const order = await prisma.purchaseOrder.create({
      data: {
        vendorId,
        status: "DRAFT",
        items: {
          create: items.map(item => ({
            productId: Number(item.productId),
            quantity: item.quantity,
            unitPrice: productMap.get(Number(item.productId)).price
          }))
        }
      },
      include: {
        vendor: true,
        items: { include: { product: true } }
      }
    });

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to create order" });
  }
});

// PATCH: Submit a draft order
app.patch("/api/purchase-orders/:id/submit", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  try {
    const result = await prisma.purchaseOrder.updateMany({
      where: { id, status: "DRAFT" },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date()
      }
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: "Order not found or not in DRAFT status"
      });
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true, items: { include: { product: true } } }
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to submit order" });
  }
});

// PATCH: Receive an order and increase inventory atomically
app.patch("/api/purchase-orders/:id/receive", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Only one request can transition SUBMITTED -> RECEIVED.
      const result = await tx.purchaseOrder.updateMany({
        where: { id, status: "SUBMITTED" },
        data: {
          status: "RECEIVED",
          receivedAt: new Date()
        }
      });

      if (result.count !== 1) {
        const error = new Error("Order is not in SUBMITTED status");
        error.status = 409;
        throw error;
      }

      const items = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id }
      });

      for (const item of items) {
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity }
          }
        });

        await recordMovement(tx, {
          productId: item.productId,
          type: "RECEIPT",
          delta: item.quantity,
          quantityAfter: updated.quantity,
          note: `Received PO-${String(id).padStart(4, "0")}`
        });
      }

      return tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          vendor: true,
          items: { include: { product: true } }
        }
      });
    });

    res.json(order);
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ error: error.message });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to receive order" });
  }
});
app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: "An unexpected server error occurred"
  });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3001;

  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
}

module.exports = app;