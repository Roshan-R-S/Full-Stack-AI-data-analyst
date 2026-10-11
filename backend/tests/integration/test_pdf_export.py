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


DATASET_ID = "00000000-0000-0000-0000-000000000401"


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    factory = sessionmaker(
        bind=engine,
        expire_on_commit=False,
    )

    with factory() as session:
        session.add(Dataset(
            id=DATASET_ID,
            filename="report-sample.csv",
            row_count=100,
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
            "Region": [f"Group {i}" for i in range(100)],
            "Revenue": [i * 10 for i in range(100)],
        }),
    )

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    engine.dispose()


def make_plan(dataset_id=DATASET_ID, limit=100):
    return {
        "dataset_id": dataset_id,
        "group_by": ["Region"],
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


def test_pdf_export(client):
    response = client.post(
        "/api/v1/exports/analysis/pdf",
        json=make_plan(),
    )

    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment" in response.headers["content-disposition"]
    assert response.content.startswith(b"%PDF-")
    assert b"%%EOF" in response.content[-100:]
    assert len(response.content) > 2000


def test_pdf_result_limit(client):
    response = client.post(
        "/api/v1/exports/analysis/pdf",
        json=make_plan(limit=5),
    )

    assert response.status_code == 200
    assert response.headers["x-export-truncated"] == "true"


def test_pdf_invalid_plan(client):
    plan = make_plan()
    plan["metrics"][0]["column"] = "MissingColumn"

    response = client.post(
        "/api/v1/exports/analysis/pdf",
        json=plan,
    )

    assert response.status_code == 422


def test_pdf_missing_dataset(client):
    response = client.post(
        "/api/v1/exports/analysis/pdf",
        json=make_plan(str(uuid4())),
    )

    assert response.status_code == 404