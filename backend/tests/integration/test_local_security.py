import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(
        app, base_url="http://localhost"
    ) as test_client:
        yield test_client


def test_health_has_security_headers(client):
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store"


def test_existing_testclient_host_still_works():
    with TestClient(app) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200


def test_untrusted_host_is_rejected(client):
    response = client.get(
        "/api/v1/health",
        headers={"Host": "malicious.example"},
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    "origin",
    ["https://malicious.example", "null"],
)
def test_untrusted_browser_origin_is_rejected(
    client, origin
):
    response = client.post(
        "/api/v1/analysis",
        json={},
        headers={"Origin": origin},
    )

    assert response.status_code == 403


def test_local_frontend_origin_is_allowed(client):
    response = client.post(
        "/api/v1/analysis",
        json={},
        headers={"Origin": "http://localhost:5173"},
    )

    # The security check allows the request.
    # Pydantic then rejects the deliberately empty plan.
    assert response.status_code == 422


def test_local_cli_without_origin_is_allowed(client):
    response = client.post(
        "/api/v1/analysis",
        json={},
    )

    assert response.status_code == 422


def test_cross_site_fetch_metadata_is_rejected(client):
    response = client.post(
        "/api/v1/analysis",
        json={},
        headers={"Sec-Fetch-Site": "cross-site"},
    )

    assert response.status_code == 403