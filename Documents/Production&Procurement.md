# PRODUCTION & PROCUREMENT — IMPLEMENTATION SPECIFICATION

**Project:** MRP Management System
**Phases covered:** Phase 5 (Production Planning) and Phase 7 (Procurement)
**Audience:** Antigravity (Agent mode), acting as senior full-stack engineer
**Read first:** `docs/Architecture.md`, `docs/Foundation.md`, `docs/Master_Data.md`, `docs/MRP_Engine.md`
**Status of this file:** Specification only. Nothing described here is assumed to be implemented.

---

# 0. HOW TO USE THIS DOCUMENT

1. Inspect the repository before writing anything. Do not trust documentation as proof of implementation.
2. Complete **Milestone P0 (Section 14)** first. It produces a dependency audit.
3. Implement one milestone at a time. Run tests after each. Keep the app runnable.
4. Where this file conflicts with `Architecture.md`, `Foundation.md` or `Master_Data.md` on conventions (route prefix, error envelope, pagination shape, naming), **the existing documents and existing code win**. Report the conflict.
5. Where this file conflicts with `MRP_Engine.md` on calculation semantics or input/output types, **`MRP_Engine.md` wins**. Adapt the adapters in Section 4, and report the conflict. Do not silently change MRP semantics.
6. Never fabricate an integration. If BOM, Inventory or MRP persistence does not exist, follow Section 4.4 (blocked-dependency behavior).
7. Do not claim any feature is complete unless it is implemented and its tests pass.

---

# 1. PURPOSE AND SCOPE

## 1.1 In scope

**Production Planning**
- Production order CRUD, search, filters, pagination.
- Lifecycle: `DRAFT → PLANNED → RELEASED → IN_PROGRESS → COMPLETED`, plus cancellation.
- Status history (audit trail).
- Product and BOM validation.
- Progress recording (completed quantity).
- A read-only provider that exposes eligible production orders to MRP as demand and supply.

**Procurement**
- Purchase order and purchase order line CRUD (draft editing).
- Lifecycle: `DRAFT → SUBMITTED → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED`, plus cancellation.
- Status history.
- Conversion of MRP purchase proposals into purchase orders (explicit, user-driven).
- Goods receipt with partial and full receiving.
- Transactional inventory posting through the Inventory service.
- A read-only provider that exposes open PO quantities to MRP as scheduled receipts.

## 1.2 Out of scope (do not build)

- Capacity planning, routing, work centers, shop-floor execution (MES).
- Sales orders, customer demand, forecasting.
- Supplier price lists, quotations, RFQs, contracts.
- Purchase UoM to stock UoM conversion (no silent unit conversions; see 3.5).
- Multi-currency conversion or exchange rates.
- Tax calculation, invoicing, three-way match, payment.
- Goods receipt reversal and returns to supplier (corrections go through Inventory adjustments).
- Multi-warehouse routing (receive into whichever location the Inventory module defines as default; see 4.2).
- Authentication and authorization (fields are prepared, enforcement is not implemented here).

---

# 2. ARCHITECTURE RULES FOR THESE MODULES

- Modular monolith. Two new backend modules: `production` and `procurement`. Follow the module layout already used by Master Data in the repo.
- Layering per module: `router` (thin) → `service` (business rules, transactions) → `repository` (queries) → `models` (SQLAlchemy 2.x). Schemas in Pydantic.
- Routes contain no business logic and never touch the session directly beyond dependency injection.
- Services own transaction boundaries. A service method that spans modules receives the **same session** and must not commit inside a lower-level service. Only the outermost service method commits.
- Cross-module access goes only through the ports in Section 4. Procurement must not import Inventory models directly. Production must not import BOM models directly.
- Pure logic (status transition tables, quantity math, demand mapping) lives in plain functions or classes with no FastAPI or SQLAlchemy imports, so it is unit-testable in isolation.
- Use Alembic migrations for every schema change. One migration per milestone is preferred. Migrations must be reversible.

---

# 3. SHARED CONVENTIONS

## 3.1 Identifiers and types

| Concern | Rule |
|---|---|
| Primary keys | UUID (match whatever generation approach the repo already uses) |
| Quantities | `NUMERIC(18,4)`, `Decimal` in Python, never `float` |
| Unit prices | `NUMERIC(18,4)` |
| Monetary totals | `NUMERIC(18,2)` computed with `Decimal` and explicit rounding (`ROUND_HALF_UP`) |
| Dates (business) | `DATE` |
| Timestamps | `TIMESTAMPTZ`, stored in UTC |
| Enumerations | `VARCHAR` with a `CHECK` constraint listing allowed values, unless the repo already standardizes on native enums |
| JSON responses | Decimals serialized as **strings** to avoid float precision loss |

## 3.2 Optimistic concurrency

Every mutable header table has `version INT NOT NULL DEFAULT 1`. Update and transition requests include the `version` the client last saw. Mismatch returns `409 VERSION_CONFLICT`. Successful writes increment `version`.

## 3.3 Document numbering

| Document | Format | Example |
|---|---|---|
| Production order | `PRD-{YYYY}-{NNNNNN}` | `PRD-2026-000001` |
| Purchase order | `PUR-{YYYY}-{NNNNNN}` | `PUR-2026-000001` |
| Goods receipt | `GRN-{YYYY}-{NNNNNN}` | `GRN-2026-000001` |

Implement with a `document_sequences` table `(prefix, year, last_value)` with a unique `(prefix, year)`. Allocate numbers by locking the row (`SELECT ... FOR UPDATE`) inside the creating transaction. Gapless numbering is not required. Codes are unique, immutable after creation, and may not be client-supplied in v1.

## 3.4 Errors

Reuse the error envelope from `Foundation.md`. If none exists, use:

```json
{ "error": { "code": "STRING_CODE", "message": "Human readable", "details": {} } }
```

Required error codes (add to the existing registry):

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Schema or field-level validation failed |
| `NOT_FOUND` | 404 | Entity does not exist |
| `VERSION_CONFLICT` | 409 | Stale `version` |
| `INVALID_STATUS_TRANSITION` | 409 | Transition not allowed from current status |
| `STATE_NOT_EDITABLE` | 409 | Entity not editable in its current status |
| `PRECONDITION_FAILED` | 422 | Transition prerequisites not met (details list each failure) |
| `DUPLICATE_CODE` | 409 | Unique code collision |
| `PROPOSAL_ALREADY_CONVERTED` | 409 | Proposal already linked to a PO line |
| `PROPOSAL_NOT_CONVERTIBLE` | 422 | Wrong type, status or material setup |
| `OVER_RECEIPT` | 422 | Received quantity exceeds open quantity |
| `UOM_MISMATCH` | 422 | Unit differs from the master data unit |
| `INACTIVE_REFERENCE` | 422 | Referenced product, material or supplier is inactive |
| `DEPENDENCY_UNAVAILABLE` | 501 | Required upstream module is not implemented (Section 4.4) |
| `DELETE_PROTECTED` | 409 | Entity cannot be deleted |

