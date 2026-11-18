# MRP Engine — Antigravity Implementation Specification

**Project:** Material Requirements Planning (MRP) Management System  
**Module:** MRP Engine  
**Status:** Implementation specification  
**Target stack:** FastAPI + Python, SQLAlchemy 2.x, PostgreSQL, Pydantic; React + TypeScript frontend

---

## 1. Objective

Implement a deterministic, auditable **Material Requirements Planning (MRP) engine** that converts a production plan and multi-level Bill of Materials (BOM) into time-phased material replenishment recommendations.

The engine must:
- Explode multi-level BOMs.
- Calculate gross and net requirements by period.
- Respect inventory availability, scheduled receipts, safety stock, lead times, and lot-sizing rules.
- Offset planned order releases by lead time.
- Persist each run and its result snapshot.
- Explain each recommendation through traceable calculation details.
- Support repeatable runs against the same input snapshot.

**Important:** MRP generates planning proposals. It must not automatically create purchase orders or production orders in this milestone.

---

## 2. Prerequisites and integration contracts

Before implementing the engine, verify that these modules exist and their data contracts are stable:

- Master Data: Materials and Products
- BOM: BOM header, BOM items, revision/effectivity, component quantity, parent-child relationships
- Inventory: on-hand, reserved, available, and inventory transaction history
- Production Planning: production orders/MPS with product, quantity, due date, and status
- Procurement: open purchase orders and scheduled receipts (read-only input for MRP)

If a prerequisite is missing, create a clearly isolated adapter/interface and document the temporary limitation. **Do not fabricate operational records or silently use mock data.**

### Expected planning inputs

For a run, collect:
- Planning start date
- Planning horizon (number of periods)
- Period granularity (daily or weekly; implement weekly first if simpler)
- Selected production orders or approved MPS rows
- BOM revision/effectivity policy
- Inventory snapshot timestamp
- Open purchase-order scheduled receipts
- Material planning parameters (lead time, safety stock, minimum order quantity, lot-sizing policy)

Use one consistent calendar convention (date-only planning periods in the organization’s local calendar). Store timestamps in UTC; use date values for period buckets.

---

## 3. MRP terminology and definitions

| Term | Definition |
|---|---|
| Gross Requirements (GR) | Total demand for an item in a period before netting supply |
| Scheduled Receipts (SR) | Confirmed inbound supply due in a period from existing purchase/production orders |
| Projected Available Balance (PAB) | Projected inventory after demand and supply for a period |
| Net Requirements (NR) | Shortage requiring planned replenishment after supply and safety-stock policy |
| Planned Order Receipt (PORc) | Proposed replenishment quantity available in its receipt period |
| Planned Order Release (PORl) | Proposed order launch date after lead-time offset |
| Lead Time | Number of planning periods between order release and receipt |
| Lot-for-Lot (L4L) | Planned receipt equals the calculated net requirement |
| Fixed Lot Size | Receipt rounded up to a multiple of the fixed lot size |
| Minimum Order Quantity (MOQ) | Minimum quantity for a planned replenishment order |
| BOM Explosion | Propagation of parent demand to required components by BOM quantity and scrap/yield factors |

---

## 4. Planning policies and explicit assumptions

Implement these policies as configuration or documented defaults—not hidden constants.

