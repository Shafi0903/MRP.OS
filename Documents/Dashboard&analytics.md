# DASHBOARD & ANALYTICS — IMPLEMENTATION SPECIFICATION

**Project:** MRP Management System
**Phase covered:** Phase 8 (Dashboard and Reporting)
**Audience:** Antigravity (Agent mode), acting as senior full-stack engineer
**Read first:** `docs/Architecture.md`, `docs/Foundation.md`, `docs/Master_Data.md`, `docs/MRP_Engine.md`, `docs/Production&Procurement.md`
**Also read if present:** `docs/BOM_Management.md`, `docs/Inventory.md`
**Status of this file:** Specification only. Nothing described here is assumed to be implemented.

---

# 0. HOW TO USE THIS DOCUMENT

1. Inspect the repository before writing anything. Documentation is not proof of implementation.
2. Complete **Milestone D0 (Section 16)** first. It produces a data-source audit and a metric registry. No UI work before that.
3. Implement one milestone at a time. Run tests after each. Keep the application runnable.
4. Where this file conflicts with existing documents or code on conventions (route prefix, error envelope, pagination shape, design system), **existing documents and code win**. Report the conflict.
5. Where this file conflicts with `MRP_Engine.md` on what MRP results contain, `MRP_Engine.md` wins. Adapt the adapter in Section 4.3.
6. **The core rule of this module: every number on screen must come from the database through a defined metric.** No fabricated, placeholder, random, hardcoded or "sample" values anywhere in production code. A metric whose source module is missing shows as *unavailable*, never as zero.
7. Do not claim a feature is complete unless it is implemented and verified.

---

# 1. PURPOSE AND SCOPE

## 1.1 In scope

- An operational **dashboard** (KPI cards plus a small set of charts).
- An **analytics** page with filterable charts.
- A **reports** area with nine reports: filterable, sortable, paginated tables with drill-down.
- **CSV export** of every report. XLSX export is optional.
- A backend **reporting module** that is read-only and built around a registry of named metrics, charts and reports.
- Reconciliation guarantees: dashboard numbers match the corresponding report totals.

## 1.2 Out of scope

- Writing or modifying any business data from reporting code.
- Inventory valuation, cost accounting, margin analysis (the data model has no cost fields for materials).
- Forecasting, demand prediction, machine learning.
- Scheduled or emailed reports, user-saved views, custom report builders.
- PDF report generation.
- Real-time push updates (websockets). Manual refresh and optional polling only.
- Role-based report visibility (authentication is not implemented yet).

---

# 2. ARCHITECTURE RULES

- New backend module `reporting` with sub-packages: `metrics`, `charts`, `reports`, `exports`, `queries`, `schemas`, `api`.
- **Read-only.** Reporting code never inserts, updates or deletes. On PostgreSQL, run reporting queries inside a read-only transaction (`SET TRANSACTION READ ONLY`). Use a dedicated read-only session dependency.
- **Layering:** `router` (thin) → `service` (assembles metrics, handles availability, caching if any) → `queries` (SQLAlchemy 2.x aggregation) → database.
- **Aggregation in SQL**, not in Python loops over full tables. No N+1 queries. Pagination in SQL (`LIMIT/OFFSET` or keyset).
- **Business rules are not duplicated.** Status sets, eligibility rules and formulas are defined once in `reporting/metrics/definitions.py` and referenced everywhere (dashboard, charts, reports, exports). If another module already exports a constant (for example, the PO statuses that count as scheduled receipts), import it rather than redefining it.
- **Reporting read-side exception.** Normally cross-module access goes through ports. Reporting is a deliberate exception: it may query other modules' tables directly, but only from files under `reporting/queries/`, and only for reading. MRP is the exception to the exception: it is read through `MrpReadPort` (4.3), because its schema is defined by `MRP_Engine.md` and may differ from what this file assumes.
- **Schema contract tests.** Add a test that asserts every table and column used by `reporting/queries/` exists. When another module renames a column, this test fails loudly instead of the dashboard silently breaking.
- Pure functions for calculations (rates, ratios, bucketing, status classification) with no FastAPI or SQLAlchemy imports, so they are unit-testable.

---

# 3. SHARED CONVENTIONS

## 3.1 Types and formatting

| Concern | Rule |
|---|---|
| Quantities and money | `Decimal` in Python, serialized as JSON **strings** |
| Rates and ratios | `Decimal` with 4 decimal places, expressed as a fraction (0.8750 means 87.5%). The UI formats as a percentage |
| Dates | ISO 8601 `YYYY-MM-DD` |
| Timestamps | ISO 8601 UTC with `Z` |
| "Today" | Computed in the configured business timezone (`BUSINESS_TIMEZONE`, default `UTC`), never from the client clock |
| Week | ISO week, Monday start, label `YYYY-Www` plus the Monday date |
| Date ranges | Inclusive on both ends |

## 3.2 Three different "empty" states. Do not conflate them.

| State | Meaning | Example |
|---|---|---|
| `OK` with value `0` | Computed from real data; the answer is zero | "0 overdue production orders" |
| `EMPTY` | A chart or table has no data points to draw | No receipts in the selected range |
| `UNAVAILABLE` | The source module does not exist yet | Inventory metrics before the Inventory module is implemented |
| `ERROR` | Query failed (sanitized message, full detail logged) | Database timeout |

A rate with a zero denominator is `value: null` with `status: OK` and a `note` such as `NO_SAMPLE`. It is never `0%` and never `100%`.

## 3.3 Never sum quantities across different units

Materials have different units of measure. **Do not add quantities across materials.** There is no "total inventory quantity" metric. Cross-material aggregates use **counts** or **unitless ratios** only. Quantity totals are allowed only within a single material (or a single UoM when the report explicitly groups by UoM). Money is aggregated **per currency**, never across currencies.

