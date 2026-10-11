import csv
import io
from uuid import uuid4

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import exports as export_api
from app.db.session import Base, get_db
from app.main import app
from app.models.dataset import Dataset

DATASET_ID = "00000000-0000-0000-0000-000000000301"


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    factory = sessionmaker(
        bind=engine, expire_on_commit=False
    )

    with factory() as session:
        session.add(Dataset(
            id=DATASET_ID,
            filename="sample.csv",
            row_count=3,
            column_count=2,
        ))
        session.commit()

    def override_db():
        with factory() as session:
            yield session

    monkeypatch.setattr(
        export_api,
        "read_stored_dataset",
        lambda _id: pd.DataFrame({
            "Region": ["East", "West", "=2+3"],
            "Revenue": [100, -20, 30],
        }),
    )

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    engine.dispose()


def plan(dataset_id=DATASET_ID, limit=50):
    return {
        "dataset_id": dataset_id,
        "group_by": ["Region"],
        "filters": [],
        "metrics": [{
            "column": "Revenue",
            "aggregation": "sum",
            "alias": "total_revenue",
        }],
        "sort": {
            "column": "total_revenue",
            "direction": "desc",
        },
        "limit": limit,
    }


def read_csv_response(response):
    content = response.content.decode("utf-8-sig")
    return list(csv.reader(io.StringIO(content)))


def test_export_returns_verified_csv(client):
    response = client.post(
        "/api/v1/exports/analysis/csv",
        json=plan(),
    )

    assert response.status_code == 200, response.text
    assert "text/csv" in response.headers["content-type"]
    assert "attachment" in response.headers[
        "content-disposition"
    ]

    rows = read_csv_response(response)
    assert rows[0] == ["Region", "total_revenue"]
    assert rows[1] == ["East", "100"]
    assert rows[2] == ["'=2+3", "30"]
    assert rows[3] == ["West", "-20"]


def test_export_respects_limit(client):
    response = client.post(
        "/api/v1/exports/analysis/csv",
        json=plan(limit=1),
    )

    assert response.status_code == 200
    assert len(read_csv_response(response)) == 2
    assert response.headers["x-export-truncated"] == "true"


def test_export_rejects_invalid_column(client):
    invalid = plan()
    invalid["metrics"][0]["column"] = "Nonexistent"

    response = client.post(
        "/api/v1/exports/analysis/csv",
        json=invalid,
    )

    assert response.status_code == 422


def test_export_rejects_missing_dataset(client):
    response = client.post(
        "/api/v1/exports/analysis/csv",
        json=plan(dataset_id=str(uuid4())),
    )

    assert response.status_code == 404