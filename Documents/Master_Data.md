# Master Data Module — Antigravity Implementation Specification

**Project:** Material Requirements Planning (MRP) Management System  
**Module:** Master Data  
**Status:** Implementation specification  
**Target stack:** React + Vite + TypeScript, FastAPI + Python, SQLAlchemy 2.x, PostgreSQL, Pydantic

---

## 1. Objective

Implement a production-quality **Master Data** module that provides the foundational records required by BOM, Inventory, Production Planning, MRP, and Procurement.

Master data must be centrally managed, validated, searchable, auditable, and reusable by downstream modules. Do not implement MRP calculations in this milestone.

## 2. Scope

### In scope
- Material master CRUD
- Product master CRUD (finished goods and semi-finished goods)
- Supplier master CRUD
- Search, filtering, sorting, pagination
- Active/inactive status
- Detail and edit forms
- Validation and duplicate prevention
- Database migrations
- API and service tests
- Responsive frontend screens and reusable form/table components

### Out of scope for this milestone
- BOM creation and explosion
- Inventory balances or stock transactions
- Purchase orders
- Production orders
- MRP run calculations
- Role-based authorization beyond the existing authentication foundation

Build the module so future modules can reference its IDs without duplicating master records.

---

## 3. Domain model and business rules

### 3.1 Material

A material represents a purchased, manufactured, or otherwise planned component.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | System | Primary key |
| `material_code` | string | Yes | Unique, trimmed, uppercase; 3–30 chars |
| `name` | string | Yes | 2–120 chars |
| `description` | string | No | Max 500 chars |
| `material_type` | enum | Yes | `RAW`, `COMPONENT`, `PACKAGING`, `CONSUMABLE`, `SUBASSEMBLY` |
| `unit_of_measure` | string/enum | Yes | e.g. `EA`, `KG`, `G`, `L`, `M`, `BOX` |
| `procurement_type` | enum | Yes | `BUY`, `MAKE`, `BOTH` |
| `lead_time_days` | integer | Yes | 0–3650; default 0 |
| `safety_stock` | decimal | Yes | ≥ 0; default 0 |
| `minimum_order_qty` | decimal | Yes | ≥ 0; default 0 |
| `lot_size` | enum | Yes | `LOT_FOR_LOT`, `FIXED`, `PERIOD`; default `LOT_FOR_LOT` |
| `fixed_lot_size` | decimal | Conditional | Required and > 0 when lot size is `FIXED` |
| `preferred_supplier_id` | UUID | No | Must reference an active supplier |
| `is_active` | boolean | Yes | Default true |
| `created_at` | datetime | System | UTC |
| `updated_at` | datetime | System | UTC |

**Rules**
- Normalize `material_code` before checking uniqueness.
- Do not hard-delete a material that is referenced by a BOM, inventory transaction, purchase order, or MRP result. Use inactive status instead.
- `safety_stock`, `minimum_order_qty`, and `fixed_lot_size` use `Decimal`/`NUMERIC`, never binary float.
- A `MAKE` material may have no supplier. A `BUY` material can optionally have a preferred supplier.
- Validate that preferred supplier exists and is active.
- Never silently change unit of measure after downstream transactions exist. In this milestone, show a warning/guard; later enforce conversion workflows.

### 3.2 Product

A product represents an item planned or produced by the organization. Products may be finished goods or semi-finished goods.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | System | Primary key |
| `product_code` | string | Yes | Unique, trimmed, uppercase; 3–30 chars |
| `name` | string | Yes | 2–120 chars |
| `description` | string | No | Max 500 chars |
| `product_type` | enum | Yes | `FINISHED`, `SEMI_FINISHED` |
| `unit_of_measure` | string/enum | Yes | Default `EA` |
| `lead_time_days` | integer | Yes | 0–3650; default 0 |
| `is_active` | boolean | Yes | Default true |
| `created_at` | datetime | System | UTC |
| `updated_at` | datetime | System | UTC |

**Rules**
- `product_code` is unique and normalized.
- Products are not materials in the same table. A future BOM may reference a product as its parent and materials/products as its components through a deliberate component model.
- Do not hard-delete a product once referenced by production orders or BOMs; deactivate it.

### 3.3 Supplier

A supplier represents an external vendor.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID | System | Primary key |
| `supplier_code` | string | Yes | Unique, trimmed, uppercase; 3–30 chars |
| `name` | string | Yes | 2–150 chars |
| `contact_person` | string | No | Max 120 chars |
| `email` | string | No | Valid email format |
| `phone` | string | No | Max 30 chars; preserve country code |
| `address_line` | string | No | Max 250 chars |
| `city` | string | No | Max 100 chars |
| `state_region` | string | No | Max 100 chars |
| `postal_code` | string | No | Max 20 chars |
| `country` | string | No | Max 100 chars |
| `payment_terms_days` | integer | No | 0–365; default null |
| `notes` | string | No | Max 1000 chars |
| `is_active` | boolean | Yes | Default true |
| `created_at` | datetime | System | UTC |
| `updated_at` | datetime | System | UTC |