## 3.4 Widget envelope

Every metric and chart returns an envelope so one failing widget never breaks the whole page:

```json
{
  "key": "production.overdue_count",
  "status": "OK",
  "value": "3",
  "unit": "orders",
  "as_of": "2026-11-12T08:30:00Z",
  "note": null,
  "unavailable_reason": null,
  "definition": "Production orders in PLANNED, RELEASED or IN_PROGRESS with due_date before today.",
  "drilldown": { "report": "production-orders", "filters": { "overdue": "true" } }
}
```

`status` is one of `OK`, `EMPTY`, `UNAVAILABLE`, `ERROR`. `drilldown` tells the frontend which report and filters reproduce exactly the rows behind the number (see reconciliation, 12.2). `definition` is shown to the user as a tooltip.

## 3.5 Errors

Reuse the error envelope from `Foundation.md`. Additional codes:

| Code | HTTP | Meaning |
|---|---|---|
| `UNKNOWN_REPORT` | 404 | Report key not registered |
| `UNKNOWN_CHART` | 404 | Chart key not registered |
| `INVALID_FILTER` | 422 | Unknown filter name or invalid value |
| `INVALID_SORT` | 422 | Sort field not in the report's whitelist |
| `EXPORT_TOO_LARGE` | 422 | Row count exceeds `REPORT_EXPORT_MAX_ROWS` |
| `DEPENDENCY_UNAVAILABLE` | 501 | Source module not implemented (reports only; dashboard widgets use the `UNAVAILABLE` status instead) |

## 3.6 Settings (environment-based, document in `.env.example`)

| Setting | Default | Purpose |
|---|---|---|
| `BUSINESS_TIMEZONE` | `UTC` | Defines "today" and week boundaries |
| `DASHBOARD_DUE_SOON_DAYS` | `7` | Horizon for "due soon" |
| `DASHBOARD_ON_TIME_WINDOW_DAYS` | `90` | Default window for on-time and period metrics |
| `SUPPLIER_METRIC_MIN_SAMPLE` | `3` | Minimum events before showing a supplier rate |
| `REPORT_MAX_PAGE_SIZE` | `100` | Upper bound for page size |
| `REPORT_EXPORT_MAX_ROWS` | `50000` | Export row cap |
| `MRP_SCHEDULED_RECEIPT_PO_STATUSES` | from Production&Procurement | Reused for "incoming supply" |

---

# 4. DATA SOURCES, AVAILABILITY AND PORTS

## 4.1 Source modules

| Source | Used for | Owner spec |
|---|---|---|
| Materials, Products, Suppliers | Counts, names, safety stock, preferred supplier | `Master_Data.md` |
| Inventory balances and ledger | On-hand, reserved, available | `Inventory.md` (not yet created) |
| Production orders | Order status, due dates, progress | `Production&Procurement.md` |
| Purchase orders, lines, goods receipts | Open POs, deliveries, supplier performance | `Production&Procurement.md` |
| MRP runs, results, proposals | Planned orders, shortages, exceptions, time-phased balances | `MRP_Engine.md` |

## 4.2 Availability service

Create `ModuleAvailability` that reports, per source module, whether it is implemented and queryable. Determine this from actual schema presence (tables exist at the migration head, checked once at startup and cached) **and** the presence of a real adapter. Do not determine availability by running a query and catching exceptions.

If a module is unavailable:
- Dashboard widgets and charts depending on it return `status: UNAVAILABLE` with `unavailable_reason` naming the module.
- Reports depending on it return `501 DEPENDENCY_UNAVAILABLE` and appear in the report catalog as `available: false`.
- The frontend renders a clear "Not available yet: Inventory module" state, not a zero, not a blank card.

## 4.3 MrpReadPort

```python
class MrpReadPort(Protocol):
    def latest_completed_run(self, session) -> "MrpRunSummary | None": ...
    def list_runs(self, session, *, page, page_size, filters) -> "Page[MrpRunSummary]": ...
    def get_run(self, session, run_id: UUID) -> "MrpRunDetail | None": ...
    def run_counts(self, session, run_id: UUID) -> "MrpRunCounts": ...
    def list_requirements(self, session, run_id: UUID, *, filters, page, page_size,
                          sort) -> "Page[MrpRequirementRow]": ...
    def time_phased(self, session, run_id: UUID, item_id: UUID) -> "list[MrpPeriodRow]": ...
    def list_proposals(self, session, run_id: UUID, *, filters, page, page_size,
                       sort) -> "Page[MrpProposalRow]": ...
    def list_exceptions(self, session, run_id: UUID, *, page, page_size) -> "Page[MrpExceptionRow]": ...
```

Minimum content the dataclasses must carry (map from whatever `MRP_Engine.md` defines):

| Type | Fields |
|---|---|
| `MrpRunSummary` | id, run_number or label, created_at, status, horizon start and end, bucket size |
| `MrpRunCounts` | planned purchase count, planned production count, shortage count, past-due release count, exception count |
| `MrpPeriodRow` | period start, period end, gross requirement, scheduled receipts, projected available balance, net requirement, planned receipt, planned release, safety stock |
| `MrpProposalRow` | id, type (`PURCHASE` or `PRODUCTION`), item id, code, name, quantity, unit, release date, receipt date, status (`OPEN`, `CONVERTED`, others as defined), converted PO id, past-due flag |
| `MrpExceptionRow` | type, severity, item, period, message |

MRP results are immutable snapshots. Reporting reads a **specific run**. The default is the latest completed run, always shown by label and date in the UI. Never mix data from different runs on one screen.

