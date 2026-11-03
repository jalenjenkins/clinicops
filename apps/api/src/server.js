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

app.listen(PORT, () => {
  console.log(`ClinicOps API running on http://localhost:${PORT}`);
});