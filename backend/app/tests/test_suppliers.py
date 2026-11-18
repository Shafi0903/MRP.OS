import uuid
from fastapi.testclient import TestClient


def test_create_valid_supplier(client: TestClient):
    payload = {
        "supplier_code": "sup-acme-01",
        "name": "Acme Metal Works",
        "contact_person": "John Doe",
        "email": "contact@acme.com",
        "phone": "+1-555-0199",
        "city": "Detroit",
        "payment_terms_days": 30,
    }
    response = client.post("/api/v1/suppliers", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["supplier_code"] == "SUP-ACME-01"
    assert data["name"] == "Acme Metal Works"
    assert data["payment_terms_days"] == 30
    assert data["is_active"] is True
    assert "id" in data


def test_reject_duplicate_supplier_code(client: TestClient):
    payload = {
        "supplier_code": "SUP-DUP-01",
        "name": "First Supplier",
    }
    res1 = client.post("/api/v1/suppliers", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/suppliers", json={"supplier_code": "sup-dup-01", "name": "Second Supplier"})
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "DUPLICATE_CODE"


def test_reject_invalid_supplier_email(client: TestClient):
    res = client.post("/api/v1/suppliers", json={
        "supplier_code": "SUP-BAD-EMAIL",
        "name": "Bad Email Supplier",
        "email": "not-an-email-at-all"
    })
    assert res.status_code == 422


def test_list_and_deactivate_supplier(client: TestClient):
    payload = {
        "supplier_code": "SUP-DEACT-01",
        "name": "Deactivate Supplier",
    }
    create_res = client.post("/api/v1/suppliers", json=payload)
    sup_id = create_res.json()["id"]

    # Deactivate
    del_res = client.delete(f"/api/v1/suppliers/{sup_id}")
    assert del_res.status_code == 204

    # Verify inactive
    get_res = client.get(f"/api/v1/suppliers/{sup_id}")
    assert get_res.status_code == 200
    assert get_res.json()["is_active"] is False