If MRP persistence is not implemented, `MrpReadPort` is bound to an `UnavailableMrpAdapter` and everything MRP-dependent is `UNAVAILABLE`.

## 4.4 Availability matrix

| Feature | Needs | If missing |
|---|---|---|
| Master data KPIs | Materials, Products, Suppliers | Whole module blocked; Master Data is a hard prerequisite |
| Inventory KPIs, charts, reports | Inventory | `UNAVAILABLE` / 501 |
| Production KPIs, charts, report | Production orders | `UNAVAILABLE` / 501 |
| Procurement KPIs, charts, reports, supplier report | Purchase orders and goods receipts | `UNAVAILABLE` / 501 |
| Stock shortage report incoming-supply columns | Purchase orders | Columns omitted and flagged as unavailable; report still works on inventory alone |
| MRP KPIs, charts, three MRP reports | `MrpReadPort` | `UNAVAILABLE` / 501 |

Test doubles are allowed only under `tests/` and named `Fake*`.

---

# 5. METRIC CATALOG (DASHBOARD KPIs)

Every metric is registered in `reporting/metrics/definitions.py` with: `key`, `label`, `unit`, `definition` text, source module, and drilldown target. Definitions below are authoritative. "Today" follows 3.1.

## 5.1 Master data

| Key | Definition |
|---|---|
| `master.materials.active_count` | Count of materials with active status. Also expose `total_count` and `inactive_count` as secondary values |
| `master.products.active_count` | Count of active products |
| `master.suppliers.active_count` | Count of active suppliers |

## 5.2 Inventory (source: Inventory module)

Definitions (match the project formula `Available = On-Hand - Reserved`):

- **On-hand** for a material is the sum of its on-hand balances across locations, if the Inventory module models locations. A material with **no balance row** has on-hand `0` and reserved `0`. This is a stated rule, not an assumption hidden in code.
- **Available** = on-hand minus reserved.
- **Stock status** of an active material:
  - `STOCKOUT` if `available <= 0`.
  - else `BELOW_SAFETY` if `safety_stock > 0` and `available < safety_stock`.
  - else `OK`.
- Inactive materials are excluded from all inventory KPIs.

| Key | Definition |
|---|---|
| `inventory.low_stock_count` | Active materials with status `BELOW_SAFETY` or `STOCKOUT` |
| `inventory.stockout_count` | Active materials with status `STOCKOUT` |
| `inventory.stock_status_counts` | Counts of active materials per stock status (feeds a chart) |

There is no total inventory quantity or value metric (3.3 and 1.2).

## 5.3 Production (source: Production orders)

Open orders: status in `PLANNED`, `RELEASED`, `IN_PROGRESS`. `DRAFT` is counted separately and never as open.

| Key | Definition |
|---|---|
| `production.open_count` | Orders in `PLANNED`, `RELEASED`, `IN_PROGRESS` |
| `production.draft_count` | Orders in `DRAFT` |
| `production.overdue_count` | Open orders with `due_date < today` |
| `production.due_soon_count` | Open orders with `today <= due_date <= today + DASHBOARD_DUE_SOON_DAYS` |
| `production.status_counts` | Counts per status for all statuses (feeds a chart) |
| `production.on_time_completion_rate` | Over orders completed in the last `DASHBOARD_ON_TIME_WINDOW_DAYS` days (by `actual_completion_at` date): `count(actual_completion_date <= due_date) / count(completed)`. `null` with note `NO_SAMPLE` when no orders were completed |

## 5.4 Procurement (source: Purchase orders and goods receipts)

Open POs: status in `SUBMITTED`, `APPROVED`, `SENT`, `PARTIALLY_RECEIVED`.

| Key | Definition |
|---|---|
| `procurement.open_po_count` | Count of open POs |
| `procurement.pending_approval_count` | POs in `SUBMITTED` |
| `procurement.draft_po_count` | POs in `DRAFT` |
| `procurement.overdue_delivery_line_count` | PO lines where the PO status is `SENT` or `PARTIALLY_RECEIVED`, `ordered_quantity - received_quantity > 0` and `expected_receipt_date < today` |
| `procurement.open_value_by_currency` | Per currency, the sum of `(ordered_quantity - received_quantity) * unit_price` over open lines of POs in `APPROVED`, `SENT`, `PARTIALLY_RECEIVED`. Returned as a list of `{currency, value}`, never one combined number |
| `procurement.po_status_counts` | Counts of POs per status (feeds a chart) |

## 5.5 MRP (source: `MrpReadPort`, latest completed run)

All MRP KPIs carry the run label and run date in the envelope (`note` field or a `run` sub-object) so users always know which run they are looking at.

| Key | Definition |
|---|---|
| `mrp.latest_run` | Latest completed run: label, date, horizon. `EMPTY` if no run has completed |
| `mrp.planned_purchase_count` | Planned purchase proposals in the run |
| `mrp.planned_production_count` | Planned production proposals in the run |
| `mrp.open_proposal_count` | Proposals in the run still `OPEN` |
| `mrp.shortage_count` | Items with a shortage in the run, as defined by `MRP_Engine.md` (for example, net requirement not coverable inside the lead-time or past-due planned release). Record the exact definition used in the metric's `definition` text |
| `mrp.past_due_release_count` | Planned order releases dated before the run's start date |
| `mrp.exception_count` | Exceptions raised by the run |

## 5.6 Two different meanings of "shortage". Keep them separate and labelled.

| Name | Meaning | Where it appears |
|---|---|---|
| **Stock shortage (current)** | An active material's current available quantity is below safety stock or zero | Inventory KPIs, Stock Shortage Report |
| **Projected shortage (MRP)** | The MRP run projects an uncovered requirement | MRP KPIs, MRP reports |

