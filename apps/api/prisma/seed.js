const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

const vendors = [
  { name: "MedSupply Direct", email: "orders@medsupply.example", phone: "555-0101" },
  { name: "Carolina Medical Distribution", email: "sales@carolinamedical.example", phone: "555-0102" },
  { name: "Premier Clinical Supplies", email: "support@premierclinical.example", phone: "555-0103" }
];

// vendor = index into `vendors`; expiresInDays is relative so the demo never goes stale.
const products = [
  { sku: "GLV-001", name: "Nitrile Gloves (M)", category: "PPE", quantity: 40, reorderPoint: 60, price: 12.5, vendor: 0, expiresInDays: 400, usage: 6 },
  { sku: "GLV-002", name: "Nitrile Gloves (L)", category: "PPE", quantity: 140, reorderPoint: 60, price: 12.5, vendor: 0, expiresInDays: 400, usage: 4 },
  { sku: "MSK-001", name: "Procedure Masks (50 ct)", category: "PPE", quantity: 85, reorderPoint: 40, price: 9.75, vendor: 0, expiresInDays: 300, usage: 3 },
  { sku: "SYR-001", name: "Syringes 3 mL", category: "Needles & Syringes", quantity: 10, reorderPoint: 40, price: 8, vendor: 1, expiresInDays: 220, usage: 5 },
  { sku: "NDL-001", name: "Safety Needles 22G", category: "Needles & Syringes", quantity: 0, reorderPoint: 30, price: 14.2, vendor: 1, expiresInDays: 180, usage: 3 },
  { sku: "BND-001", name: "Adhesive Bandages", category: "Wound Care", quantity: 220, reorderPoint: 80, price: 5, vendor: 2, expiresInDays: 500, usage: 5 },
  { sku: "GZE-001", name: "Sterile Gauze 4x4", category: "Wound Care", quantity: 32, reorderPoint: 50, price: 6.4, vendor: 2, expiresInDays: 26, usage: 3 },
  { sku: "ALC-001", name: "Alcohol Prep Pads", category: "Wound Care", quantity: 300, reorderPoint: 100, price: 3.2, vendor: 2, expiresInDays: 12, usage: 8 },
  { sku: "TST-001", name: "Rapid Strep Test Kits", category: "Diagnostics", quantity: 18, reorderPoint: 20, price: 42, vendor: 1, expiresInDays: 21, usage: 1 },
  { sku: "TST-002", name: "Urine Test Strips", category: "Diagnostics", quantity: 60, reorderPoint: 25, price: 18.9, vendor: 1, expiresInDays: 240, usage: 1 },
  { sku: "VAC-001", name: "Influenza Vaccine (10 dose)", category: "Pharmaceuticals", quantity: 24, reorderPoint: 15, price: 118, vendor: 0, expiresInDays: 45, usage: 1 },
  { sku: "SAL-001", name: "Saline Flush 10 mL", category: "Pharmaceuticals", quantity: 95, reorderPoint: 50, price: 1.85, vendor: 0, expiresInDays: 330, usage: 4 }
];

async function main() {
  // Vendors (idempotent by name)
  const vendorRecords = [];
  for (const vendor of vendors) {
    const existing = await prisma.vendor.findFirst({ where: { name: vendor.name } });
    vendorRecords.push(existing || await prisma.vendor.create({ data: vendor }));
  }

  // Products (idempotent by SKU). Existing rows are refreshed so category/expiry/vendor
  // show up after the schema change, but quantities are left alone.
  const productRecords = [];
  for (const item of products) {
    const { vendor, expiresInDays, usage, ...fields } = item;
    const extras = {
      category: fields.category,
      expiresAt: daysFromNow(expiresInDays),
      preferredVendorId: vendorRecords[vendor].id
    };

    const record = await prisma.product.upsert({
      where: { sku: fields.sku },
      update: extras,
      create: { ...fields, ...extras }
    });

    productRecords.push({ record, usage });
  }

  // Movement history is only generated once, so re-seeding never duplicates it.
  const movementCount = await prisma.stockMovement.count();

  if (movementCount === 0) {
    const rows = [];

    for (const { record, usage } of productRecords) {
      let running = record.quantity;
      const entries = [];

      // Usage every other day over the last four weeks, plus one mid-month receipt.
      for (let day = 1; day <= 28; day += 1) {
        const used = Math.max(0, Math.round(usage * (0.5 + ((day * 7 + record.id * 3) % 10) / 10)));

        if (used > 0 && day % 2 === 0) {
          entries.push({ day, type: "USAGE", delta: -used, note: "Daily clinic usage" });
        }
      }

      entries.push({ day: 15, type: "RECEIPT", delta: Math.round(record.reorderPoint * 1.2), note: "Weekly delivery" });
      // Replay newest (smallest day) to oldest so the latest movement ends at the
      // product's current quantity, then undo each delta to get earlier balances.
      entries.sort((a, b) => a.day - b.day);
      for (const entry of entries) {
        rows.push({
          productId: record.id,
          type: entry.type,
          delta: entry.delta,
          quantityAfter: Math.max(0, running),
          note: entry.note,
          createdAt: daysFromNow(-entry.day)
        });
        running -= entry.delta;
      }
    }

    await prisma.stockMovement.createMany({ data: rows });
  }

  // One submitted order in flight so "on order" shows up in the demo.
  const orderCount = await prisma.purchaseOrder.count();

  if (orderCount === 0) {
    const syringes = productRecords.find(p => p.record.sku === "SYR-001").record;

    await prisma.purchaseOrder.create({
      data: {
        vendorId: vendorRecords[1].id,
        status: "SUBMITTED",
        submittedAt: daysFromNow(-1),
        items: { create: [{ productId: syringes.id, quantity: 30, unitPrice: syringes.price }] }
      }
    });
  }

  console.log("ClinicOps demo data ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