**Rules**
- `supplier_code` is unique and normalized.
- Validate email when supplied.
- Do not hard-delete suppliers referenced by materials or purchase orders; deactivate them.
- Inactive suppliers must not be newly assigned as preferred suppliers.

---

## 4. Database design

Use SQLAlchemy 2.x declarative models and UUID primary keys. Use PostgreSQL `NUMERIC(14, 4)` for quantities/planning values and timezone-aware timestamps.

Suggested tables:
- `materials`
- `products`
- `suppliers`

Add:
- Unique constraints on each code field.
- Indexes on code, name, and `is_active`.
- Foreign key from `materials.preferred_supplier_id` to `suppliers.id` with `ON DELETE RESTRICT`.
- Explicit enum definitions or validated string enums; choose one approach consistently.
- `created_at` and `updated_at` maintained in UTC.

Do not store calculated inventory quantity on material master. Inventory belongs to the Inventory module.

---

## 5. Backend structure

Keep the existing modular-monolith structure. Suggested organization:

```text
backend/
└── app/
    ├── core/
    │   ├── config.py
    │   └── database.py
    ├── models/
    │   ├── material.py
    │   ├── product.py
    │   └── supplier.py
    ├── schemas/
    │   ├── material.py
    │   ├── product.py
    │   └── supplier.py
    ├── repositories/
    │   ├── material.py
    │   ├── product.py
    │   └── supplier.py
    ├── services/
    │   ├── material.py
    │   ├── product.py
    │   └── supplier.py
    ├── api/
    │   └── v1/
    │       ├── materials.py
    │       ├── products.py
    │       ├── suppliers.py
    │       └── router.py
    └── main.py
```

Use dependency injection for DB sessions. Routes must remain thin: request validation → service → repository/database → response schema.

### Error handling
Return consistent HTTP errors:
- `400` invalid business rule
- `404` record not found
- `409` duplicate code or protected deletion
- `422` schema validation
- `500` unexpected server failure (do not expose stack traces)

---

## 6. REST API contract

Prefix: `/api/v1`

### Materials
- `GET /materials` — list with search, filters, sorting, pagination
- `POST /materials` — create
- `GET /materials/{id}` — detail
- `PUT /materials/{id}` — full update
- `PATCH /materials/{id}/status` — activate/deactivate
- `DELETE /materials/{id}` — only if unreferenced; otherwise return `409`

### Products
- `GET /products`
- `POST /products`
- `GET /products/{id}`
- `PUT /products/{id}`
- `PATCH /products/{id}/status`
- `DELETE /products/{id}` — protected if referenced

### Suppliers
- `GET /suppliers`
- `POST /suppliers`
- `GET /suppliers/{id}`
- `PUT /suppliers/{id}`
- `PATCH /suppliers/{id}/status`
- `DELETE /suppliers/{id}` — protected if referenced

### List endpoint conventions
Query parameters:
- `search`: code/name contains, case-insensitive
- `is_active`: optional boolean
- `page`: default 1, minimum 1
- `page_size`: default 20, range 1–100
- `sort_by`: allowlisted field
- `sort_order`: `asc` or `desc`