1. **Period indexing:** Use `0..N-1` for the selected planning horizon. Keep a period calendar mapping each index to a start/end date.
2. **Demand timing:** A production order due in period `t` creates parent gross requirement in period `t`. Component demand is generated in the same period initially; component lead-time planning is then handled by the component’s own planned order release.
3. **BOM quantity:** `component_qty_per_parent × parent planned quantity`. If the BOM supports scrap/yield, use the agreed factor explicitly. Do not assume a scrap formula without documenting it.
4. **Supply convention:** `available_inventory = on_hand − reserved`. Do not subtract safety stock from inventory at the beginning and again during netting.
5. **Safety stock:** Maintain a minimum projected balance. A period’s shortage is calculated when projected balance would fall below safety stock.
6. **Scheduled receipts:** Include only confirmed/open receipts with valid expected dates and positive remaining quantities. Exclude cancelled, closed, or fully received orders.
7. **Receipt and release periods:** A planned receipt must be available no later than its required period. Release period = receipt period − lead time.
8. **Past-due release:** If release period precedes the horizon, mark the proposal `PAST_DUE` and show the required release date. Do not silently move it to the horizon start.
9. **Lot sizing:** Apply the material’s configured lot-sizing policy to net requirement. For `FIXED`, round up to the next fixed-lot multiple. For `LOT_FOR_LOT`, use the net requirement. For `PERIOD`, aggregate net requirements across the configured order interval; if period-lot policy is not yet modeled, reject it as unsupported rather than treating it as L4L.
10. **Minimum order quantity:** Apply MOQ after lot-sizing; ensure final quantity meets both constraints.
11. **Units:** Parent and component quantities must be dimensionally compatible with their BOM units. Unit conversion is not implicit. Reject incompatible units or use a defined conversion table.
12. **Determinism:** Identical snapshots and parameters must produce identical results, apart from generated run ID and timestamps.
13. **No negative planned quantities:** All calculated demand and supply quantities must be non-negative.
14. **No auto-execution:** Recommendations remain proposals until a user explicitly converts them through a later Procurement/Production workflow.

---

## 5. Core algorithm

### 5.1 High-level pipeline

```text
Validate request and planning horizon
        ↓
Capture input snapshot (production, BOM, inventory, receipts, parameters)
        ↓
Build period calendar
        ↓
Aggregate independent demand for top-level products
        ↓
Explode multi-level BOM into time-phased component gross requirements
        ↓
For each material, calculate time-phased netting and planned receipts
        ↓
Offset planned receipts by lead time to planned releases
        ↓
Validate proposals and flag exceptions
        ↓
Persist MRP run, input snapshot metadata, and result rows
        ↓
Return summary + traceable material/period details
```

### 5.2 BOM explosion

For each production demand row:
- Resolve the active BOM revision valid for the demand date.
- Add demand for the parent product.
- For every BOM component:
  - `component_gross_qty = parent_demand_qty × component_qty_per_parent`
  - Apply explicit scrap/yield factor if modeled.
  - Aggregate component demand by material and period.
  - If the component is itself a manufactured subassembly with a BOM, recursively explode it.
- Detect circular BOM paths and stop the run with a clear validation error containing the cycle path.
- Enforce a configurable maximum explosion depth as a safety guard.
- Aggregate repeated component demand rather than creating duplicate planning rows.

**Critical timing policy:** Use the parent’s required date as component gross-requirement date in the first implementation. Do not attempt full operation-level scheduling unless routing/operation data exists.

### 5.3 Time-phased netting

For each material and period `t`:

Definitions:
- `GR[t]`: gross requirement
- `SR[t]`: scheduled receipt
- `PAB_before[t]`: prior period projected available balance (or initial available inventory for period 0)
- `SS`: safety stock target
- `PORc[t]`: planned order receipt

Initialize:
- `PAB_before[0] = on_hand − reserved`
- `PAB_before[t] = PAB[t−1]` for `t > 0`

For each period:
1. Add scheduled receipts:
   `balance = PAB_before[t] + SR[t]`
2. Calculate shortage after gross requirements and safety stock:
   `NR[t] = max(0, GR[t] + SS − balance)`
3. Apply lot-sizing and MOQ to obtain `PORc[t]`.
4. Project ending balance:
   `PAB[t] = balance + PORc[t] − GR[t]`
5. Validate:
   - `PAB[t] >= SS` when a feasible planned receipt can be placed in period `t`.
   - If the receipt cannot arrive by `t` due to lead time or horizon boundaries, record an exception and show the shortage; do not falsify the PAB.

