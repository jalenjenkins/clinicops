# ClinicOps

**Healthcare Inventory & Supply Management Platform**

ClinicOps is a full-stack application for managing medical supply inventory, vendor purchase orders, stock levels, and replenishment recommendations.

## Features

- **Inventory management:** Create, edit, and track medical supplies.
- **Stock adjustments:** Update inventory quantities with database-backed operations.
- **Purchase orders:** Create, submit, and receive vendor orders.
- **Automated receiving:** Update inventory when orders are received.
- **Dashboard:** View inventory value, total units, and low-stock counts.
- **Search and filtering:** Find products and identify inventory shortages.
- **Reorder recommendations:** Calculate suggested replenishment quantities.
- **API validation:** Reject malformed or invalid requests.
- **Automated tests:** Check core API validation and error-handling behavior.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod |
| Testing | Vitest, Supertest |

## Architecture

React communicates with an Express REST API. The backend uses Prisma to read and write data in PostgreSQL.

Purchase-order receiving uses a database transaction to update order status and inventory quantities together.

## Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL

### Backend

1. Navigate to `apps/api`.
2. Install dependencies using `npm install`.
3. Configure the environment using `.env.example`.
4. Run the existing Prisma migrations.
5. Run `npm run dev`.

### Frontend

1. Navigate to `apps/web`.
2. Install dependencies using `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173`.

## Testing

Run the API test suite:

```bash
cd apps/api
npm test
```

Build the frontend:

```bash
cd apps/web
npm run build
```

## Demo

Add screenshots and the deployed application URL here.

## Project Scope

ClinicOps is a portfolio demonstration using fictional healthcare inventory and vendor data. It is not intended for production clinical use and does not claim HIPAA compliance.

## Future Improvements

- Authentication and role-based permissions
- Multi-location inventory
- Vendor-specific acquisition pricing
- Audit logging
- Inventory forecasting
- Barcode scanning
- Reporting exports