The UI must never use the bare word "shortage" in a way that blurs the two. Use "Stock shortage" and "Projected shortage".

---

# 6. CHARTS (ANALYTICS)

All charts are served by `GET /dashboard/charts/{chart_key}` (Section 9) and rendered with Recharts. A chart payload:

```json
{
  "key": "production.due_by_week",
  "status": "OK",
  "type": "stacked_bar",
  "x_label": "Due week",
  "y_label": "Open orders",
  "unit": "orders",
  "series": [
    { "name": "NORMAL", "points": [ { "x": "2026-W46", "y": "4" } ] }
  ],
  "as_of": "2026-11-12T08:30:00Z",
  "definition": "..."
}
```

`type` is one of `bar`, `stacked_bar`, `line`, `area`. Point values are strings. The frontend converts to numbers **only** to plot.

| Key | Chart | Data and rules |
|---|---|---|
| `inventory.stock_status_distribution` | Bar | Counts of active materials per stock status |
| `inventory.top_shortfalls` | Bar | Top N (default 10) active materials by shortfall ratio `(safety_stock - available) / safety_stock`, only where `safety_stock > 0` and `available < safety_stock`. A **unitless ratio**, because quantities across materials cannot be compared |
| `production.orders_by_status` | Bar | Counts per status |
| `production.due_by_week` | Stacked bar | Open orders by due week for the next 8 weeks, plus one `Overdue` bucket first, stacked by priority |
| `procurement.po_status_distribution` | Bar | PO counts per status |
| `procurement.open_value_by_week` | Bar | For a chosen currency, open value by expected receipt week (open lines of `APPROVED`, `SENT`, `PARTIALLY_RECEIVED`) plus an `Overdue` bucket. The `currency` parameter is required when more than one currency exists |
| `procurement.receipts_over_time` | Line | Goods receipt line count per `bucket` (day, week, month) over the date range |
| `procurement.supplier_on_time_rate` | Bar | Per supplier on-time delivery rate (definition 7.6). Suppliers below `SUPPLIER_METRIC_MIN_SAMPLE` are omitted and counted in a `note` ("n suppliers hidden: insufficient data") |
| `mrp.planned_orders_by_period` | Stacked bar | For a selected run: planned purchase vs planned production counts by release period |
| `mrp.projected_balance` | Line | For a selected run and **one** item: projected available balance per period, with the item's safety stock as a reference series. Single item, so units are consistent |
| `mrp.projected_shortages_by_period` | Bar | Count of items with a projected shortage per period for a selected run |

Chart rules:
- Chart queries accept only whitelisted parameters (`date_from`, `date_to`, `bucket`, `currency`, `run_id`, `item_id`, `limit`). Unknown parameters return `INVALID_FILTER`.
- A chart with no points returns `status: EMPTY`, not an empty `series` with `OK`.
- No chart mixes units on one axis.

---

# 7. REPORT CATALOG

Nine reports. Each is registered with: `key`, `title`, `description`, `source modules`, `columns`, `filters`, `sortable fields` (whitelist), `default sort`, `drill-down links`, `export support`.

Common report behavior:
- Pagination with `page` and `page_size` (max `REPORT_MAX_PAGE_SIZE`), response shape matching the repo's existing pagination convention.
- Sorting by whitelisted fields only. A stable secondary sort on the unique key guarantees deterministic pagination.
- Every response includes `as_of`, `total_rows`, applied filters and a `summary` block. Summary blocks contain counts and per-currency money only, never cross-UoM quantity sums (3.3).
- Search `q` is a case-insensitive substring match on code and name fields. Use parameterized `ILIKE`, never string-built SQL.
- Row links: each row carries `links` (entity route hints) so the UI can drill down.

## 7.1 `inventory`: Inventory Report

Source: Materials, Inventory.

Columns: material code, name, material type, unit, on-hand, reserved, available, safety stock, stock status, preferred supplier name.
Filters: `material_type`, `status` (active/inactive, default active), `stock_status`, `supplier_id`, `q`.
Default sort: material code ascending.
Summary: counts per stock status.

## 7.2 `stock-shortage`: Stock Shortage Report

Source: Materials, Inventory, optional Purchase orders.

Rows: active materials with stock status `BELOW_SAFETY` or `STOCKOUT`.
Columns: material code, name, unit, available, safety stock, **shortfall** (`max(0, safety_stock - available)`), stock status, preferred supplier, **incoming open quantity** (sum of open quantity on PO lines in `MRP_SCHEDULED_RECEIPT_PO_STATUSES`, same unit), **earliest expected receipt date**, **covered by incoming** (true when incoming open quantity `>= shortfall`).
Filters: `stock_status`, `material_type`, `supplier_id`, `covered` (true/false), `q`.
Default sort: shortfall ratio descending, then material code.
Summary: count of rows, count covered, count not covered.
If Purchase orders are unavailable, the three incoming columns are omitted and flagged `unavailable`.

## 7.3 `production-orders`: Production Orders Report

Source: Production orders, Products.

Columns: order code, product code, product name, planned quantity, completed quantity, **remaining quantity** (`planned - completed`), unit, planned start, due date, **days to due** (negative when overdue, only for open orders), priority, status, BOM revision.
Filters: `status` (multi), `product_id`, `priority`, `due_from`, `due_to`, `overdue` (true: open orders with `due_date < today`), `due_soon` (true: matches `production.due_soon_count`), `q`.
Default sort: due date ascending, order code.
Summary: counts per status.

## 7.4 `purchase-orders`: Purchase Orders Report

Source: Purchase orders, Suppliers.

Parameter `view`: `orders` (default) or `lines`.

