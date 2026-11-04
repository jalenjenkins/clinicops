
# ClinicOps

**Healthcare Inventory & Supply Management | Full-Stack Application**

ClinicOps is a full-stack inventory operations platform designed to streamline supply management for healthcare clinics.

The application centralizes inventory tracking, purchase order management, vendor information, replenishment planning, and stock activity into a modern, responsive dashboard.

Built with **React, TypeScript, Node.js, Express, PostgreSQL, and Prisma**, ClinicOps demonstrates full-stack application development, relational database design, transactional workflows, RESTful API architecture, and data-driven operational analytics.

> **Note:** ClinicOps is a portfolio demonstration using fictional clinic data. It is not intended for clinical production use and does not claim HIPAA compliance.

---

## Features

### Operations Dashboard

A centralized overview of clinic inventory and purchasing activity.

- Real-time inventory valuation
- Total inventory units and product counts
- Low-stock and out-of-stock monitoring
- Open purchase order tracking
- Inventory health visualization
- Inventory valuation by category
- Expiration alerts and estimated value at risk
- Replenishment recommendations
- Estimated days of supply based on historical usage

### Inventory Management

Manage clinic supplies through a searchable inventory interface.

- Create and edit products
- Assign unique SKUs and product categories
- Track product quantities and unit prices
- Configure reorder thresholds
- Associate products with preferred vendors
- Record expiration dates
- Perform manual stock adjustments
- Monitor low-stock and out-of-stock items

### Purchase Order Management

Manage procurement from order creation through receiving.

**Purchase Order Lifecycle:**

DRAFT → SUBMITTED → RECEIVED

Capabilities include:

- Create vendor purchase orders
- Add multiple products and quantities
- Track unit prices and order totals
- Submit purchase orders
- Receive incoming inventory
- Automatically update inventory quantities
- Record corresponding stock movements
- Include outstanding orders in replenishment calculations

Receiving operations use Prisma database transactions to maintain consistency between purchase order status, inventory quantities, and stock movement records.

### Inventory Analytics

ClinicOps provides operational analytics derived from inventory, purchasing, and historical stock activity.

**Inventory Health**

Products are classified according to their stock levels and configured reorder thresholds.

**Expiration Monitoring**

Products approaching expiration within 30 days are identified, with estimated inventory value at risk.

**Days of Supply**

Historical usage over the previous 30 days is used to estimate daily consumption and remaining inventory coverage.

**Reorder Recommendations**

Suggested replenishment quantities consider both current inventory and quantities already included in outstanding purchase orders.

### Stock Movement History

Inventory changes are recorded through an append-only movement history.

Supported movement types include:

- Initial inventory
- Purchase order receipts
- Inventory usage
- Manual adjustments

Each movement records the quantity change, resulting inventory balance, timestamp, and optional notes.

### User Interface

The frontend provides a responsive operational interface with reusable components.

Major views include:

- Overview
- Inventory
- Purchase Orders
- Activity History

Additional UI elements include drawers, notifications, status indicators, and inventory visualizations.

---

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | CSS |
| Backend | Node.js, Express 5 |
| Database | PostgreSQL |
| ORM | Prisma 6 |
| Validation | Zod 4 |
| Testing | Vitest, Supertest |
| API Architecture | REST |

---

## System Architecture

ClinicOps follows a client-server architecture with separation between presentation, API logic, and persistence.

```mermaid
flowchart TD
    A[React + TypeScript Frontend]
    B[Express REST API]
    C[Zod Request Validation]
    D[Inventory & Purchasing Logic]
    E[Analytics Engine]
    F[Prisma ORM]
    G[(PostgreSQL Database)]
    H[Stock Movement History]

    A --> B
    B --> C
    C --> D
    C --> E
    D --> F
    E --> F
    F --> G
    D --> H
```

### Architectural Decisions

**Separation of Concerns**

Frontend components, API routes, validation logic, analytics calculations, and database access are organized into distinct responsibilities.

**Transactional Inventory Updates**

Purchase order receiving operations use database transactions to ensure related inventory updates succeed or fail together.

**Stock Movement Audit Trail**

Inventory changes generate movement records, allowing historical stock activity to be reviewed independently of current quantities.

**Server-Side Analytics**

Dashboard metrics are calculated by the backend using inventory records, purchase orders, and historical stock movements.

**Request Validation**

Zod validates incoming API requests and supports consistent error responses.

---

## Getting Started

### Prerequisites

Ensure the following are installed:

- Node.js
- npm
- PostgreSQL

### 1. Clone the Repository

```bash
git clone <repository-url>
cd clinicops
```

Replace `<repository-url>` with the GitHub repository URL.

### 2. Configure the Backend