Never leak stack traces, SQL or internal paths in error messages.

## 3.5 No silent unit conversion

- A production order's `unit_of_measure` must equal the product's unit of measure.
- A purchase order line's `unit_of_measure` must equal the material's stock unit of measure.
- A goods receipt line's unit must equal the PO line unit.
- Mismatch returns `UOM_MISMATCH`. There is no automatic conversion anywhere in this module.

## 3.6 Audit fields

All header and line tables carry `created_at`, `updated_at`, `created_by`, `updated_by`. The `*_by` columns are nullable UUIDs referencing `users.id` if the Users table exists. If it does not, store nullable UUIDs without a foreign key and record that in the audit report. Status history tables record every transition.

## 3.7 Deletion policy

- Hard delete is allowed only for `DRAFT` production orders and `DRAFT` purchase orders that have never had a receipt or a converted proposal tied to them.
- Everything else is protected. Use cancellation, never deletion.
- Foreign keys to master data use `ON DELETE RESTRICT`.

---

# 4. DEPENDENCIES AND PORTS

The agent must not assume upstream modules exist. Define these ports as `typing.Protocol` classes in `app/integration/ports.py` (or the equivalent location in the repo). Concrete adapters wrap the real services when available.

## 4.1 BomPort (needed by Production)

```python
@dataclass(frozen=True)
class BomRef:
    id: UUID
    product_id: UUID
    revision: str
    effective_from: date | None
    effective_to: date | None
    is_active: bool

class BomPort(Protocol):
    def get_bom(self, session: Session, bom_id: UUID) -> BomRef | None: ...
    def resolve_active_bom(
        self, session: Session, product_id: UUID, on_date: date
    ) -> BomRef | None: ...
    def explode_single_level(
        self, session: Session, bom_id: UUID, quantity: Decimal
    ) -> list["ComponentRequirement"]: ...   # used only for the preview endpoint
```

## 4.2 InventoryPort (needed by Procurement; optionally by Production)

```python
@dataclass(frozen=True)
class InventoryTransactionRef:
    id: UUID

class InventoryPort(Protocol):
    def post_receipt(
        self, session: Session, *,
        material_id: UUID, quantity: Decimal, unit_of_measure: str,
        reference_type: str,          # "GOODS_RECEIPT"
        reference_id: UUID,           # goods_receipts.id
        reference_line_id: UUID,      # goods_receipt_items.id
        occurred_at: datetime,
        idempotency_key: str,         # derived from reference_line_id
        note: str | None,
    ) -> InventoryTransactionRef: ...
```

Rules for the real implementation behind this port:
- It must **not commit**. It joins the caller's session and transaction.
- It must be idempotent on `idempotency_key`.
- It must update balances only by writing a ledger transaction, per the project rule "never update inventory balances without a transaction".
- Receipt location: use the Inventory module's default location if it models locations. Do not invent a location model here.

Optional methods, used only by Milestone P8 (Section 14): `post_production_receipt`, `post_component_issue`.

## 4.3 MrpProposalPort (needed by Procurement conversion)

Proposals are owned by the MRP module. Procurement reads and marks them only through this port.

Minimum fields Procurement requires from a proposal:

| Field | Notes |
|---|---|
| `id` | UUID |
| `mrp_run_id` | UUID, for traceability |
| `proposal_type` | `PURCHASE` or `PRODUCTION` |
| `material_id` (or item id) | Purchased item |
| `quantity` | Decimal, already lot-sized by MRP |
| `unit_of_measure` | Must match material master |
| `receipt_date` | Planned order receipt date (need date) |
| `release_date` | Planned order release date |
| `status` | `OPEN`, `CONVERTED`, and any others `MRP_Engine.md` defines |
| `converted_po_item_id` | Nullable, set on conversion |

```python
class MrpProposalPort(Protocol):
    def get_proposals_for_update(
        self, session: Session, proposal_ids: Sequence[UUID]
    ) -> list["ProposalRef"]: ...             # must use SELECT ... FOR UPDATE
    def mark_converted(
        self, session: Session, proposal_id: UUID, po_item_id: UUID
    ) -> None: ...
    def newer_run_exists(self, session: Session, mrp_run_id: UUID) -> bool: ...
```

If `MRP_Engine.md` defines proposal fields differently, adapt inside the adapter. Do not modify MRP tables from this module except through `mark_converted`.

## 4.4 Blocked-dependency behavior

If a port has no real implementation yet:

1. Register a `Unavailable<Port>Adapter` that raises `DependencyUnavailableError`, mapped to HTTP 501 `DEPENDENCY_UNAVAILABLE` with the name of the missing module in `details`.
2. The dependent feature is **disabled**, not faked. Example: with no Inventory, goods receipt creation returns 501.
3. The frontend disables the affected buttons and shows the reason (for example "Inventory module not available").
4. Test doubles (in-memory fakes) are allowed **only under `tests/`** and must be named `Fake*`. Production code must never contain an in-memory stand-in.
5. Report each blocked feature in the milestone report.

Feature availability matrix:

| Feature | Needs | If missing |
|---|---|---|
| Production order CRUD (DRAFT) | Products | Blocked entirely (Master Data must exist) |
| DRAFT → PLANNED (BOM validation) | BomPort | Transition disabled, 501 |
| Components preview | BomPort | Endpoint 501, UI section hidden with note |
| PO CRUD, lifecycle | Materials, Suppliers | Blocked entirely |
| Proposal conversion | MrpProposalPort | Endpoint 501, page shows blocked state |
| Goods receipt | InventoryPort | Endpoint 501, Receive button disabled |
| MRP demand and receipt providers | MRP engine input types | Build against the interfaces in Section 9, tests only |

---

# 5. PART A — PRODUCTION PLANNING

## 5.1 Data model

