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