Use Decimal arithmetic throughout.

### 5.4 Lead-time offset

For each planned order receipt in period `t`:
- `release_period = t − lead_time_periods`
- Map release period to an actual date using the period calendar.
- If release period is before the horizon, set status `PAST_DUE`.
- If lead time is zero, release and receipt periods are the same.
- For weekly periods, define conversion from `lead_time_days` to periods explicitly. Recommended first policy: `ceil(lead_time_days / 7)`. Preserve exact day-based required/release dates in the result where possible.
- Do not offset gross requirements themselves; offset the replenishment proposal.

### 5.5 Lot sizing

Implement and unit-test:

**Lot-for-Lot**
```text
planned_qty = net_requirement
```

**Fixed lot size**
```text
planned_qty = ceil(net_requirement / fixed_lot_size) × fixed_lot_size
```

**MOQ**
```text
planned_qty = max(planned_qty, minimum_order_qty)
```

Apply MOQ only when net requirement > 0. If fixed lot size and MOQ are both present, final quantity must satisfy both.

**Period lot sizing**
- Treat as a separate policy.
- Define an `order_periods` parameter (or equivalent material master field).
- Aggregate net requirements in the policy window and generate a proposal at the window’s first shortage.
- If the data model does not yet support the parameter, return a clear `UNSUPPORTED_LOT_SIZING` validation error.

---

## 6. Example calculation (acceptance fixture)

Assume one material:
- Initial on-hand = 100 EA
- Reserved = 20 EA
- Safety stock = 10 EA
- Lead time = 1 period
- Lot sizing = L4L
- Scheduled receipts: 30 EA in period 1
- Gross requirements: 50 EA in period 0; 70 EA in period 1; 40 EA in period 2

Expected:
- Initial available = 80 EA
- Period 0: balance 80; net requirement = max(0, 50 + 10 − 80) = 0; PAB = 30 EA
- Period 1: balance 30 + 30 scheduled = 60; net requirement = max(0, 70 + 10 − 60) = 20; planned receipt = 20; PAB = 10 EA
- Period 2: balance 10; net requirement = max(0, 40 + 10 − 10) = 40; planned receipt = 40; PAB = 10 EA
- Period 1 planned receipt has release period 0; period 2 planned receipt has release period 1.

Use this fixture to verify netting, safety stock, scheduled receipts, and lead-time offset.

---

## 7. Data model

Create the following tables or equivalent models.

