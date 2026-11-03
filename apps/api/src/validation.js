const { z } = require("zod");

const positiveId = z.number().int().positive();

const productSchema = z.object({
  name: z.string().trim().min(1).max(150),
  sku: z.string().trim().min(1).max(50),
  quantity: z.number().int().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  price: z.number().finite().nonnegative()
}).strict();

const stockAdjustmentSchema = z.object({
  adjustment: z.number().int().refine(
    value => value !== 0,
    "Adjustment cannot be zero"
  )
}).strict();

const purchaseOrderSchema = z.object({
  vendorId: positiveId,
  items: z.array(
    z.object({
      productId: positiveId,
      quantity: z.number().int().positive()
    }).strict()
  ).min(1)
}).strict().refine(
  data => new Set(data.items.map(item => item.productId)).size === data.items.length,
  {
    message: "Duplicate products are not allowed in one order",
    path: ["items"]
  }
);

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      });
    }

    req.body = result.data;
    next();
  };
}

module.exports = {
  productSchema,
  stockAdjustmentSchema,
  purchaseOrderSchema,
  validate
};