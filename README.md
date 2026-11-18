# MRP.OS — Enterprise Material Requirements Planning System

A production-ready, discrete manufacturing Material Requirements Planning (MRP) and Operations Management system customized for **Indian Industrial Metrics (INR ₹, Lakhs/Crores, KG, NOS, MTR, LTR)**.

The application implements deterministic multi-level BOM explosion, DFS graph cycle detection, time-phased netting, lot-sizing heuristics (L4L, Fixed Multiples, MOQ), an append-only inventory ledger, production order lifecycles, and closed-loop procurement with atomic Goods Receipt Note (GRN) posting.

---

## Academic Project Details
* **Academic Level:** B.Tech 2nd Year – Computer Science and Engineering (Data Science)
* **Academic Session:** 2026–2027
* **Report Document:** [PROJECT_REPORT.md](PROJECT_REPORT.md) (Complete 16-chapter official project report ready for submission)

---

## Architecture Overview

Strict 3-tier layered architecture:

- **Presentation Tier**: React 18, Vite 5, Tailwind CSS, Lucide React, and Recharts. Centralized API client communication via `/api/v1`.
- **Application Tier**: FastAPI (Python), Pydantic v2 validation contracts, domain services, repository pattern, and pure deterministic mathematical calculation domain modules.
- **Data Tier**: SQLAlchemy 2.x declarative ORM, Alembic schema migrations, SQLite / PostgreSQL with foreign key enforcement and optimistic locking (`version`).

---

## Key Features

1. **Executive Inventory Intelligence Dashboard (XYRA ERP Style)**
   - Real-time stock capitalization in Indian Rupees (`₹`) with Lakhs (`L`) and Crores (`Cr`) formatting.
   - 6-month inventory valuation trend vs product count.
   - Stock status distribution donut chart.
   - Critical shortages radar (&le; 3 days) with 1-click PO creation.
   - Recent plant activities with IST timestamps (`Asia/Kolkata`).

2. **Multi-Level Bill of Materials (MRPEasy Style)**
   - Indented BOM hierarchy linking Finished Goods, Subassemblies, and Raw Materials.
   - Directed Acyclic Graph (DAG) cycle detection using Depth-First Search (DFS).
   - Indented explosion modal with scrap factor calculations and cumulative lead-time rollups.
   - One-click CSV export in INR standard costs.

3. **Deterministic MRP Calculation Engine (Phase 6)**
   - Netting equation: $\text{Net Requirement} = \max\left(0, \text{Gross Requirement} + \text{Safety Stock} - \text{Projected Balance}\right)$
   - Lot sizing: Lot-for-Lot (`L4L`), Fixed Lot Size multiples, and Minimum Order Quantity (`MOQ`).
   - Lead-time offsets: $\text{Release Date} = \text{Need Date} - \text{Lead Time}$, with `PAST_DUE` exception flags.
   - Formally verified against the Section 6 numerical fixture in `Documents/MRP_Engine.md`.

4. **Production Planning Module (Phase 5)**
   - Finite State Machine: `DRAFT` &rarr; `PLANNED` &rarr; `RELEASED` &rarr; `IN_PROGRESS` &rarr; `COMPLETED`.
   - BOM effectivity validation and product UOM matching.
   - Monotonic progress recording and append-only status history audit trail.

5. **Procurement & Goods Receipt (Phase 7)**
   - PO lifecycle: `DRAFT` &rarr; `SUBMITTED` &rarr; `APPROVED` &rarr; `SENT` &rarr; `PARTIALLY_RECEIVED` &rarr; `RECEIVED`.
   - Explicit 1-click conversion from MRP replenishment proposals into draft Purchase Orders.
   - Goods Receipt Notes (`GRN-{YYYY}-{NNNNNN}`) with atomic inventory ledger posting.

6. **Append-Only Inventory Ledger**
   - Double-entry inventory control: warehouse balances are updated exclusively through transaction records (`RECEIPT`, `ISSUE`, `ADJUSTMENT`, `RESERVATION`, `RELEASE`).

---

## Live Endpoints

- **Frontend User Interface**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Interactive Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **FastAPI Alternative Docs (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Backend Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## Quick Start & Running

### Option A: One-Command Docker Deployment (Production Ready)

Deploy the entire production stack (Nginx + React SPA + FastAPI + PostgreSQL) with a single command:

```bash
# 1. Copy production configuration
cp .env.example .env

# 2. Deploy with PostgreSQL
./deploy.sh

# Or deploy lightweight SQLite mode (for low-memory VPS)
./deploy.sh sqlite
```

- **Application UI**: [http://localhost:80](http://localhost:80)
- **API Swagger Docs**: [http://localhost:80/docs](http://localhost:80/docs)
- **Health Check**: [http://localhost:80/api/health](http://localhost:80/api/health)

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete cloud VPS, HTTPS/SSL, PaaS, and backup instructions.

---

### Option B: Local Development Setup

#### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Apply database migrations
.venv/bin/alembic upgrade head

# Seed Indian manufacturing demo data
.venv/bin/python scripts/seed_demo.py

# Start FastAPI server
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd frontend

# Install packages
npm install

# Run Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173

# Or build for production
npm run build
```

---

## Automated Testing

Run the automated test suite across all modules:

```bash
cd backend
.venv/bin/pytest -v
```

*Results: **25 passed in 0.74s**.*

---

## Project Structure

```text
├── Documents/                   # Architectural & Module specifications
│   ├── Architecture.md
│   ├── Foundation.md
│   ├── Master_Data.md
│   ├── MRP_Engine.md
│   ├── Production&Procurement.md
│   └── Dashboard&analytics.md
├── PROJECT_REPORT.md           # Full 16-chapter official University Project Report
├── backend/
│   ├── alembic/                # Database migration version scripts
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST endpoints (BOM, MRP, Inventory, Production, PO)
│   │   ├── domain/mrp/         # Pure calculation algorithms (Netting, lot sizing, calendar)
│   │   ├── models/             # SQLAlchemy 2.x declarative models
│   │   ├── repositories/       # Data query repositories
│   │   ├── schemas/            # Pydantic v2 validation contracts
│   │   ├── services/           # Business services & transaction boundaries
│   │   └── tests/              # 25 automated Pytest unit and integration tests
│   ├── scripts/seed_demo.py    # Indian industrial seed script
│   ├── requirements.txt
│   └── pytest.ini
└── frontend/
    ├── src/
    │   ├── components/         # Layout (Sidebar, Header), StatusBadges, Modals
    │   ├── features/           # Dashboard, Materials, Products, Suppliers, BOM, Production, PO, Auth
    │   └── services/           # HTTP API client wrappers
    └── package.json
```