### Table `production_orders`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID | PK |
| `order_code` | VARCHAR(30) | UNIQUE, NOT NULL, generated (3.3) |
| `product_id` | UUID | FK `products.id` RESTRICT, NOT NULL |
| `bom_header_id` | UUID | FK `bom_headers.id` RESTRICT, NULL while `DRAFT`, required from `PLANNED` |
| `bom_revision` | VARCHAR(20) | Snapshot of the BOM revision label at time of planning |
| `planned_quantity` | NUMERIC(18,4) | NOT NULL, CHECK `> 0` |
| `completed_quantity` | NUMERIC(18,4) | NOT NULL, default 0, CHECK `>= 0` and `<= planned_quantity` |
| `unit_of_measure` | VARCHAR(20) | NOT NULL, snapshot, must equal product UoM |
| `planned_start_date` | DATE | NOT NULL |
| `due_date` | DATE | NOT NULL, CHECK `due_date >= planned_start_date` |
| `priority` | VARCHAR(10) | NOT NULL, default `NORMAL`, one of `LOW, NORMAL, HIGH, URGENT` |
| `status` | VARCHAR(20) | NOT NULL, default `DRAFT`, one of `DRAFT, PLANNED, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED` |
| `notes` | TEXT | NULL |
| `cancellation_reason` | TEXT | NULL, required when `CANCELLED` |
| `actual_start_at` | TIMESTAMPTZ | NULL, set on `IN_PROGRESS` |
| `actual_completion_at` | TIMESTAMPTZ | NULL, set on `COMPLETED` |
| `version` | INT | NOT NULL default 1 |
| audit columns | | per 3.6 |

Indexes: `(status)`, `(product_id)`, `(due_date)`, `(status, due_date)`.

### Table `production_order_status_history`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `production_order_id` | UUID | FK, ON DELETE CASCADE |
| `from_status` | VARCHAR(20) | NULL for the creation row |
| `to_status` | VARCHAR(20) | NOT NULL |
| `reason` | TEXT | NULL (required for cancellation) |
| `changed_at` | TIMESTAMPTZ | NOT NULL |
| `changed_by` | UUID | NULL |

History rows are append-only. No update or delete endpoints exist for them. A row is written in the same transaction as the status change, including the initial `DRAFT` creation row.

## 5.2 Lifecycle

```
DRAFT ──► PLANNED ──► RELEASED ──► IN_PROGRESS ──► COMPLETED
  │          │  ▲         │             │
  │          └──┘ (unplan)│             │
  ▼          ▼            ▼             ▼
CANCELLED  CANCELLED   CANCELLED   CANCELLED (only if completed_quantity = 0)
```

Allowed transitions (anything else is `INVALID_STATUS_TRANSITION`):

| From | To | Notes |
|---|---|---|
| `DRAFT` | `PLANNED` | Preconditions P1 below |
| `DRAFT` | `CANCELLED` | Reason required |
| `PLANNED` | `DRAFT` | "Unplan"; clears nothing, simply re-opens editing |
| `PLANNED` | `RELEASED` | Preconditions P2 |
| `PLANNED` | `CANCELLED` | Reason required |
| `RELEASED` | `IN_PROGRESS` | Sets `actual_start_at` |
| `RELEASED` | `CANCELLED` | Reason required |
| `IN_PROGRESS` | `COMPLETED` | Preconditions P3 |
| `IN_PROGRESS` | `CANCELLED` | Only if `completed_quantity = 0`; reason required |
| `COMPLETED`, `CANCELLED` | none | Terminal |

Implement the table as a pure data structure plus a pure `validate_transition(current, target, order_snapshot)` function.

### Transition preconditions

**P1 (to PLANNED):**
- Product exists and is active.
- Product type is a manufacturable type (verify the enum in `Master_Data.md`; finished and semi-finished goods qualify).
- `unit_of_measure` equals the product UoM.
- A BOM is resolved: if `bom_header_id` is null, call `BomPort.resolve_active_bom(product_id, planned_start_date)`; if none is found, fail with `PRECONDITION_FAILED` and the detail `NO_ACTIVE_BOM`. If `bom_header_id` is set, verify it belongs to the product and is active.
- Persist `bom_header_id` and snapshot `bom_revision`.
- `planned_quantity > 0`, dates valid.

**P2 (to RELEASED):**
- Product still active.
- BOM still exists and is active. If it was deactivated since planning, fail with `BOM_INACTIVE` and require the user to unplan and re-plan.

**P3 (to COMPLETED):**
- `completed_quantity > 0`.
- If `completed_quantity < planned_quantity`, the request must include `reason` (short completion). Record it in history.
- Set `actual_completion_at`.

## 5.3 Business rules

1. **Defaults.** If `planned_start_date` is omitted on create, default to `due_date - product.lead_time` days. Never default `due_date`.
2. **Editing.** Header fields (`product_id`, `planned_quantity`, `unit_of_measure`, dates, priority, `bom_header_id`, notes) are editable only in `DRAFT`. In `PLANNED`, only `priority`, `notes` and `due_date` may change, and a change to `due_date` or `planned_quantity` is not allowed once MRP has consumed the order (see rule 5). `RELEASED` and later: `notes` and `priority` only. Anything else returns `STATE_NOT_EDITABLE` with the list of blocked fields.
3. **Progress.** `POST /production-orders/{id}/progress` sets cumulative `completed_quantity`. Allowed only in `IN_PROGRESS`. Must be monotonic non-decreasing and `<= planned_quantity`. This does **not** post inventory in v1 (see 5.6).
4. **Cancellation** requires a reason and preserves all data.
5. **MRP consumption protection.** If MRP persistence exists and any MRP run snapshot references the order, quantity and date edits in `PLANNED` are rejected with `STATE_NOT_EDITABLE` and detail `REFERENCED_BY_MRP_RUN`. Cancellation and unplanning remain allowed. If MRP persistence does not exist yet, skip this check and note it in the audit.
6. **Delete** only for `DRAFT` (see 3.7).
7. **Duplicate demand prevention.** One production order contributes exactly one demand entry and at most one supply entry to MRP, keyed by `production_order_id`. The provider rejects duplicate keys with a hard error. The service does not allow two non-terminal orders for the same product, quantity, due date and notes to be created "accidentally": detect an identical `(product_id, planned_quantity, due_date)` among non-terminal orders and return a `warnings` entry in the create response (warning only, not a block).

## 5.4 API (prefix `/api/v1`, verify against Foundation.md)