Return a consistent envelope:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20,
  "pages": 0
}
```

Use Pydantic response schemas. Use `model_config = ConfigDict(from_attributes=True)` for ORM output.

---

## 7. Frontend requirements

Create a **Master Data** navigation group with:
- Materials
- Products
- Suppliers

### Page layout
Each list page must contain:
1. Page title and short description
2. Primary `Create ...` action
3. Search input
4. Active/inactive filter
5. Data table
6. Pagination
7. Loading, empty, and error states
8. Row actions: View/Edit, Activate/Deactivate, Delete (only when safe)

### Tables
- Materials: Code, Name, Type, UOM, Procurement, Lead Time, Status, Actions
- Products: Code, Name, Type, UOM, Lead Time, Status, Actions
- Suppliers: Code, Name, Contact, Email, Phone, Status, Actions

### Forms
- Use labels and inline validation.
- Mark required fields clearly.
- Show backend validation errors near the relevant field.
- Confirm destructive actions.
- Disable submit while saving.
- Display success/error toast or equivalent feedback.
- For supplier selection, use an async/searchable dropdown that shows only active suppliers.
- Material form must conditionally display `fixed_lot_size` when lot size is `FIXED`.
- Do not place every field in one crowded row; use logical sections.

### UX quality
- Consistent spacing, typography, buttons, and status badges.
- Responsive down to tablet widths.
- Accessible labels, keyboard navigation, and visible focus.
- Avoid placeholder-only labels.
- No mock data in production pages; seed data is allowed only for development.

---

## 8. Frontend organization

Suggested structure:

```text
frontend/src/
├── api/
│   ├── client.ts
│   ├── materials.ts
│   ├── products.ts
│   └── suppliers.ts
├── components/
│   ├── data-table/
│   ├── form/
│   ├── status-badge.tsx
│   ├── confirm-dialog.tsx
│   └── page-header.tsx
├── features/
│   └── master-data/
│       ├── materials/
│       │   ├── MaterialListPage.tsx
│       │   ├── MaterialFormPage.tsx
│       │   └── material-types.ts
│       ├── products/
│       └── suppliers/
├── hooks/
├── layouts/
├── routes/
└── types/
```

Use the existing UI framework and styling conventions already present in the starter. Do not introduce a second component library without justification.

---

## 9. Seed data (development only)

Create a repeatable seed command or fixture with realistic records:

**Materials**
- `MAT-STEEL-001` — Mild Steel Sheet — `RAW` — `KG` — `BUY`
- `MAT-BOLT-M8` — Hex Bolt M8 — `COMPONENT` — `EA` — `BUY`
- `MAT-PACK-BOX` — Carton Box — `PACKAGING` — `EA` — `BUY`

**Products**
- `PRD-DESK-001` — Office Desk — `FINISHED` — `EA`
- `PRD-DRAWER-001` — Drawer Assembly — `SEMI_FINISHED` — `EA`

**Suppliers**
- `SUP-STEEL-01` — Example Steel Supplier
- `SUP-FAST-01` — Example Fasteners Supplier

Mark these records as demo data; never imply these are real vendors.

---

## 10. Testing requirements

### Backend
- Create/list/detail/update material, product, supplier.
- Duplicate code returns `409`.
- Code normalization works (e.g. lowercase input becomes uppercase).
- Invalid enum and negative quantities are rejected.
- Fixed lot size validation is enforced.
- Inactive supplier cannot be selected as preferred supplier.
- Pagination and filters return correct totals.
- Protected deletion returns `409` when referenced.
- API response schemas are correct.

### Frontend
- List loading, empty, and error states.
- Search/filter/pagination behavior.
- Form validation and server errors.
- Create/edit flows.
- Status toggle confirmation and feedback.
- Responsive and keyboard-accessible controls.

Run backend tests and frontend lint/build before marking complete.

---

## 11. Implementation sequence

Implement in this order:

1. Confirm current project structure and conventions; do not overwrite working code.
2. Add SQLAlchemy models and Alembic migration for all three tables.
3. Add Pydantic schemas and shared pagination schema.
4. Implement repositories and services with normalization and business validation.
5. Implement API routes and register `/api/v1` router.
6. Add backend tests and verify OpenAPI docs.
7. Add typed frontend API clients.
8. Implement Material list/create/edit/status flows.
9. Implement Product list/create/edit/status flows.
10. Implement Supplier list/create/edit/status flows.
11. Integrate navigation and dashboard links.
12. Add development seed data.
13. Run tests, lint, and production build; fix all failures.

If the milestone is too large for one execution, complete Materials end-to-end first, then Products, then Suppliers. Do not create superficial screens with nonfunctional buttons.

---

## 12. Acceptance criteria

This milestone is complete only when:

- All three master-data entities persist in the database.
- CRUD and status changes work through documented APIs.
- Search, filters, and pagination work.
- Duplicate codes and invalid values are rejected.
- Referential integrity and protected deletion are respected.
- UI forms and tables are connected to the real API.
- Loading, empty, success, and failure states are implemented.
- Backend tests pass and frontend lint/build pass.
- No unrelated modules or project configuration are broken.
- README documents setup, migrations, seed command, and test commands.

---

## 13. Antigravity execution prompt

> Read `docs/Architecture.md`, `docs/Foundation.md`, and `docs/Master_Data.md` before editing. Inspect the existing repository and preserve its conventions. Implement the Master Data milestone described here: Materials, Products, and Suppliers with database models/migrations, schemas, repositories, services, REST APIs, frontend pages/forms/tables, validation, status management, seed data, and tests. Work incrementally and keep the app runnable. Start with Materials end-to-end, verify it, then Products, then Suppliers. Do not implement BOM, Inventory, Procurement, or MRP logic yet. Do not leave mock-only screens or inert actions. Run backend tests and frontend lint/build, fix errors, and summarize changed files, commands run, and any remaining issues.