Navigate to the API directory:

```bash
cd apps/api
```

Install dependencies:

```bash
npm install
```

Create your environment configuration:

```bash
cp .env.example .env
```

Configure the environment variables:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/clinicops
FRONTEND_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

Create a PostgreSQL database named `clinicops` if it does not already exist.

### 3. Initialize the Database

Apply Prisma migrations:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

Populate the database with demonstration data:

```bash
node prisma/seed.js
```

The seed script provides sample vendors, inventory products, stock usage history, and an open purchase order.

### 4. Start the Backend

```bash
npm run dev
```

The API runs at:

http://localhost:3001

Health check:

http://localhost:3001/api/health

### 5. Configure the Frontend

Open another terminal and navigate to:

```bash
cd apps/web
```

Install dependencies:

```bash
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

Configure the API URL:

```dotenv
VITE_API_URL=http://localhost:3001/api
```

### 6. Start the Frontend

```bash
npm run dev
```

Open:

http://localhost:5173

---

## API Reference

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check API health |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Retrieve operational metrics, inventory risks, and replenishment recommendations |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | Retrieve inventory products |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update product information |
| PATCH | `/api/products/:id/stock` | Adjust inventory quantity |

### Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | Retrieve vendors |

### Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | Retrieve purchase orders |
| POST | `/api/purchase-orders` | Create a purchase order |
| PATCH | `/api/purchase-orders/:id/submit` | Submit a purchase order |
| PATCH | `/api/purchase-orders/:id/receive` | Receive a purchase order and update inventory |

### Stock Movements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/movements` | Retrieve inventory movement history |

---

## Inventory Replenishment Logic

ClinicOps implements threshold-based replenishment recommendations.

The system considers:

1. Current quantity on hand
2. Product reorder threshold
3. Quantities on outstanding purchase orders
4. Historical inventory usage

The reorder target is twice the configured reorder point.

For products below their reorder point, the suggested order quantity is:

```text
Suggested Quantity =
MAX(
    0,
    (2 × Reorder Point)
    - Quantity On Hand
    - Quantity On Order
)
```

Quantity on order includes products in draft and submitted purchase orders, excluding received orders.

### Days of Supply

The system calculates average daily usage from inventory movements over the previous 30 days.

```text
Average Daily Usage =
Units Consumed Over 30 Days / 30
```

```text
Days of Supply =
Current Quantity / Average Daily Usage
```

These calculations provide basic operational planning estimates rather than predictive demand forecasting.

---

## Testing

The backend includes automated API testing using Vitest and Supertest.

Run backend tests:

```bash
cd apps/api
npm test
```

### Frontend Build

```bash
cd apps/web
npm run build
```

### Frontend Linting

```bash
cd apps/web
npm run lint
```

---

## Project Structure

```text
clinicops/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.js
│   │   ├── src/
│   │   │   ├── analytics.js
│   │   │   ├── server.js
│   │   │   └── validation.js
│   │   └── tests/
│   │
│   └── web/
│       ├── public/
│       └── src/
│           ├── components/
│           │   ├── Activity.tsx
│           │   ├── Drawer.tsx
│           │   ├── Gauge.tsx
│           │   ├── Icons.tsx
│           │   ├── Inventory.tsx
│           │   ├── Overview.tsx
│           │   ├── ProductDrawer.tsx
│           │   ├── PurchaseOrders.tsx
│           │   └── Toast.tsx
│           ├── lib/
│           │   ├── api.ts
│           │   └── format.ts
│           └── App.tsx
│
├── docs/
│   └── architecture/
├── exercises/
└── README.md
```

---

## Screenshots

Screenshots of the following application views can be added here:

- Operations Dashboard
- Inventory Management
- Purchase Order Management
- Stock Activity History

A live demonstration link can also be added when the application is deployed.

---

## Future Improvements

Potential enhancements include:

- Authentication and role-based access control
- Multi-location inventory management
- Barcode scanning
- Lot-level expiration tracking
- Automated low-stock notifications
- Vendor performance analytics
- CSV and PDF reporting
- More extensive integration and end-to-end tests
- Production deployment and monitoring
- Improved concurrency controls and idempotent receiving

---

## Project Purpose

ClinicOps was developed to demonstrate practical full-stack software engineering through a realistic inventory management use case.

The project emphasizes:

- Designing relational data models
- Building RESTful APIs
- Developing reusable React components
- Implementing transactional business workflows
- Maintaining inventory audit trails
- Translating operational data into actionable analytics
- Structuring and testing a full-stack application

The application is intended as a demonstration of software engineering practices and product-oriented development.

---

## License

No project-specific license has been established. A license can be added to define reuse and distribution terms.
