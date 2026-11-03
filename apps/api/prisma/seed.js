const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const products = [
    {
      sku: "GLV-001",
      name: "Medical Gloves",
      quantity: 40,
      reorderPoint: 15,
      price: 12.5
    },
    {
      sku: "SYR-001",
      name: "Syringes",
      quantity: 10,
      reorderPoint: 20,
      price: 8
    },
    {
      sku: "BND-001",
      name: "Bandages",
      quantity: 75,
      reorderPoint: 25,
      price: 5
    }
  ];

  const vendors = [
  {
    name: "MedSupply Direct",
    email: "orders@medsupply.example",
    phone: "555-0101"
  },
  {
    name: "Carolina Medical Distribution",
    email: "sales@carolinamedical.example",
    phone: "555-0102"
  },
  {
    name: "Premier Clinical Supplies",
    email: "support@premierclinical.example",
    phone: "555-0103"
  }
];

for (const vendor of vendors) {
  const existing = await prisma.vendor.findFirst({
    where: { name: vendor.name }
  });

  if (!existing) {
    await prisma.vendor.create({
      data: vendor
    });
  }
}

console.log("Sample vendors created.");
  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product
    });
  }

  console.log("ClinicOps sample inventory created.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());