| Method | Path | Purpose |
|---|---|---|
| GET | `/production-orders` | List. Filters: `status` (multi), `product_id`, `priority`, `due_from`, `due_to`, `q` (code or product name). Pagination `page`, `page_size`. Sort `sort`, default `due_date asc, order_code asc` |
| POST | `/production-orders` | Create (status `DRAFT`) |
| GET | `/production-orders/{id}` | Detail including product summary, BOM summary, status |
| PATCH | `/production-orders/{id}` | Edit per rule 2. Body includes `version` |
| DELETE | `/production-orders/{id}` | `DRAFT` only |
| POST | `/production-orders/{id}/transitions` | Body: `{ "to_status", "reason"?, "version" }` |
| POST | `/production-orders/{id}/progress` | Body: `{ "completed_quantity", "version" }` |
| GET | `/production-orders/{id}/history` | Ordered by `changed_at` |
| GET | `/production-orders/{id}/components` | Single-level component preview via `BomPort`. Read-only, informational |
| GET | `/production-orders/mrp-demand` | Provider output (Section 9.1). Query `as_of` (default today). Register **before** `/{id}` to avoid route capture |

List responses follow the pagination shape already established by Master Data.

## 5.5 Frontend

Routes (match the router style already in the app):

| Route | Page |
|---|---|
| `/production` | Production orders list |
| `/production/new` | Create form |
| `/production/:id` | Detail with status timeline, actions, history, component preview |
| `/production/:id/edit` | Edit form (only fields allowed by status) |

Requirements:
- List: search box, status multi-filter, priority filter, due-date range, pagination, sortable columns, status badge, row click to detail.
- Form: product selector (active manufacturable products only, searchable), quantity, unit (read-only, taken from product), start and due date, priority, notes. Inline validation matching backend rules. Show backend `warnings`.
- Detail: header facts, status stepper showing the lifecycle, **only the transitions currently allowed** rendered as buttons, confirmation dialog for every transition, mandatory reason input for cancel and short completion, progress input in `IN_PROGRESS`, history table, component preview table (or a clear "BOM module not available" note).
- Handle `VERSION_CONFLICT` by prompting the user to reload the latest data.
- Loading, empty and error states on every data view. Quantities displayed with consistent decimal places. No float arithmetic in the UI.
- Add a navigation entry and wire the existing dashboard "Production" placeholder to the real page.

## 5.6 Deferred production integrations (do not fake)

In v1:
- Completing production or recording progress does **not** change inventory.
- Component issue to the order is not modelled.

Consequences the UI must state on the detail page (small informational note): "Inventory is not updated by production progress in this version."

Consequence for MRP correctness: see 9.1 (component issue assumption).

Optional Milestone P8 (Section 14) adds these integrations behind a feature flag if the Inventory module is available.

---

# 6. PART B — PROCUREMENT

## 6.1 Data model

### Table `purchase_orders`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID | PK |
| `po_number` | VARCHAR(30) | UNIQUE, NOT NULL, generated |
| `supplier_id` | UUID | FK `suppliers.id` RESTRICT, NOT NULL |
| `status` | VARCHAR(25) | NOT NULL, default `DRAFT`, one of `DRAFT, SUBMITTED, APPROVED, SENT, PARTIALLY_RECEIVED, RECEIVED, CANCELLED` |
| `order_date` | DATE | NOT NULL, default today |
| `currency` | CHAR(3) | NOT NULL, default from settings (`DEFAULT_CURRENCY`), single currency per PO |
| `payment_terms` | VARCHAR(100) | Snapshot from supplier at creation, editable in `DRAFT` |
| `total_amount` | NUMERIC(18,2) | NOT NULL, default 0, derived by service from lines, never client-supplied |
| `notes` | TEXT | NULL |
| `cancellation_reason` | TEXT | NULL |
| `submitted_at`, `approved_at`, `sent_at`, `closed_at`, `cancelled_at` | TIMESTAMPTZ | NULL, set on respective transitions |
| `version` | INT | NOT NULL default 1 |
| audit columns | | per 3.6 |

Indexes: `(status)`, `(supplier_id)`, `(order_date)`.

### Table `purchase_order_items`

| Column | Type | Constraints / notes |
|---|---|---|
| `id` | UUID | PK |
| `purchase_order_id` | UUID | FK, ON DELETE CASCADE (only reachable for deletable DRAFT POs) |
| `line_number` | INT | NOT NULL, UNIQUE per PO, assigned sequentially (10, 20, 30) |
| `material_id` | UUID | FK `materials.id` RESTRICT, NOT NULL |
| `ordered_quantity` | NUMERIC(18,4) | NOT NULL, CHECK `> 0` |
| `received_quantity` | NUMERIC(18,4) | NOT NULL default 0, CHECK `>= 0` |
| `unit_of_measure` | VARCHAR(20) | NOT NULL, equals material stock UoM |
| `unit_price` | NUMERIC(18,4) | NOT NULL, CHECK `>= 0` |
| `line_total` | NUMERIC(18,2) | NOT NULL, derived: `round(ordered_quantity * unit_price, 2)` |
| `expected_receipt_date` | DATE | NOT NULL |
| `source_proposal_id` | UUID | NULL, **partial UNIQUE index** where not null (prevents duplicate conversion) |
| `source_mrp_run_id` | UUID | NULL, traceability |
| `notes` | TEXT | NULL |
| audit columns | | |

Constraint: `received_quantity <= ordered_quantity * (1 + tolerance)` is enforced in the service (not a DB check) because tolerance is configurable (6.3 rule 6).

### Table `purchase_order_status_history`

Same shape as `production_order_status_history` with `purchase_order_id`.

### Table `goods_receipts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `receipt_number` | VARCHAR(30) | UNIQUE, generated |
| `purchase_order_id` | UUID | FK RESTRICT |
| `supplier_id` | UUID | FK RESTRICT, copied from PO |
| `receipt_date` | DATE | NOT NULL, not in the future |
| `delivery_reference` | VARCHAR(100) | NULL, supplier delivery note |
| `notes` | TEXT | NULL |
| `idempotency_key` | VARCHAR(100) | NULL, UNIQUE when not null |
| audit columns | | |

Goods receipts are **immutable** after creation. No update or delete endpoints.

### Table `goods_receipt_items`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `goods_receipt_id` | UUID | FK CASCADE |
| `purchase_order_item_id` | UUID | FK RESTRICT |
| `material_id` | UUID | FK RESTRICT, copied from PO line |
| `received_quantity` | NUMERIC(18,4) | NOT NULL, CHECK `> 0` |
| `unit_of_measure` | VARCHAR(20) | NOT NULL |
| `inventory_transaction_id` | UUID | NOT NULL, from `InventoryPort`; FK to the inventory ledger if that table exists, otherwise a plain UUID |
| `notes` | TEXT | NULL |

## 6.2 Lifecycle

```
DRAFT ─► SUBMITTED ─► APPROVED ─► SENT ─► PARTIALLY_RECEIVED ─► RECEIVED
  │  ◄──────┘             │         │  └────────────────────────► RECEIVED
  ▼                       ▼         ▼
CANCELLED            CANCELLED   CANCELLED (only if nothing received)
```

