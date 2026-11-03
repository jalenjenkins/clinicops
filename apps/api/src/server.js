const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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

function validateProduct(body) {
  const name = typeof body.name === "string"
    ? body.name.trim()
    : "";

  const sku = typeof body.sku === "string"
    ? body.sku.trim()
    : "";

  const quantity = body.quantity;
  const reorderPoint = body.reorderPoint;
  const price = body.price;

  if (!name || !sku) return "Name and SKU are required";

  if (!Number.isInteger(quantity) || quantity < 0) {
    return "Quantity must be a non-negative integer";
  }

  if (!Number.isInteger(reorderPoint) || reorderPoint < 0) {
    return "Reorder point must be a non-negative integer";
  }

  if (typeof price !== "number" ||
      !Number.isFinite(price) || price < 0) {
    return "Price must be a non-negative number";
  }

  return null;
}

app.post("/api/products", async (req, res) => {
  const error = validateProduct(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const product = await prisma.product.create({
      data: {
        name: req.body.name.trim(),
        sku: req.body.sku.trim(),
        quantity: req.body.quantity,
        reorderPoint: req.body.reorderPoint,
        price: req.body.price
      }
    });

    res.status(201).json(product);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A product with this SKU already exists"
      });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to create product" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const error = validateProduct(req.body);

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const product = await prisma.product.update({
      where: { id: Number(req.params.id) },
      data: {
        name: req.body.name.trim(),
        sku: req.body.sku.trim(),
        quantity: req.body.quantity,
        reorderPoint: req.body.reorderPoint,
        price: req.body.price
      }
    });

    res.json(product);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ error: "SKU already exists" });
    }

    console.error(error);
    res.status(500).json({ error: "Unable to update product" });
  }
});

app.patch("/api/products/:id/stock", async (req, res) => {
  const id = Number(req.params.id);
  const adjustment = req.body.adjustment;

  if (!Number.isInteger(id) || id <= 0 ||
      !Number.isInteger(adjustment)) {
    return res.status(400).json({
      error: "Valid product ID and integer adjustment required"
    });
  }

  try {
    const result = await prisma.product.updateMany({
      where: {
        id,
        quantity: { gte: -adjustment }
      },
      data: {
        quantity: { increment: adjustment }
      }
    });

    if (result.count === 0) {
      return res.status(409).json({
        error: "Product not found or insufficient stock"
      });
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to adjust stock" });
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
app.post("/api/purchase-orders", async (req, res) => {
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
      include: { vendor: true, items: true }
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
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity }
          }
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

app.listen(PORT, () => {
  console.log(`ClinicOps API running on http://localhost:${PORT}`);
});