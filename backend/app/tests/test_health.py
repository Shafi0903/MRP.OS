from fastapi.testclient import TestClient


def test_health_check(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app" in data
    assert data["version"] == "1.0.0"


def test_docs_available(client: TestClient):
    response = client.get("/docs")
    assert response.status_code == 200

