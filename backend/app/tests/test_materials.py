import uuid
import pytest
from fastapi.testclient import TestClient


def test_create_valid_material(client: TestClient):
    payload = {
        "material_code": "mat-steel-001",  # Test normalization to uppercase
        "name": "Mild Steel Sheet",
        "description": "Standard sheet metal 2mm",
        "category": "Raw Material",
        "material_type": "RAW",
        "unit": "KG",
        "procurement_type": "BUY",
        "unit_cost": "45.5000",
        "lead_time_days": 7,
        "safety_stock": "100.0000",
        "minimum_order_qty": "50.0000",
        "lot_size": "LOT_FOR_LOT",
    }
    response = client.post("/api/v1/materials", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["material_code"] == "MAT-STEEL-001"
    assert data["name"] == "Mild Steel Sheet"
    assert data["unit"] == "KG"
    assert float(data["unit_cost"]) == 45.5
    assert data["lead_time_days"] == 7
    assert data["is_active"] is True
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_reject_blank_name_code_unit(client: TestClient):
    # Blank code
    response = client.post("/api/v1/materials", json={
        "material_code": "   ",
        "name": "Steel",
        "unit": "KG"
    })
    assert response.status_code == 422

    # Blank name
    response = client.post("/api/v1/materials", json={
        "material_code": "MAT-002",
        "name": "   ",
        "unit": "KG"
    })
    assert response.status_code == 422

    # Blank unit
    response = client.post("/api/v1/materials", json={
        "material_code": "MAT-003",
        "name": "Steel",
        "unit": "  "
    })
    assert response.status_code == 422


def test_reject_negative_unit_cost(client: TestClient):
    response = client.post("/api/v1/materials", json={
        "material_code": "MAT-NEG-01",
        "name": "Negative Cost Item",
        "unit": "EA",
        "unit_cost": "-5.0000"
    })
    assert response.status_code == 422


def test_reject_negative_lead_time(client: TestClient):
    response = client.post("/api/v1/materials", json={
        "material_code": "MAT-NEG-02",
        "name": "Negative Lead Time Item",
        "unit": "EA",
        "lead_time_days": -2
    })
    assert response.status_code == 422


def test_reject_duplicate_material_code(client: TestClient):
    payload = {
        "material_code": "MAT-DUP-01",
        "name": "Original Material",
        "unit": "EA",
        "unit_cost": "10.0000"
    }
    res1 = client.post("/api/v1/materials", json=payload)
    assert res1.status_code == 201

    # Attempt to insert same code (case-insensitive)
    payload_dup = {
        "material_code": "mat-dup-01",
        "name": "Duplicate Material",
        "unit": "EA",
        "unit_cost": "12.0000"
    }
    res2 = client.post("/api/v1/materials", json=payload_dup)
    assert res2.status_code == 409
    data = res2.json()
    assert data["error"]["code"] == "DUPLICATE_CODE"


def test_get_material_by_id(client: TestClient):
    payload = {
        "material_code": "MAT-GET-01",
        "name": "Get By Id Material",
        "unit": "EA",
        "unit_cost": "15.0000"
    }
    create_res = client.post("/api/v1/materials", json=payload)
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/materials/{created_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["id"] == created_id
    assert data["material_code"] == "MAT-GET-01"


def test_get_unknown_material_returns_404(client: TestClient):
    random_uuid = str(uuid.uuid4())
    response = client.get(f"/api/v1/materials/{random_uuid}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_update_only_supplied_fields(client: TestClient):
    payload = {
        "material_code": "MAT-UPD-01",
        "name": "Original Name",
        "description": "Original Description",
        "unit": "M",
        "unit_cost": "20.0000",
        "lead_time_days": 5
    }
    create_res = client.post("/api/v1/materials", json=payload)
    created = create_res.json()
    created_id = created["id"]

    # Patch name and unit_cost only
    update_payload = {
        "name": "Updated Name",
        "unit_cost": "25.5000"
    }
    patch_res = client.patch(f"/api/v1/materials/{created_id}", json=update_payload)
    assert patch_res.status_code == 200
    updated = patch_res.json()

    # Changed fields
    assert updated["name"] == "Updated Name"
    assert float(updated["unit_cost"]) == 25.5
    # Unchanged fields preserved
    assert updated["material_code"] == "MAT-UPD-01"
    assert updated["description"] == "Original Description"
    assert updated["unit"] == "M"
    assert updated["lead_time_days"] == 5


def test_fixed_lot_size_validation(client: TestClient):
    # FIXED lot size without fixed_lot_size should fail
    res = client.post("/api/v1/materials", json={
        "material_code": "MAT-FIXED-01",
        "name": "Fixed Lot Item",
        "unit": "EA",
        "lot_size": "FIXED",
        "fixed_lot_size": None
    })
    assert res.status_code == 422

    # FIXED lot size with fixed_lot_size > 0 succeeds
    res_valid = client.post("/api/v1/materials", json={
        "material_code": "MAT-FIXED-02",
        "name": "Fixed Lot Item Valid",
        "unit": "EA",
        "lot_size": "FIXED",
        "fixed_lot_size": "25.0000"
    })
    assert res_valid.status_code == 201
    assert float(res_valid.json()["fixed_lot_size"]) == 25.0


def test_search_and_pagination(client: TestClient):
    # Seed 5 items
    for i in range(1, 6):
        client.post("/api/v1/materials", json={
            "material_code": f"MAT-PAG-{i:02d}",
            "name": f"Pagination Material {i}",
            "unit": "EA",
            "unit_cost": str(i * 10),
        })

    # Page 1 with page_size 2
    res_p1 = client.get("/api/v1/materials?page=1&page_size=2&search=PAG")
    assert res_p1.status_code == 200
    data_p1 = res_p1.json()
    assert len(data_p1["items"]) == 2
    assert data_p1["total"] == 5
    assert data_p1["page"] == 1
    assert data_p1["pages"] == 3

    # Search filter
    res_search = client.get("/api/v1/materials?search=MAT-PAG-03")
    assert res_search.status_code == 200
    data_search = res_search.json()
    assert data_search["total"] == 1
    assert data_search["items"][0]["material_code"] == "MAT-PAG-03"


def test_delete_and_deactivate(client: TestClient):
    payload = {
        "material_code": "MAT-DEL-01",
        "name": "Deactivate Material",
        "unit": "EA",
        "unit_cost": "10.0000"
    }
    create_res = client.post("/api/v1/materials", json=payload)
    mat_id = create_res.json()["id"]

    # Soft delete (default)
    del_res = client.delete(f"/api/v1/materials/{mat_id}")
    assert del_res.status_code == 204

    # Verify material is now inactive
    get_res = client.get(f"/api/v1/materials/{mat_id}")
    assert get_res.status_code == 200
    assert get_res.json()["is_active"] is False

    # Hard delete
    hard_del_res = client.delete(f"/api/v1/materials/{mat_id}?hard_delete=true")
    assert hard_del_res.status_code == 204

    # Now verify 404
    get_after = client.get(f"/api/v1/materials/{mat_id}")
    assert get_after.status_code == 404

