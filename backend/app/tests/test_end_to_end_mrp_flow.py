import uuid
from decimal import Decimal
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_end_to_end_mrp_procurement_lifecycle():
    suffix = uuid.uuid4().hex[:6].upper()
    # 1. Create Supplier
    sup_res = client.post(
        "/api/v1/suppliers",
        json={
            "supplier_code": f"SUP-TATA-{suffix}",
            "name": f"Tata Steel Plant {suffix}",
            "email": f"procurement-{suffix}@tatasteel.com",
            "payment_terms": "Net 30",
            "city": "Jamshedpur",
            "state": "Jharkhand",
            "tax_identifier": "20AAACT2727Q1ZM",
        },
    )
    assert sup_res.status_code == 201
    supplier_id = sup_res.json()["id"]

    # 2. Create Raw Material (CRCA Steel Sheet)
    mat_res = client.post(
        "/api/v1/materials",
        json={
            "material_code": f"RM-STEEL-{suffix}",
            "name": f"CRCA Sheet Metal {suffix}",
            "unit": "KG",
            "unit_cost": "75.50",
            "lead_time_days": 7,
            "safety_stock": "50.00",
            "reorder_point": "100.00",
            "preferred_supplier_id": supplier_id,
        },
    )
    assert mat_res.status_code == 201
    material_id = mat_res.json()["id"]

    # 3. Create Finished Product
    prod_res = client.post(
        "/api/v1/products",
        json={
            "product_code": f"FG-CHASSIS-{suffix}",
            "name": f"EV Chassis Frame Assembly {suffix}",
            "unit_of_measure": "NOS",
            "product_type": "FINISHED",
            "lead_time_days": 5,
        },
    )
    assert prod_res.status_code == 201
    product_id = prod_res.json()["id"]

    # 4. Create BOM
    bom_res = client.post(
        "/api/v1/boms",
        json={
            "product_id": product_id,
            "revision": "Rev 1.0",
            "description": "EV Chassis Primary BOM",
            "items": [
                {
                    "material_id": material_id,
                    "quantity": "25.0000",
                    "unit_of_measure": "KG",
                    "scrap_factor": "0.0400",
                    "item_sequence": 10,
                }
            ],
        },
    )
    assert bom_res.status_code == 201
    bom_id = bom_res.json()["id"]

    # 5. Explode BOM for demand of 10 units
    exp_res = client.get(f"/api/v1/boms/{bom_id}/explosion?quantity=10.0")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert len(exp_data) == 1
    # 10 * 25 = 250 KG base, with 4% scrap = 260.0000 KG
    assert Decimal(str(exp_data[0]["effective_quantity"])) == Decimal("260.0000")

    # 6. Post initial inventory for raw material (100 KG)
    inv_res = client.post(
        "/api/v1/inventory/transactions",
        json={
            "material_id": material_id,
            "transaction_type": "RECEIPT",
            "quantity": "100.0000",
            "unit_of_measure": "KG",
            "notes": "Initial warehouse receipt",
        },
    )
    assert inv_res.status_code == 201

    bal_res = client.get(f"/api/v1/inventory/balances/{material_id}")
    assert bal_res.status_code == 200
    assert Decimal(str(bal_res.json()["on_hand_quantity"])) == Decimal("100.0000")
    assert Decimal(str(bal_res.json()["available_quantity"])) == Decimal("100.0000")

    # 7. Create Production Order for 10 units
    due_dt = date.today() + timedelta(days=14)
    prd_res = client.post(
        "/api/v1/production-orders",
        json={
            "product_id": product_id,
            "planned_quantity": "10.0000",
            "due_date": due_dt.isoformat(),
            "priority": "HIGH",
            "notes": "Customer Batch Delivery",
        },
    )
    assert prd_res.status_code == 201
    order_id = prd_res.json()["id"]
    order_version = prd_res.json()["version"]

    # Transition order: DRAFT -> PLANNED -> RELEASED -> IN_PROGRESS
    plan_res = client.post(
        f"/api/v1/production-orders/{order_id}/transitions",
        json={"to_status": "PLANNED", "version": order_version},
    )
    assert plan_res.status_code == 200
    order_version = plan_res.json()["version"]

    rel_res = client.post(
        f"/api/v1/production-orders/{order_id}/transitions",
        json={"to_status": "RELEASED", "version": order_version},
    )
    assert rel_res.status_code == 200

    # 8. Run MRP
    mrp_res = client.post(
        "/api/v1/mrp/runs",
        json={
            "planning_start_date": date.today().isoformat(),
            "planning_horizon_periods": 8,
            "period_type": "WEEKLY",
        },
    )
    assert mrp_res.status_code == 201
    mrp_data = mrp_res.json()
    assert mrp_data["status"] == "COMPLETED"
    assert mrp_data["proposals_count"] >= 1

    # Check proposals for raw material
    props_res = client.get(f"/api/v1/mrp/proposals?mrp_run_id={mrp_data['id']}&status=OPEN")
    assert props_res.status_code == 200
    proposals = props_res.json()
    assert len(proposals) >= 1
    proposal = [p for p in proposals if p["material_id"] == material_id][0]
    # Net requirement: Demand is 260 + Safety Stock 50 - OnHand 100 = 210 KG
    assert Decimal(str(proposal["quantity"])) == Decimal("210.0000")

    # 9. Convert MRP proposal to Purchase Order
    po_res = client.post(
        "/api/v1/purchase-orders/from-proposals",
        json={
            "supplier_id": supplier_id,
            "lines": [
                {
                    "proposal_id": proposal["id"],
                    "unit_price": "75.5000",
                }
            ],
        },
    )
    assert po_res.status_code == 201
    po_data = po_res.json()
    po_id = po_data["id"]
    po_item_id = po_data["items"][0]["id"]
    assert Decimal(str(po_data["items"][0]["ordered_quantity"])) == Decimal("210.0000")

    # Transition PO: DRAFT -> SUBMITTED -> APPROVED -> SENT
    po_ver = po_data["version"]
    s1 = client.post(f"/api/v1/purchase-orders/{po_id}/transitions", json={"to_status": "SUBMITTED", "version": po_ver})
    assert s1.status_code == 200
    s2 = client.post(f"/api/v1/purchase-orders/{po_id}/transitions", json={"to_status": "APPROVED", "version": s1.json()["version"]})
    assert s2.status_code == 200
    s3 = client.post(f"/api/v1/purchase-orders/{po_id}/transitions", json={"to_status": "SENT", "version": s2.json()["version"]})
    assert s3.status_code == 200

    # 10. Receive Goods against Purchase Order
    gr_res = client.post(
        f"/api/v1/purchase-orders/{po_id}/receipts",
        json={
            "delivery_reference": "DN-MUM-2026-091",
            "lines": [
                {
                    "purchase_order_item_id": po_item_id,
                    "received_quantity": "210.0000",
                }
            ],
        },
    )
    assert gr_res.status_code == 201
    assert len(gr_res.json()["items"]) == 1

    # Verify PO status is now RECEIVED
    po_check = client.get(f"/api/v1/purchase-orders/{po_id}")
    assert po_check.json()["status"] == "RECEIVED"

    # Verify Inventory on hand increased by 210 KG (100 + 210 = 310 KG)
    bal_after = client.get(f"/api/v1/inventory/balances/{material_id}")
    assert Decimal(str(bal_after.json()["on_hand_quantity"])) == Decimal("310.0000")
