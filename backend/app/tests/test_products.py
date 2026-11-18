import uuid
from fastapi.testclient import TestClient


def test_create_valid_product(client: TestClient):
    payload = {
        "product_code": "prd-desk-pro",
        "name": "Standing Desk Pro",
        "description": "Premium motor desk",
        "product_type": "FINISHED",
        "unit_of_measure": "EA",
        "lead_time_days": 12,
    }
    response = client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["product_code"] == "PRD-DESK-PRO"
    assert data["name"] == "Standing Desk Pro"
    assert data["product_type"] == "FINISHED"
    assert data["lead_time_days"] == 12
    assert data["is_active"] is True
    assert "id" in data


def test_reject_duplicate_product_code(client: TestClient):
    payload = {
        "product_code": "PRD-DUP-01",
        "name": "First Product",
        "product_type": "FINISHED",
    }
    res1 = client.post("/api/v1/products", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/products", json={"product_code": "prd-dup-01", "name": "Second Product"})
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "DUPLICATE_CODE"


def test_reject_invalid_product_type(client: TestClient):
    res = client.post("/api/v1/products", json={
        "product_code": "PRD-INVALID",
        "name": "Invalid Type Product",
        "product_type": "UNKNOWN_TYPE"
    })
    assert res.status_code == 422


def test_patch_product_fields(client: TestClient):
    payload = {
        "product_code": "PRD-PATCH-01",
        "name": "Original Product",
        "product_type": "SEMI_FINISHED",
        "lead_time_days": 5,
    }
    create_res = client.post("/api/v1/products", json=payload)
    prod_id = create_res.json()["id"]

    patch_res = client.patch(f"/api/v1/products/{prod_id}", json={"name": "Modified Product Name", "lead_time_days": 8})
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["name"] == "Modified Product Name"
    assert data["lead_time_days"] == 8
    assert data["product_code"] == "PRD-PATCH-01"

