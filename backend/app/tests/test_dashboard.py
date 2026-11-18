from fastapi.testclient import TestClient


def test_dashboard_summary_endpoint(client: TestClient):
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_materials" in data
    assert "total_products" in data
    assert "total_suppliers" in data
    assert "stock_status_distribution" in data
    assert "value_trend" in data
    assert isinstance(data["stock_status_distribution"], list)
    assert isinstance(data["value_trend"], list)