### `mrp_runs`
- `id` UUID primary key
- `run_code` unique human-readable identifier
- `planning_start_date`
- `planning_horizon_periods`
- `period_type` (`DAILY` / `WEEKLY`)
- `status` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`)
- `input_snapshot_hash`
- `input_snapshot_json` or normalized snapshot tables (choose based on size and audit needs)
- `algorithm_version`
- `created_by` nullable until authentication is integrated
- `started_at`, `completed_at`
- `error_code`, `error_message` (sanitized)

### `mrp_results`
- `id` UUID primary key
- `mrp_run_id` FK
- `material_id` FK
- `period_index`
- `period_start_date`
- `gross_requirements` NUMERIC(14,4)
- `scheduled_receipts` NUMERIC(14,4)
- `projected_available_before` NUMERIC(14,4)
- `net_requirements` NUMERIC(14,4)
- `planned_order_receipt_qty` NUMERIC(14,4)
- `projected_available_after` NUMERIC(14,4)
- `safety_stock` NUMERIC(14,4)
- `lead_time_periods`
- `planned_order_release_date` nullable
- `planned_order_receipt_date` nullable
- `proposal_status` (`NORMAL`, `PAST_DUE`, `OUTSIDE_HORIZON`, `SHORTAGE`)
- `explanation_json` for calculation trace

### `mrp_proposals` (recommended normalized proposal table)
- `id` UUID primary key
- `mrp_run_id` FK
- `material_id` FK
- `proposal_type` (`PURCHASE`, `PRODUCTION`, `TRANSFER`—initially PURCHASE/PRODUCTION only)
- `quantity` NUMERIC(14,4)
- `release_date`
- `receipt_date`
- `release_period_index`
- `receipt_period_index`
- `status` (`PROPOSED`, `PAST_DUE`, `OUTSIDE_HORIZON`, `CONVERTED`, `CANCELLED`)
- `source_result_period`
- `created_at`

A result row is a period-level calculation. A proposal is an order-level recommendation. Keep these concepts separate.

Add indexes for run ID, material ID, period index, proposal status, and dates. Add uniqueness constraints to prevent duplicate result rows per run/material/period.

---

## 8. API contract

Prefix: `/api/v1`

### Run management
- `POST /mrp/runs` — create and execute a run (synchronous initially)
- `GET /mrp/runs` — list runs with pagination/status filters
- `GET /mrp/runs/{run_id}` — run summary and status
- `GET /mrp/runs/{run_id}/results` — paginated time-phased results
- `GET /mrp/runs/{run_id}/materials/{material_id}` — full material planning trace
- `GET /mrp/runs/{run_id}/proposals` — planned order proposals
- `GET /mrp/runs/{run_id}/exceptions` — shortage, past-due, outside-horizon, and validation exceptions
- `POST /mrp/runs/{run_id}/cancel` — only if asynchronous execution is later implemented

### Run request example

```json
{
  "planning_start_date": "2026-11-16",
  "planning_horizon_periods": 12,
  "period_type": "WEEKLY",
  "production_order_ids": [],
  "include_approved_mps": true,
  "bom_effectivity_policy": "VALID_ON_REQUIREMENT_DATE"
}
```

Require at least one valid demand source (production orders or approved MPS). If the system supports an intentionally empty test run, make that an explicit flag.

### Run response
Return:
- run ID and run code
- status
- planning calendar
- counts of materials planned and proposals generated
- total shortage/past-due/outside-horizon exception counts
- links/IDs for results, proposals, and exceptions

---

## 9. Explainability and auditability

Every planned quantity must be explainable.

For each material/period, store or reconstruct:
- initial available inventory
- prior projected balance
- scheduled receipts and source PO references
- gross requirements and source production/BOM paths
- safety stock
- calculated net requirement
- lot-sizing rule and rounding
- final planned receipt
- lead time and release date
- resulting projected balance
- exceptions

Use a structured `explanation_json`, not an unstructured paragraph. Include algorithm version and input snapshot hash on every run. Results must remain immutable after completion; corrections require a new run.

---

## 10. Frontend requirements

Create an **MRP Planning** area with:

### Run form
- Planning start date
- Horizon
- Daily/weekly period selection
- Demand source selector (production orders / approved MPS)
- BOM effectivity policy
- Clear validation before submit
- Warning that a run creates proposals, not real orders

### Run history
- Run code, date, horizon, status
- Materials planned
- Proposal count
- Exception count
- View results action

### Results workspace
- Summary cards: planned materials, proposals, shortages, past-due releases
- Time-phased grid: material × period
- Columns/metrics: GR, SR, PAB, NR, PORc, release date
- Material detail drawer/page with calculation trace
- Proposal list with type, material, quantity, release date, receipt date, status
- Exception list with severity, material, period, explanation

Provide:
- loading, empty, and error states
- filters for material, proposal status, exception type
- CSV export of results/proposals (if supported by project)
- clear labels for units and period dates
- no automatic PO creation

---

## 11. Backend structure

Suggested modular layout:

```text
backend/app/
├── mrp/
│   ├── engine.py
│   ├── explosion.py
│   ├── netting.py
│   ├── lot_sizing.py
│   ├── lead_time.py
│   ├── calendar.py
│   ├── exceptions.py
│   ├── snapshot.py
│   └── explanation.py
├── models/
│   ├── mrp_run.py
│   ├── mrp_result.py
│   └── mrp_proposal.py
├── schemas/
│   └── mrp.py
├── repositories/
│   └── mrp.py
├── services/
│   └── mrp.py
└── api/v1/
    └── mrp.py