| From | To | Notes |
|---|---|---|
| `DRAFT` | `SUBMITTED` | Preconditions S1 |
| `DRAFT` | `CANCELLED` | Reason required |
| `SUBMITTED` | `APPROVED` | Sets `approved_at` |
| `SUBMITTED` | `DRAFT` | "Return to draft" (rejection), reason required |
| `SUBMITTED` | `CANCELLED` | Reason required |
| `APPROVED` | `SENT` | Sets `sent_at` |
| `APPROVED` | `CANCELLED` | Reason required |
| `SENT` | `PARTIALLY_RECEIVED`, `RECEIVED` | **System-driven only** by goods receipt (6.4). Not available through the transitions endpoint |
| `SENT` | `CANCELLED` | Only if total received is 0 |
| `PARTIALLY_RECEIVED` | `RECEIVED` | System-driven only |
| `RECEIVED`, `CANCELLED` | none | Terminal |

`PARTIALLY_RECEIVED` cannot be cancelled in v1. See Open Decision OD-2.

**S1 (to SUBMITTED):**
- At least one line.
- Supplier exists and is active.
- Every material is active, `ordered_quantity > 0`, unit matches the material UoM, `unit_price >= 0`, `expected_receipt_date` set.
- `total_amount` recomputed and stored.

## 6.3 Business rules

1. **Editing.** In `DRAFT`: header fields and lines are fully editable (add, update, remove lines). In `SUBMITTED` and later: `notes` only. Anything else returns `STATE_NOT_EDITABLE`.
2. **Supplier change in DRAFT** is allowed unless the PO contains lines that came from proposals. Those lines are traceable to MRP and the supplier may still be changed, but the lines' material, quantity, unit and expected date are locked (see 6.5).
3. **Totals.** `line_total` and `total_amount` are always derived server-side with `Decimal` and `ROUND_HALF_UP`. Never trust client values.
4. **Duplicate lines.** Two lines with the same material and the same expected receipt date in one PO produce a warning, not an error.
5. **Delete** only for `DRAFT` POs. On delete, any proposal link is released: because conversion marks the proposal `CONVERTED`, deleting a DRAFT PO that holds converted proposal lines must call `MrpProposalPort.release_conversion` (add this method to the port) to return the proposal to `OPEN`. If that method is unavailable, deletion of such POs is blocked with `DELETE_PROTECTED` and the detail `HAS_CONVERTED_PROPOSALS`; users cancel instead. Choose the blocking option unless the MRP module already supports releasing conversions.
6. **Over-receipt tolerance.** Setting `PO_OVER_RECEIPT_TOLERANCE_PERCENT`, default `0`. Cumulative received quantity may not exceed `ordered_quantity * (1 + tolerance/100)`.
7. **Status is derived from receipts** after PO approval (6.4). The status endpoint rejects manual moves into `PARTIALLY_RECEIVED` or `RECEIVED`.

## 6.4 Goods receipt flow

`POST /purchase-orders/{id}/receipts`

Request:
```json
{
  "receipt_date": "2026-11-20",
  "delivery_reference": "DN-1182",
  "notes": null,
  "lines": [
    { "purchase_order_item_id": "uuid", "received_quantity": "40.0000", "notes": null }
  ]
}
```
Optional header `Idempotency-Key`. A repeated key returns the original receipt with HTTP 200 and creates nothing new.

Algorithm, executed in **one database transaction**:

1. Verify `InventoryPort` is available, otherwise 501.
2. Lock the PO row and its item rows (`SELECT ... FOR UPDATE`).
3. Validate PO status is `SENT` or `PARTIALLY_RECEIVED`.
4. Validate each line: belongs to this PO, `received_quantity > 0`, unit equals the PO line unit, cumulative received stays within tolerance (`OVER_RECEIPT` otherwise), no duplicate PO lines in the request, receipt date not in the future.
5. Allocate `receipt_number`. Insert `goods_receipts` and `goods_receipt_items`.
6. For each line call `InventoryPort.post_receipt(...)` with `idempotency_key = f"GRN-ITEM-{goods_receipt_item_id}"` and store the returned transaction id on the item.
7. Increase `purchase_order_items.received_quantity`.
8. Recalculate PO status: all lines fully received (within tolerance floor: `received >= ordered`) → `RECEIVED`; otherwise if any received > 0 → `PARTIALLY_RECEIVED`. Write a history row with reason `Goods receipt {receipt_number}`. Set `closed_at` on `RECEIVED`. Increment `version`.
9. Commit once. Any exception rolls back receipt records, inventory transactions and PO changes together. A partially posted receipt must be impossible.

Notes:
- Inventory posting happens only through `InventoryPort`. Procurement never writes balance tables.
- Receipts are not reversible here. Corrections are inventory adjustments, documented in the audit report as a known limitation.

## 6.5 MRP proposal conversion

`POST /purchase-orders/from-proposals`

Request:
```json
{
  "supplier_id": "uuid",
  "order_date": "2026-11-12",
  "notes": null,
  "lines": [
    { "proposal_id": "uuid", "unit_price": "125.5000" }
  ]
}
```

Rules:
1. Conversion is always an explicit user action. MRP never creates purchase orders.
2. Supplier is **required** and must be active.
3. Every proposal must satisfy: `proposal_type = PURCHASE`, status `OPEN`, material active, material's procurement type indicates it is purchased (verify exact enum in `Master_Data.md`), unit equals material UoM. Otherwise `PROPOSAL_NOT_CONVERTIBLE` with the offending ids.
4. Lock proposals with `MrpProposalPort.get_proposals_for_update`. If any is already converted, return `PROPOSAL_ALREADY_CONVERTED` listing ids. No partial conversion: all or nothing.
5. **Preserve exactly:** material, quantity, unit and receipt date. The line `expected_receipt_date` equals the proposal `receipt_date`. Quantity is **not editable** at conversion. If the user wants a different quantity, they edit the DRAFT PO afterward (the edit is permitted, and the link to the proposal is kept, but the UI warns that quantity differs from the proposal).
6. `unit_price` is required per line (`>= 0`). There is no price master in v1.
7. Create a `DRAFT` PO, create lines with `source_proposal_id` and `source_mrp_run_id`, then call `mark_converted(proposal_id, po_item_id)` for each. The partial unique index on `source_proposal_id` is the second line of defense against duplicates.
8. Response includes `warnings` if `newer_run_exists(mrp_run_id)` is true for any proposal ("proposal is from a superseded MRP run"). This is a warning, not a block.
9. Traceability: the PO detail displays, per line, the proposal id and MRP run id as links to the MRP run page when that page exists.