`orders` columns: PO number, supplier code and name, status, order date, line count, currency, total amount, **open value** (open quantity times unit price over lines), earliest open expected date, **received share** (count of fully received lines divided by line count).
`lines` columns: PO number, line number, supplier, material code and name, unit, ordered, received, open, unit price, line total, expected receipt date, **days late** (positive when `today > expected_receipt_date` and open `> 0`), PO status, source MRP run (if converted from a proposal).
Filters: `status` (multi), `supplier_id`, `material_id`, `order_from`, `order_to`, `expected_from`, `expected_to`, `overdue` (lines view and orders view: matches `procurement.overdue_delivery_line_count` logic), `q`.
Default sort: order date descending, PO number.
Summary: counts per status, and **per-currency** total and open value.

## 7.5 `goods-receipts` is not a separate report; receipts appear in the PO detail and in the supplier report.

## 7.6 `suppliers`: Supplier Report

Source: Suppliers, Purchase orders, Goods receipts.

Window: `date_from`, `date_to` (default last `DASHBOARD_ON_TIME_WINDOW_DAYS` days).

Columns: supplier code, name, status, number of POs created in window, **ordered value per currency** (as a list), number of goods receipt lines in window, **on-time delivery rate**, **line fill rate**, **average days late** (late receipt lines only).

Definitions (event-based, never quantity-summed across materials):
- **On-time delivery rate** = count of goods receipt lines in the window where `receipt_date <= purchase_order_item.expected_receipt_date`, divided by count of goods receipt lines in the window. Partial receipts count as individual events. `null` with note `INSUFFICIENT_DATA` if fewer than `SUPPLIER_METRIC_MIN_SAMPLE` events.
- **Line fill rate** = count of PO lines that are fully received (`received >= ordered`) divided by count of PO lines with `expected_receipt_date` in the window belonging to non-cancelled POs in status `SENT`, `PARTIALLY_RECEIVED` or `RECEIVED`. Same minimum sample rule.
- **Average days late** = mean of `(receipt_date - expected_receipt_date)` in days over late receipt lines. `null` when there are none.

Filters: `status`, `q`, `date_from`, `date_to`, `min_events`.
Default sort: name ascending.
Contact details (email, phone, address) are **not** included in this report or its export. They stay on the supplier master screen.

## 7.7 `mrp-runs`: MRP Run Report

Source: `MrpReadPort`.

List view columns: run label, created at, status, horizon start and end, bucket size, planned purchase count, planned production count, projected shortage count, exception count.
Detail view (`GET /reports/mrp-runs/{run_id}`): run parameters, counts, and the exceptions table (type, severity, item, period, message), paginated.
Filters: `status`, `created_from`, `created_to`.
Default sort: created at descending.

## 7.8 `material-requirements`: Material Requirements Report

Source: `MrpReadPort`, for one run (`run_id`, default latest completed).

Rows: one row per item per period, as MRP results define them.
Columns: item code, name, unit, period start, gross requirement, scheduled receipts, projected available balance, net requirement, planned receipt, planned release.
Filters: `run_id`, `item_id`, `item_type`, `period_from`, `period_to`, `only_net_requirements` (true: rows where net requirement `> 0`), `q`.
Default sort: item code, period start.
A "view calculation trace" link per row appears only when MRP stores a trace for that result.
Summary: row count, items count. No quantity sums.

## 7.9 `planned-orders`: Planned Order Report

Source: `MrpReadPort`, for one run.

Columns: proposal id, type, item code and name, quantity, unit, release date, receipt date, status, converted PO number (link to the PO if converted), **past due** (release date before the run's start date), suggested supplier (materials' preferred supplier, purchase proposals only).
Filters: `run_id`, `type`, `status`, `past_due`, `item_id`, `release_from`, `release_to`, `q`.
Default sort: release date ascending, item code.
Summary: counts by type and status.
Link: for open purchase proposals, a link to the proposals conversion page defined in `Production&Procurement.md`.

---

# 8. EXPORTS

- Endpoint `GET /reports/{key}/export?format=csv` accepts the **same filters and sort** as the JSON endpoint and exports **all matching rows**, not just one page.
- CSV format: UTF-8 with BOM (so spreadsheet tools open it correctly), comma-separated, human-readable header labels, `\r\n` line endings, ISO dates, decimals as plain strings without scientific notation, booleans as `true`/`false`, nulls as empty.
- **CSV injection protection.** Any text cell beginning with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with a single quote `'`. Applies to all text fields (names, notes, codes). Numeric and date cells are not altered.
- Stream the response (generator), do not load all rows into memory. Enforce `REPORT_EXPORT_MAX_ROWS` by counting first; exceeding it returns `EXPORT_TOO_LARGE`.
- Response headers: `Content-Disposition: attachment; filename="{report_key}_{YYYYMMDD_HHMM}.csv"`, `X-Report-As-Of`.
- Export totals must equal the JSON endpoint's `total_rows` for the same filters. Covered by tests.
- Optional: `format=xlsx` using `openpyxl` with the same content, with numeric columns written as numbers and text injection protection applied. Implement only after CSV is complete and tested.
- Exports contain only the registered columns for that report. No internal ids unless the column is registered as an id column.

---

# 9. API

