const { describe, it, expect } = await import("vitest"); const request = require("supertest");
const app = require("../src/server");

describe("ClinicOps API", () => {
    it("returns a successful health check", async () => {
        const response = await request(app)
            .get("/api/health");

        expect(response.status).toBe(200);
    });

    it("rejects negative product quantities", async () => {
        const response = await request(app)
            .post("/api/products")
            .send({
                name: "Invalid Product",
                sku: "INVALID-NEGATIVE-TEST",
                quantity: -5,
                reorderPoint: 10,
                price: 12.5
            });

        expect(response.status).toBe(400);
    });

    it("rejects empty product names", async () => {
        const response = await request(app)
            .post("/api/products")
            .send({
                name: "",
                sku: "INVALID-NAME-TEST",
                quantity: 5,
                reorderPoint: 10,
                price: 12.5
            });

        expect(response.status).toBe(400);
    });

    it("rejects malformed product IDs", async () => {
        const response = await request(app)
            .patch("/api/products/abc/stock")
            .send({ adjustment: 1 });

        expect(response.status).toBe(400);
    });

    it("rejects zero stock adjustments", async () => {
        const response = await request(app)
            .patch("/api/products/1/stock")
            .send({ adjustment: 0 });

        expect(response.status).toBe(400);
    });

    it("rejects purchase orders without items", async () => {
        const response = await request(app)
            .post("/api/purchase-orders")
            .send({
                vendorId: 1,
                items: []
            });

        expect(response.status).toBe(400);
    });

    it("rejects duplicate products in an order", async () => {
        const response = await request(app)
            .post("/api/purchase-orders")
            .send({
                vendorId: 1,
                items: [
                    { productId: 1, quantity: 5 },
                    { productId: 1, quantity: 10 }
                ]
            });

        expect(response.status).toBe(400);
    });
});