## 6.6 API (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/purchase-orders` | List. Filters: `status` (multi), `supplier_id`, `material_id`, `order_from`, `order_to`, `q`. Pagination and sort as in 5.4, default `order_date desc` |
| POST | `/purchase-orders` | Create manual `DRAFT` PO (header, optional lines) |
| GET | `/purchase-orders/{id}` | Detail with lines, receipts summary, open quantities |
| PATCH | `/purchase-orders/{id}` | Header edit per 6.3. Body includes `version` |
| DELETE | `/purchase-orders/{id}` | `DRAFT` only, see 6.3 rule 5 |
| POST | `/purchase-orders/{id}/items` | Add line (`DRAFT` only) |
| PATCH | `/purchase-orders/{id}/items/{item_id}` | Edit line (`DRAFT` only) |
| DELETE | `/purchase-orders/{id}/items/{item_id}` | Remove line (`DRAFT` only) |
| POST | `/purchase-orders/{id}/transitions` | `{ "to_status", "reason"?, "version" }`. Manual transitions only per 6.2 |
| GET | `/purchase-orders/{id}/history` | Status history |
| POST | `/purchase-orders/from-proposals` | Section 6.5 |
| POST | `/purchase-orders/{id}/receipts` | Section 6.4 |
| GET | `/purchase-orders/{id}/receipts` | Receipts of a PO |
| GET | `/goods-receipts` | List, filters `supplier_id`, `material_id`, `from`, `to`, `q` |
| GET | `/goods-receipts/{id}` | Detail with lines and inventory transaction ids |
| GET | `/purchase-orders/scheduled-receipts` | Provider output (Section 9.2). Query `as_of`. Register before `/{id}` |

## 6.7 Frontend

| Route | Page |
|---|---|
| `/procurement/purchase-orders` | PO list |
| `/procurement/purchase-orders/new` | Manual PO form with line editor |
| `/procurement/purchase-orders/:id` | PO detail |
| `/procurement/purchase-orders/:id/edit` | DRAFT editor |
| `/procurement/proposals` | MRP purchase proposals review and conversion |
| `/procurement/receipts` | Goods receipt list |
| `/procurement/receipts/:id` | Goods receipt detail |