Prefix `/api/v1` (verify against `Foundation.md`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard/summary` | All KPI widget envelopes (Section 5), keyed by metric key. Each widget isolated; one failing widget returns `ERROR` for itself only |
| GET | `/dashboard/charts` | List of registered charts with title, description, parameters and availability |
| GET | `/dashboard/charts/{chart_key}` | One chart payload. Query parameters per Section 6 |
| GET | `/reports` | Report catalog: key, title, description, available (bool), unavailable reason, filters, columns |
| GET | `/reports/{key}` | Report page. Query: filters, `sort`, `page`, `page_size` |
| GET | `/reports/{key}/export` | CSV (or XLSX) export |
| GET | `/reports/mrp-runs/{run_id}` | MRP run detail (7.7). Register before the generic `/{key}` route or give it an unambiguous path |

Rules:
- Dashboard and report endpoints are `GET` only.
- Unknown filters are rejected (`INVALID_FILTER`), not ignored. Sort fields are whitelisted (`INVALID_SORT`).
- Query parameter parsing uses Pydantic models per report with `extra="forbid"`.
- All endpoints are documented in OpenAPI with example responses.
- No endpoint accepts raw SQL fragments, column names or expressions from the client.

---

# 10. FRONTEND

## 10.1 Routes

| Route | Page |
|---|---|
| `/dashboard` (or the app's existing home route) | KPI cards and charts. **Replaces the placeholder dashboard.** Keep the existing API health indicator |
| `/analytics` | Full chart gallery with filters |
| `/reports` | Report catalog |
| `/reports/:key` | Report table, filters, export |
| `/reports/mrp-runs/:runId` | MRP run detail |

Add navigation entries. Wire any remaining module placeholder cards on the dashboard to real routes.

## 10.2 Shared components

Build reusable components in the existing design system (do not introduce a second visual style):

- `KpiCard`: label, value, unit, status handling (`OK`, `EMPTY`, `UNAVAILABLE`, `ERROR`), definition tooltip, optional drilldown link, optional secondary values.
- `ChartPanel`: Recharts wrapper handling loading, empty, unavailable and error states; legend; tooltip; axis labels from payload; accessible text alternative.
- `ReportTable`: sortable headers, pagination, loading skeleton, empty state, row links, sticky header on long tables, horizontal scroll on narrow screens.
- `FilterBar`: typed filter inputs driven by the report catalog metadata (so a new report does not require new filter code).
- `ExportButton`: calls the export endpoint with the current filters, shows progress, handles `EXPORT_TOO_LARGE`.
- `AsOfStamp`: shows the data timestamp and a manual refresh button.
- `RunSelector`: lists MRP runs, defaults to the latest completed, shows label and date.

## 10.3 Dashboard layout

1. Header row: title, `AsOfStamp`, refresh button, optional auto-refresh toggle (off by default; 60 second interval when on; paused when the tab is hidden).
2. KPI groups: Master Data, Inventory, Production, Procurement, MRP. Each group is hidden entirely only if the user collapses it, never silently when unavailable. Unavailable groups render a single explanatory card.
3. Charts row: stock status distribution, production due by week, PO status distribution, MRP planned orders by period (latest run).
4. "Needs attention" strip: links to the reports behind `production.overdue_count`, `procurement.overdue_delivery_line_count`, `inventory.stockout_count`, `procurement.pending_approval_count`, and `mrp.open_proposal_count`, shown only when the count is above zero.

## 10.4 UX requirements

- Filters are synchronized with the URL query string so views are shareable and survive refresh.
- Every KPI card with a drilldown navigates to the report with the filters that reproduce its number (reconciliation, 12.2).
- Loading skeletons, empty states, unavailable states and error states for every widget. Errors show a retry action and a sanitized message.
- Quantities and money are displayed from the server's strings. Rates are formatted as percentages from the decimal fraction. Where a rate is `null`, show an em dash with the reason (for example "No completed orders in window"), never `0%`.
- Charts: do not rely on color alone (use patterns, direct labels or distinct markers and a legend); provide an accessible description and a "view as table" toggle that shows the same data in a table; sensible number formatting on axes.
- Responsive: single column on phones, grid on larger screens. Charts resize with their container.
- Accessible: semantic headings, keyboard-focusable controls, ARIA labels on charts and KPI cards, sufficient contrast in the dark theme.
- No dead controls. Disabled controls always show why.
- Never display a figure that is not returned by the API.

---

# 11. PERFORMANCE

Targets measured on PostgreSQL with a seeded volume of at least: 5,000 materials, 2,000 products, 500 suppliers, 20,000 production orders, 20,000 purchase orders with 80,000 lines, 100,000 goods receipt lines, 200,000 inventory transactions, and several MRP runs.

| Endpoint | Target (p95, warm) |
|---|---|
| `/dashboard/summary` | under 500 ms |
| Each `/dashboard/charts/{key}` | under 400 ms |
| `/reports/{key}` page (page size 50) | under 600 ms |
| CSV export first byte | under 1 s, then streaming |

Rules:
- Aggregations in SQL. Verify with `EXPLAIN (ANALYZE)` for each heavy query and record results in the milestone report.
- Index review: confirm indexes exist for the access patterns used (for example production orders by `(status, due_date)`, PO lines by `expected_receipt_date`, goods receipts by `receipt_date`, goods receipt lines by `purchase_order_item_id`, inventory balances by `material_id`). Add a migration for missing indexes **only** when query plans justify it, and list them in the report.
- Assert query counts in tests (for example the dashboard summary issues a bounded number of queries independent of row counts).
- Caching: none in v1. If targets are missed, add a short TTL in-process cache (maximum 30 seconds) on `/dashboard/summary` only, with the `as_of` value reflecting the real computation time. Do not add caching before measuring.
- Seeding for performance tests uses a script under `scripts/` and is never run in production.

---

# 12. DATA CORRECTNESS RULES

## 12.1 Single source of definitions

Status sets, formulas and eligibility rules live in `reporting/metrics/definitions.py`. A metric's tooltip text is generated from the same registry entry the query uses, so documentation and behavior cannot drift.

## 12.2 Reconciliation (mandatory, tested)

For every KPI that has a drilldown, the dashboard value **must equal** `total_rows` of the drilled-down report with the drilldown filters. Examples:

| KPI | Report | Filters |
|---|---|---|
| `production.overdue_count` | `production-orders` | `overdue=true` |
| `production.due_soon_count` | `production-orders` | `due_soon=true` |
| `inventory.low_stock_count` | `stock-shortage` | `stock_status` in `BELOW_SAFETY, STOCKOUT` |
| `inventory.stockout_count` | `stock-shortage` | `stock_status=STOCKOUT` |
| `procurement.overdue_delivery_line_count` | `purchase-orders` | `view=lines`, `overdue=true` |
| `procurement.pending_approval_count` | `purchase-orders` | `status=SUBMITTED` |
| `mrp.open_proposal_count` | `planned-orders` | `run_id=<latest>`, `status=OPEN` |

Chart totals must also reconcile with their report counterparts (for example, the sum of `production.orders_by_status` points equals the total number of production orders).

## 12.3 Consistency with other modules

- Production "open" and procurement "open" statuses must match the sets used by the MRP providers in `Production&Procurement.md` where the concepts overlap. Import shared constants; do not copy literals.
- MRP figures always come from one specific, labelled run.
- Reporting reads committed data only.

## 12.4 No fabricated data

- No `Math.random`, no hardcoded arrays, no placeholder numbers in components or services.
- Development fixtures exist only as seed scripts that write through the normal services, and are clearly named.
- When the database is empty the dashboard shows real zeros and empty states.

---

# 13. SECURITY AND QUALITY

- Pydantic models with `extra="forbid"` for every query parameter set.
- Whitelisted filters and sort fields. No dynamic SQL from client input.
- Bound `page_size`, export row count and chart point counts.
- Sanitized error messages. Log full exceptions server-side with request id.
- Supplier contact data and notes fields excluded from exports unless explicitly registered.
- CSV injection protection (Section 8).
- Reporting DB session is read-only on PostgreSQL.
- No secrets in code. Settings from the environment (3.6).
- Type hints everywhere. Avoid unneeded abstractions: the registry, the query modules and the envelope are the abstractions this module needs.

---

# 14. TESTING REQUIREMENTS

Use `pytest`. Fixtures create real rows through factories or services. `Fake*` doubles only under `tests/`.

## 14.1 Unit tests (no DB)

- Stock status classification: stockout, below safety, OK, safety stock zero, negative available.
- Shortfall and shortfall ratio math with `Decimal`, including edge values.
- Rate calculations: normal, zero denominator returns `null` with `NO_SAMPLE`, minimum sample handling.
- Bucketing: ISO week boundaries including year boundaries (for example 2026-12-28 to 2027-01-03), day and month buckets.
- "Today" resolution across timezones around midnight.
- CSV cell sanitization for each dangerous leading character, and for safe values.
- Filter and sort whitelist validation.
- Envelope construction for each status.

## 14.2 Integration tests (database)

For every metric in Section 5:
- Empty database returns `OK` with zero (counts) or `EMPTY`/`null` as specified.
- Seeded scenario returns the exact expected values, hand-calculated in the test.
- Boundary cases: due date exactly today (not overdue), due exactly at the due-soon horizon, inactive materials excluded, cancelled and draft orders excluded, fully received lines excluded from open value.

For every report:
- Each filter individually and in combination.
- Sorting on each whitelisted field, with deterministic pagination across pages (no duplicates or gaps).
- Page size bound enforced.
- Summary block values.
- Unknown filter returns `INVALID_FILTER`; bad sort returns `INVALID_SORT`.

Supplier report: on-time, fill rate and days late computed against a hand-built scenario with partial receipts; minimum sample behavior.

Multi-currency: open value returned per currency, never combined.

Mixed units: a test with materials in different units asserts that no cross-material quantity sum is exposed anywhere.

Availability: with `Unavailable*` adapters, widgets return `UNAVAILABLE` with reason, reports return 501, and the catalog marks them unavailable. Verify that unavailable is never rendered as zero (API-level assertion).

Widget isolation: force one query to raise; the summary still returns other widgets and `ERROR` for the failing one.

Read-only guarantee: attempt a write through the reporting session (PostgreSQL) and assert it fails.

MRP: for a stored run, KPIs, charts and reports match the run's persisted results; reading two runs never mixes data.

## 14.3 Reconciliation tests

One test per row in 12.2, plus chart-to-report totals.

## 14.4 Export tests

- Filters applied identically to JSON and CSV; row count equals `total_rows`.
- BOM and line endings; header labels; decimals as plain strings.
- Injection protection on a seeded name beginning with `=`.
- `EXPORT_TOO_LARGE` when the cap is lowered in test settings.
- Streaming does not load everything into memory (assert generator usage or bounded memory on a large seed).

## 14.5 Schema contract test

Assert every table and column referenced by `reporting/queries/` exists in the migrated schema.

## 14.6 Performance tests

Run the seeded-volume scenario (Section 11), assert query counts, and record timings. Timing assertions may be warnings in CI and hard checks in the manual performance run, but the numbers must be reported.

## 14.7 Frontend tests

- `KpiCard` renders each of the four statuses; `null` rate shows the em dash and reason.
- `ChartPanel` shows empty, unavailable and error states, and the table toggle.
- Filters round-trip through the URL.
- `ReportTable` sorting and pagination call the API with expected parameters.
- Export button handles success and `EXPORT_TOO_LARGE`.
- Drilldown links carry the expected filters.

A milestone is not complete until its tests pass and the full existing suite still passes.

---

# 15. ACCEPTANCE CRITERIA (OVERALL)

- All endpoints in Section 9 exist and are documented in OpenAPI.
- Every metric in Section 5 and chart in Section 6 is registered, returns the envelope, and has a visible definition.
- All nine reports in Section 7 work with filters, sorting, pagination, summary and CSV export, except those legitimately blocked by a missing module, which show as unavailable and are listed in the report.
- Reconciliation tests (12.2) pass.
- No cross-unit quantity sums and no cross-currency money sums exist anywhere in the output.
- Unavailable sources never render as zero.
- No fabricated values exist in any code path (verified by code search and review, reported).
- Reporting is read-only (verified by test).
- Performance targets are met, or the shortfall is reported with query plans.
- Frontend pages use the real API, have loading, empty, unavailable and error states, are responsive and accessible, and contain no dead controls.
- Existing tests pass. `.env.example` and docs are updated.

---

# 16. MILESTONES

Implement strictly in order. After each milestone: run the full test suite, update docs, produce the report in Section 17.

## D0: Audit and metric registry (no UI)
- Inspect the repo: which source modules and tables really exist, their column names, status enums, route and pagination conventions, design system, charting setup (confirm Recharts is installed and working).
- Read `MRP_Engine.md` and record how it defines shortage, past-due and persisted results.
- Produce the data-source audit table (module, exists, tables used, adapter).
- Create `reporting/metrics/definitions.py` with the registry skeleton for Section 5 and Section 6 definitions.
- Add settings and `.env.example` entries.
- **Acceptance:** audit delivered, registry compiles, app runs, existing tests pass.

## D1: Reporting core
- `ModuleAvailability`, envelope types, read-only session dependency, filter and sort validation framework, report registry and catalog endpoint, `MrpReadPort` with `UnavailableMrpAdapter`, schema contract test, CSV export infrastructure with injection protection.
- **Acceptance:** unit tests for framework pieces pass; `/reports` returns the catalog with accurate availability.

## D2: Master data and inventory metrics, charts, reports
- Metrics 5.1 and 5.2, charts for inventory, reports `inventory` and `stock-shortage`.
- If Inventory is missing: `UNAVAILABLE` behavior and tests only; report as blocked, not complete.
- **Acceptance:** integration and reconciliation tests pass.

## D3: Production and procurement metrics, charts, reports
- Metrics 5.3 and 5.4, related charts, reports `production-orders`, `purchase-orders`, `suppliers`.
- **Acceptance:** boundary tests, multi-currency test, supplier metric tests, reconciliation tests pass.

## D4: MRP metrics, charts, reports
- Metrics 5.5, MRP charts, reports `mrp-runs`, `material-requirements`, `planned-orders`, real `MrpReadPort` adapter if MRP persistence exists.
- If MRP persistence is missing: unavailable behavior and tests with `FakeMrpReadPort`; report as blocked.
- **Acceptance:** run-isolation tests and reconciliation tests pass.

## D5: Dashboard frontend
- Shared components (10.2), dashboard page (10.3), navigation, replacement of placeholders.
- **Acceptance:** manual walkthrough on a database with real data, an empty database, and with a module unavailable; frontend tests pass.

## D6: Reports and analytics frontend, exports
- Reports catalog and report pages, analytics page, export button, MRP run detail page, URL-synced filters.
- **Acceptance:** walkthrough of all reports and exports; export parity tests pass; frontend tests pass.

## D7: Performance, hardening and documentation
- Seeded-volume run, `EXPLAIN` review, index migration if justified, query-count assertions, optional TTL cache only if targets are missed, accessibility pass, optional XLSX export, documentation updates (`Architecture.md` module list, API notes, `.env.example`, this file's status table).
- **Acceptance:** Section 15 satisfied; performance numbers reported.

---

# 17. REQUIRED REPORT FORMAT (after every milestone)

1. What you inspected.
2. What you implemented.
3. Files created or modified.
4. Database changes (migrations, indexes, with the query plan that justified each).
5. API endpoints added.
6. Frontend functionality completed.
7. Tests executed and results (counts, failures, skipped and why).
8. Errors encountered and how they were fixed.
9. Blocked items and unavailable sources.
10. Deviations from this specification and why.
11. Remaining work.
12. Recommended next milestone.

Do not state that a feature is complete unless it is implemented and verified by tests or a described manual check.

---

# 18. OPEN DECISIONS (defaults used if unanswered)

| ID | Question | Default |
|---|---|---|
| OD-1 | Inventory valuation and cost-based KPIs | Not provided. Materials have no cost field. A later cost model would add them |
| OD-2 | Low-stock definition | `available < safety_stock` when `safety_stock > 0`, plus `available <= 0` as stockout |
| OD-3 | Business timezone | `UTC` until configured |
| OD-4 | Supplier on-time definition | Receipt date on or before the PO line expected date, no grace days. Candidate: configurable tolerance |
| OD-5 | Money aggregation | Per currency only; no conversion |
| OD-6 | Caching | None until performance measurements justify it |
| OD-7 | XLSX export | Optional, after CSV |
| OD-8 | Report access control | Open to all users until authentication exists |
| OD-9 | MRP shortage definition | Taken from `MRP_Engine.md`; this file's wording is a placeholder to be reconciled in D0 |

Keep each default behind a named constant or setting so it can be changed in one place, and record the chosen value in the milestone report.

---

# 19. DOCUMENTATION STATUS (update when done)

| Document | Status |
|---|---|
| Architecture.md | Created |
| Foundation.md | Created |
| Master_Data.md | Created |
| MRP_Engine.md | Created |
| Production&Procurement.md | Created |
| Dashboard&analytics.md | Created (this file) |
| BOM_Management.md | Not yet created |
| Inventory.md | Not yet created |
| Deployment.md | Not yet created |

**Start with Milestone D0. Do not begin D1 until the data-source audit and metric registry are delivered and reviewed.**