```

Keep pure calculation functions independent of FastAPI and SQLAlchemy. The engine should accept validated in-memory planning inputs and return a structured result. Persistence and HTTP concerns belong in the service/API layer.

---

## 12. Testing strategy

### Unit tests (pure engine)
- Gross requirement aggregation.
- Single-level and multi-level BOM explosion.
- BOM cycle detection.
- Safety-stock netting.
- Scheduled receipts.
- Reserved inventory treatment.
- L4L and fixed-lot rounding.
- MOQ.
- Zero lead time.
- Lead-time offset and past-due release.
- Outside-horizon receipt/release.
- Decimal precision.
- Deterministic results for identical inputs.
- Invalid units and invalid planning parameters.

### Integration tests
- Create MRP run from valid production/MPS and BOM data.
- Snapshot inputs and persist run/results/proposals.
- Retrieve results and material trace.
- Run failure persists sanitized failure status.
- Completed runs are immutable.
- No purchase or production order is created automatically.

### Acceptance checks
Use the numerical fixture in Section 6 and add:
- A finished product with two components.
- One component with a subassembly BOM.
- A repeated component used in multiple BOM branches.
- One material with scheduled receipts.
- One material with fixed lot sizing and MOQ.
- One shortage with past-due release.

---

## 13. Implementation sequence

1. Inspect existing Architecture, Foundation, and Master Data specs and repository.
2. Confirm BOM, inventory, and production planning schemas; write adapters where needed.
3. Define typed planning input/output models independent of ORM.
4. Implement calendar and period mapping.
5. Implement BOM explosion with cycle/depth checks.
6. Implement lot-sizing functions.
7. Implement time-phased netting.
8. Implement lead-time offset and exceptions.
9. Add engine unit tests and pass the numerical fixture.
10. Add MRP run/result/proposal models and migration.
11. Implement snapshot, run service, persistence, and APIs.
12. Implement run form, run history, results grid, trace, proposals, exceptions.
13. Add integration tests and seed/test fixtures.
14. Run backend tests, frontend lint/build, and review generated API docs.
15. Document limitations and algorithm version.

Build the pure engine and tests before the UI. Do not mix database queries into calculation loops.

---

## 14. Acceptance criteria

The MRP Engine milestone is complete only when:

- Multi-level BOM explosion is correct and detects cycles.
- Gross requirements are aggregated by material and period.
- Inventory, reservations, scheduled receipts, and safety stock are netted correctly.
- L4L, fixed lot size, and MOQ are supported.
- Lead-time offsets generate release dates and past-due flags.
- Results and proposals are persisted with immutable run snapshots.
- Each recommendation has a calculation trace.
- Run history, results, proposals, and exceptions are accessible through API/UI.
- No real purchase/production order is created automatically.
- Unit and integration tests pass.
- Frontend lint/build pass.
- Documentation states assumptions and unsupported policies clearly.

---

## 15. Antigravity execution prompt

> Read `docs/Architecture.md`, `docs/Foundation.md`, `docs/Master_Data.md`, and the BOM/Inventory/Production Planning specifications before coding. Inspect the actual repository and existing schemas. Implement the MRP Engine described in `docs/MRP_Engine.md`. Start with pure Python calculation models and functions (calendar, BOM explosion, netting, lot sizing, lead-time offset) and unit tests; use Decimal throughout. Pass the acceptance fixture before adding persistence. Then add run/result/proposal models and migrations, snapshot and run services, API endpoints, and the React run/history/results UI. Preserve immutable run snapshots and calculation explanations. Do not auto-create purchase orders or production orders. Do not fabricate missing upstream data: report missing prerequisites and use adapters only where documented. Keep the app runnable, run all tests and frontend lint/build, fix failures, and report changed files, commands, test results, and remaining limitations.