Requirements:
- **PO list:** search, status and supplier filters, date range, pagination, status badges, total amount.
- **PO editor:** supplier selector (active only), line grid (material selector limited to active purchased materials, quantity, unit read-only, price, expected date), computed line totals shown from server response (do not compute authoritative totals client-side), add and remove lines, save draft.
- **PO detail:** status stepper, allowed transition buttons only, confirmation dialogs, reason inputs where required, lines table showing ordered, received and open quantity, per-line proposal trace link, receipts list, history table, **Receive goods** button visible in `SENT` and `PARTIALLY_RECEIVED`.
- **Receive goods dialog:** one row per open line prefilled with the open quantity, editable, client check against open quantity (server remains authoritative), receipt date, delivery reference, notes. Send an `Idempotency-Key` generated once per dialog open. Disable submit while in flight to prevent double submission.
- **Proposals page:** table of open `PURCHASE` proposals (filter by run, material, supplier, needed-by date), checkbox selection, grouping by suggested supplier (material's preferred supplier), per-line price input, supplier selector, **Create draft PO** action calling `from-proposals`, result banner with link to the new PO, display of warnings, already-converted proposals shown as disabled with link to their PO.
- Blocked states (Section 4.4) render as disabled controls with an explanatory message. No dead buttons.
- Loading, empty, error states everywhere. Navigation entries added and dashboard "Procurement" placeholder wired to the real pages.

---

# 7. TRANSACTIONS, CONCURRENCY, INTEGRITY

1. Each public service method is one transaction. Commit at the outermost level only.
2. Row locking with `with_for_update()` on: PO + items during receipt, proposals during conversion, `document_sequences` during numbering, production order during transition.
3. Lock ordering to avoid deadlocks: sequences → PO → PO items (ordered by `line_number`) → proposals.
4. Idempotency on goods receipts (header key plus per-line inventory key).
5. Constraint-level protection: CHECK constraints, partial unique index on `source_proposal_id`, UNIQUE codes, RESTRICT foreign keys.
6. SQLite compatibility: row locks are no-ops there, so concurrency tests must be marked to run against PostgreSQL only. Everything else must pass on both if the repo supports SQLite.
7. No raw SQL string concatenation. Use SQLAlchemy 2.x constructs.

---

# 8. SECURITY AND QUALITY

- Pydantic validation on every request body. Reject unknown fields (`extra="forbid"`).
- Decimal fields parsed from strings, with max digits and decimal places enforced.
- Bound all list endpoints (`page_size` maximum, for example 100).
- Sanitized error messages (3.4).
- No secrets in code. New settings go in the environment-based config: `DEFAULT_CURRENCY`, `PO_OVER_RECEIPT_TOLERANCE_PERCENT`, `MRP_SCHEDULED_RECEIPT_PO_STATUSES`, `PRODUCTION_INVENTORY_POSTING_ENABLED`. Document them in `.env.example`.
- Type hints throughout. No unused abstractions.
- Log status transitions and receipts at INFO with entity ids, never with personal data beyond ids.

---

# 9. MRP INTEGRATION CONTRACTS

These providers are **read-only**, deterministic and side-effect free. They return plain dataclasses. They do not import the MRP engine; an adapter in the MRP integration layer maps them onto the engine's input types as defined in `MRP_Engine.md`. If the engine's types differ, change the adapter, not the provider semantics, and report the mismatch.

## 9.1 Production provider

Eligible orders: `status IN (PLANNED, RELEASED, IN_PROGRESS)` with remaining quantity `> 0`, where `remaining_quantity = planned_quantity - completed_quantity`. `DRAFT`, `COMPLETED` and `CANCELLED` never contribute.

```python
@dataclass(frozen=True)
class FirmProductionOrder:
    production_order_id: UUID
    order_code: str
    product_id: UUID
    bom_header_id: UUID
    bom_revision: str
    remaining_quantity: Decimal
    unit_of_measure: str
    planned_start_date: date
    due_date: date
    status: str
```

**Semantics (default policy for this project, reconcile with `MRP_Engine.md`):**

- Each eligible order is treated as a **firm planned order** for its product. MRP explodes the order's BOM one level to create **component gross requirements** dated at `planned_start_date` (then applies component lead-time offsets as usual).
- The order's own product quantity is **not** netted against product inventory and does **not** generate a new proposal for the same product. This prevents MRP from re-planning something already planned.
- The order **also supplies** its product: a scheduled receipt of `remaining_quantity` at `due_date`, which can satisfy higher-level demand for that product (for example a sub-assembly order feeding a parent order's component requirement).
- This yields no double counting: component demand comes from the explosion, supply is separate, and the order's own product is never both demand and supply against itself.

```python
@dataclass(frozen=True)
class ScheduledReceipt:
    source_type: str          # "PRODUCTION_ORDER" | "PURCHASE_ORDER"
    source_id: UUID
    source_line_id: UUID | None
    item_id: UUID             # product or material id
    quantity: Decimal
    unit_of_measure: str
    receipt_date: date
    status: str
```

**Known v1 limitation (document in audit report):** because component issue is not modelled, requirement quantity is `remaining_quantity x BOM quantity per parent` with the assumption that no components have yet been issued to the order. When Milestone P8 introduces component issue, the provider must subtract issued component quantity and the MRP run must not also see that stock in on-hand.

Past-due orders (`due_date < as_of`) are passed through unchanged. Treating past-due items is the MRP engine's responsibility.

## 9.2 Procurement provider

Open scheduled receipts: PO lines where the PO status is in `MRP_SCHEDULED_RECEIPT_PO_STATUSES` (default `APPROVED, SENT, PARTIALLY_RECEIVED`) and `open_quantity = ordered_quantity - received_quantity > 0`. Date is `expected_receipt_date`. Cancelled and `RECEIVED` orders never contribute. Output uses `ScheduledReceipt` with `source_type = "PURCHASE_ORDER"`.

**No double counting:**
- Received quantity is already in inventory (via the goods receipt ledger transaction), so only the **open** quantity is a scheduled receipt.
- A converted proposal is no longer an open proposal, so its quantity appears either as a PO scheduled receipt (if the PO status qualifies) or nowhere (if the PO is still `DRAFT` or `SUBMITTED`).

**Documented trade-off (see Open Decision OD-1):** a `DRAFT` PO created from a proposal is not counted as supply by default, so re-running MRP before approval can re-propose the same need. The UI shows a banner on the proposals page: "n draft purchase orders created from proposals are not yet counted as supply."

The MRP run snapshot must record which PO statuses were included (the engine's immutable snapshot already stores inputs; add this setting value to the snapshot metadata when MRP persistence exists).

## 9.3 Optional: production proposal conversion

If the MRP module generates `PRODUCTION` proposals, Production Planning may offer a symmetric `POST /production-orders/from-proposals` that creates `DRAFT` production orders preserving product, quantity, unit and need date, requires explicit user action, prevents duplicate conversion and keeps the same traceability fields (`source_proposal_id`, `source_mrp_run_id` added to `production_orders`). Implement only after the purchase conversion is complete and tested. It is not required for acceptance.

---

# 10. SEED / DEVELOPMENT DATA

- Provide `scripts/seed_production_procurement.py`, clearly labelled as development fixtures.
- It must call the **services**, not insert rows directly, so business rules are exercised.
- It requires Master Data, BOM and Inventory to be present. If not, it exits with a message listing what is missing. No fabricated rows.
- Suggested data: a few production orders in different statuses, POs covering every lifecycle state, one partial receipt and one full receipt.
- Seed data must never appear in dashboard metrics unless it is actually in the database (the dashboard reads the DB, not fixtures).

---

# 11. TESTING REQUIREMENTS

Use `pytest`. Use factories or fixtures for master data. Test doubles named `Fake*` live only in `tests/`.

## 11.1 Unit tests (no DB, no HTTP)

**Production**
- Transition table: every allowed transition passes; every disallowed pair fails (parametrized over all status pairs).
- Preconditions P1, P2, P3 each fail and pass independently.
- IN_PROGRESS cancellation blocked when `completed_quantity > 0`.
- Progress is monotonic and capped at `planned_quantity`.
- Default `planned_start_date` calculation.
- Demand mapping: eligible statuses only, remaining quantity math, remaining `<= 0` excluded, duplicate key rejected.

**Procurement**
- PO transition table (all pairs), including that `PARTIALLY_RECEIVED` and `RECEIVED` are not manually reachable.
- Line total and PO total with `Decimal` rounding edge cases (for example `0.005`, `1/3` style quantities).
- Status derivation after receipts: none, partial, exact full, full with tolerance.
- Over-receipt rule with tolerance `0` and with tolerance `5`.
- Scheduled receipt mapping: status filtering by setting, open quantity only, `RECEIVED`/`CANCELLED` excluded.

## 11.2 Service and API integration tests (database)

**Production:** create, edit rules per status, delete only in `DRAFT`, version conflict, full lifecycle writing correct history rows, cancel with and without reason, warnings on probable duplicate, filters, pagination, sorting, `mrp-demand` endpoint route precedence.

**Procurement:**
- PO CRUD and draft-only line edits.
- S1 failures: no lines, inactive supplier, inactive material, UoM mismatch, negative price.
- Conversion: success preserves material, quantity, unit and receipt date; proposal marked converted; second conversion attempt returns `PROPOSAL_ALREADY_CONVERTED`; mixed batch with one bad proposal converts none; wrong proposal type rejected; inactive supplier rejected; newer-run warning present.
- Goods receipt: full receipt, partial then remaining receipt, over-receipt rejected, receipt against `DRAFT` or `APPROVED` PO rejected, UoM mismatch rejected, duplicate PO line in request rejected, idempotent replay returns the original.
- **Atomicity:** use a `FakeInventoryPort` that raises on the second line. Assert no goods receipt, no item rows, no PO quantity change, no status change and no history row persisted.
- Inventory ledger linkage: each receipt item stores the transaction id returned by the port; with the real Inventory module, assert on-hand increased by exactly the received quantity and a ledger row exists.
- Blocked-dependency behavior: with the `Unavailable*` adapters, affected endpoints return 501 `DEPENDENCY_UNAVAILABLE`.

## 11.3 Concurrency tests (PostgreSQL only)

- Two simultaneous receipts that together would exceed the open quantity: exactly one succeeds.
- Two simultaneous conversions of the same proposal: exactly one succeeds.
- Concurrent PO number allocation: no duplicates.

## 11.4 End-to-end workflow test (when BOM, Inventory and MRP exist)

1. Create master data, BOM, inventory.
2. Create and plan a production order.
3. Run MRP, confirm component gross requirements from the production provider.
4. Convert a purchase proposal into a PO, approve and send it.
5. Receive part of it, confirm inventory and PO status.
6. Re-run MRP and confirm: received quantity is in on-hand, only the open quantity is a scheduled receipt, and no requirement is counted twice.

## 11.5 Frontend tests (where appropriate)

- Status transition buttons render only for allowed transitions.
- Receive dialog validates quantities and blocks double submit.
- Proposals page disables already converted proposals.
- Blocked-dependency states show the explanatory message.

A milestone is not complete until its tests pass and the full existing test suite still passes.

---

# 12. ACCEPTANCE CRITERIA (OVERALL)

- All endpoints in Sections 5.4 and 6.6 exist, are documented in the OpenAPI schema, and behave as specified, except those legitimately blocked by a missing upstream module, which must return `DEPENDENCY_UNAVAILABLE` and be listed in the report.
- Every lifecycle transition is validated server-side and recorded in history.
- No float arithmetic anywhere in quantity or money logic.
- A goods receipt either fully posts (receipt, inventory transactions, PO updates) or leaves no trace.
- A proposal can be converted exactly once; traceability to the MRP run is preserved.
- Providers in Section 9 return correct, non-double-counted data and are covered by tests.
- Frontend pages in 5.5 and 6.7 use the real backend, have loading, empty and error states, and contain no non-functional buttons.
- Migrations apply on a clean database and downgrade cleanly.
- Existing Foundation and Master Data tests still pass.
- Docs updated: this file's status table, the module list in `Architecture.md`, API notes, and `.env.example`.

---

# 13. OPEN DECISIONS (resolve with the project owner, defaults given)

| ID | Question | Default used here |
|---|---|---|
| OD-1 | Should `DRAFT`/`SUBMITTED` POs count as scheduled receipts for MRP? | No. Only `APPROVED, SENT, PARTIALLY_RECEIVED` (configurable). Trade-off: possible duplicate proposals before approval |
| OD-2 | How to close a PO whose remainder will never arrive? | Not supported in v1. `PARTIALLY_RECEIVED` cannot be cancelled. Candidate v2: "short close" action that closes remaining quantity and sets a terminal status. Until then, remaining open quantity keeps counting as a scheduled receipt |
| OD-3 | Allow `SUBMITTED → DRAFT` return? | Yes, with reason (added beyond the base lifecycle) |
| OD-4 | Allow `PLANNED → DRAFT` unplan? | Yes |
| OD-5 | Over-receipt tolerance | 0 percent |
| OD-6 | Production over-completion | Not allowed (`completed_quantity <= planned_quantity`) |
| OD-7 | Firm planned order semantics in MRP (9.1) | As described; must be reconciled with `MRP_Engine.md` |

If the owner has not answered, implement the defaults, record them in the report, and keep each behind a single clearly named constant or setting so it is easy to change.

---

# 14. MILESTONES

Implement strictly in order. After each: run the full test suite, update docs, produce the report in Section 15.

## P0 — Audit and ports (no feature code)
- Inspect repo state: Foundation, Master Data (models, enums, route prefix, error envelope, pagination shape), BOM, Inventory, MRP.
- Read `MRP_Engine.md` and record input/output types and any conflicts with Sections 9.1 and 9.2.
- Create the port protocols (Section 4) and `Unavailable*` adapters. Wire real adapters wherever the upstream module exists.
- Add settings and `.env.example` entries.
- Deliver a dependency audit table: dependency, exists or not, location, adapter used.
- **Acceptance:** app still runs, existing tests pass, audit delivered.

## P1 — Production backend
- Migration, models, schemas, repository, service, routes for Section 5, including numbering, history, transitions, progress, `mrp-demand` provider.
- **Acceptance:** 11.1 and 11.2 production tests pass.

## P2 — Production frontend
- Pages in 5.5, API client functions, navigation, dashboard link.
- **Acceptance:** manual walkthrough of full lifecycle in the browser against the real API, plus frontend tests.

## P3 — Purchase orders backend
- Migration, models, services and routes for POs, lines, lifecycle, history, scheduled-receipt provider.
- **Acceptance:** PO unit and integration tests pass.

## P4 — MRP proposal conversion
- `from-proposals` endpoint, `MrpProposalPort` adapter (real if MRP persistence exists, otherwise `Unavailable` and tests with `FakeMrpProposalPort`).
- **Acceptance:** conversion tests pass, including atomicity and duplicate protection.

## P5 — Goods receipt
- Receipt endpoints, transactional inventory posting, idempotency, status derivation.
- **Acceptance:** receipt tests pass, atomicity test passes, concurrency tests pass on PostgreSQL. If Inventory is missing, acceptance is the 501 behavior plus tests using `FakeInventoryPort`, and the milestone is reported as **blocked, not complete**.

## P6 — Procurement frontend
- Pages in 6.7.
- **Acceptance:** walkthrough: convert proposals, edit draft, submit, approve, send, receive partially, receive remainder. Frontend tests pass.

## P7 — MRP integration and end-to-end
- Map providers to the MRP engine input types via adapter. Add provider tests against engine types.
- Run the 11.4 workflow test if all modules exist.
- **Acceptance:** no double counting demonstrated by test.

## P8 — Optional: production inventory posting
Only if the Inventory ledger exists and the owner approves. Behind `PRODUCTION_INVENTORY_POSTING_ENABLED` (default false).
- On progress delta: post finished-goods receipt for the delta.
- Backflush component issue from the order's BOM x delta.
- Both in the same transaction as the progress update, idempotent per progress event.
- Update provider semantics (9.1 limitation) and tests.
- **Acceptance:** transactional tests including failure rollback.

---

# 15. REQUIRED REPORT FORMAT (after every milestone)

1. What you inspected.
2. What you implemented.
3. Files created or modified.
4. Database changes (migration ids, tables, constraints, indexes).
5. API endpoints added.
6. Frontend functionality completed.
7. Tests executed and results (counts, failures, skipped and why).
8. Errors encountered and how they were fixed.
9. Blocked items and unmet dependencies.
10. Deviations from this specification and the reason for each.
11. Remaining work.
12. Recommended next milestone.

Do not state that a feature is complete unless it has been implemented and verified by tests or an explicit manual check that you describe.

---

# 16. DOCUMENTATION STATUS (update when done)

| Document | Status |
|---|---|
| Architecture.md | Created |
| Foundation.md | Created |
| Master_Data.md | Created |
| MRP_Engine.md | Created |
| Production&Procurement.md | Created (this file) |
| BOM_Management.md | Not yet created |
| Inventory.md | Not yet created |
| Dashboard_Reports.md | Not yet created |
| Deployment.md | Not yet created |

**Start with Milestone P0. Do not begin P1 until the dependency audit is delivered and reviewed.**
