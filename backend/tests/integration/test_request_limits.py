import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core import request_limits
from app.core.request_limits import (
    LocalRequestGuard,
    SlidingWindowLimiter,
    request_bucket,
)


@pytest.fixture
def client():
    test_app = FastAPI()

    limiter = SlidingWindowLimiter({
        "gemini": 2,
        "analysis": 2,
        "export": 2,
        "saved-run": 2,
        "upload": 2,
    })

    test_app.add_middleware(
        LocalRequestGuard,
        limiter=limiter,
    )

    @test_app.post("/api/v1/analysis")
    async def analysis(request: Request):
        return {"size": len(await request.body())}

    @test_app.post("/api/v1/datasets")
    async def upload(request: Request):
        return {"size": len(await request.body())}

    @test_app.post("/api/v1/chat/ask")
    async def ask(request: Request):
        return {"size": len(await request.body())}

    @test_app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    with TestClient(test_app) as test_client:
        yield test_client


def test_rate_limit_returns_429(client):
    first = client.post("/api/v1/analysis", json={})
    second = client.post("/api/v1/analysis", json={})
    third = client.post("/api/v1/analysis", json={})

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
    assert int(third.headers["retry-after"]) >= 1


def test_gemini_has_separate_limit(client):
    for _ in range(2):
        response = client.post(
            "/api/v1/chat/ask",
            json={"question": "Example"},
        )
        assert response.status_code == 200

    blocked = client.post(
        "/api/v1/chat/ask",
        json={"question": "Example"},
    )

    assert blocked.status_code == 429


def test_large_json_request_rejected(client, monkeypatch):
    monkeypatch.setattr(
        request_limits, "JSON_BODY_LIMIT", 32
    )

    response = client.post(
        "/api/v1/analysis",
        content=b"x" * 33,
    )

    assert response.status_code == 413


def test_large_upload_rejected(client, monkeypatch):
    monkeypatch.setattr(
        request_limits, "UPLOAD_BODY_LIMIT", 32
    )

    response = client.post(
        "/api/v1/datasets",
        content=b"x" * 33,
    )

    assert response.status_code == 413


def test_chunked_oversized_body_rejected(
    client, monkeypatch
):
    monkeypatch.setattr(
        request_limits, "JSON_BODY_LIMIT", 32
    )

    def chunks():
        yield b"a" * 20
        yield b"b" * 20

    response = client.post(
        "/api/v1/analysis",
        content=chunks(),
    )

    assert response.status_code == 413


def test_normal_request_preserves_body(client):
    response = client.post(
        "/api/v1/analysis",
        content=b"123456",
    )

    assert response.status_code == 200
    assert response.json()["size"] == 6


def test_health_is_not_rate_limited(client):
    for _ in range(5):
        response = client.get("/api/v1/health")
        assert response.status_code == 200


def test_rate_window_expires():
    current = [100.0]

    limiter = SlidingWindowLimiter(
        {"gemini": 2},
        window_seconds=60,
        clock=lambda: current[0],
    )

    assert limiter.check("gemini") is None
    assert limiter.check("gemini") is None
    assert limiter.check("gemini") == 60

    current[0] = 160.0

    assert limiter.check("gemini") is None


def test_expensive_routes_are_classified():
    assert request_bucket(
        "POST", "/api/v1/chat/ask"
    ) == "gemini"

    assert request_bucket(
        "POST", "/api/v1/exports/analysis/pdf"
    ) == "export"

    assert request_bucket(
        "POST", "/api/v1/saved-analyses/abc/run"
    ) == "saved-run"

    assert request_bucket(
        "GET", "/api/v1/datasets"
    ) is None