
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import saved_analyses as saved_api
from app.db.session import Base, get_db
from app.main import app
from app.models.dataset import Dataset

DATASET_ID = "00000000-0000-0000-0000-000000000201"
OTHER_ID = "00000000-0000-0000-0000-000000000202"


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
        session.add(Dataset(
            id=OTHER_ID,
            filename="other.csv",
            row_count=3,
            column_count=2,
        ))
        session.commit()

    def override_db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db

    monkeypatch.setattr(
        saved_api,
        "read_stored_dataset",
        lambda _id: pd.DataFrame({
            "Segment": ["A", "B", "A"],
            "Revenue": [100, 50, 200],
        }),
    )

    test_client = TestClient(app)
    yield test_client

    test_client.close()
    app.dependency_overrides.clear()
    engine.dispose()


def make_plan(dataset_id=DATASET_ID):
    return {
        "dataset_id": dataset_id,
        "group_by": ["Segment"],
        "metrics": [{
            "column": "Revenue",
            "aggregation": "sum",
            "alias": "total_revenue",
        }],
        "sort": {
            "column": "total_revenue",
            "direction": "desc",
        },
        "limit": 20,
    }


def test_saved_analysis_lifecycle(client):
    created = client.post(
        "/api/v1/saved-analyses",
        json={
            "name": "Revenue by Segment",
            "plan": make_plan(),
        },
    )
    assert created.status_code == 201, created.text

    saved_id = created.json()["id"]

    listing = client.get(
        "/api/v1/saved-analyses",
        params={"dataset_id": DATASET_ID},
    )
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    detail = client.get(
        f"/api/v1/saved-analyses/{saved_id}"
    )
    assert detail.status_code == 200
    assert detail.json()["plan"] == make_plan() | {
        "filters": []
    }

    result = client.post(
        f"/api/v1/saved-analyses/{saved_id}/run"
    )
    assert result.status_code == 200, result.text
    assert result.json()["analysis"]["rows"][0] == {
        "Segment": "A",
        "total_revenue": 300,
    }

    renamed = client.patch(
        f"/api/v1/saved-analyses/{saved_id}",
        json={"name": "Segment Overview"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Segment Overview"

    removed = client.delete(
        f"/api/v1/saved-analyses/{saved_id}"
    )
    assert removed.status_code == 204

    missing = client.get(
        f"/api/v1/saved-analyses/{saved_id}"
    )
    assert missing.status_code == 404


def test_update_plan_and_dataset_binding(client):
    created = client.post(
        "/api/v1/saved-analyses",
        json={"name": "Initial", "plan": make_plan()},
    )
    saved_id = created.json()["id"]

    updated_plan = make_plan()
    updated_plan["metrics"][0]["aggregation"] = "mean"
    updated_plan["metrics"][0]["alias"] = "average_revenue"
    updated_plan["sort"]["column"] = "average_revenue"

    changed = client.put(
        f"/api/v1/saved-analyses/{saved_id}/plan",
        json=updated_plan,
    )
    assert changed.status_code == 200
    assert changed.json()["plan"]["metrics"][0][
        "aggregation"
    ] == "mean"

    wrong_plan = make_plan(OTHER_ID)

    rejected = client.put(
        f"/api/v1/saved-analyses/{saved_id}/plan",
        json=wrong_plan,
    )
    assert rejected.status_code == 422


def test_invalid_plan_is_rejected(client):
    plan = make_plan()
    plan["metrics"][0]["column"] = "Unknown"

    response = client.post(
        "/api/v1/saved-analyses",
        json={"name": "Invalid", "plan": plan},
    )

    assert response.status_code == 422

    missing_dataset = client.post(
        "/api/v1/saved-analyses",
        json={
            "name": "Missing dataset",
            "plan": make_plan(
                "00000000-0000-0000-0000-000000000299"
            ),
        },
    )

    assert missing_dataset.status_code == 404


def test_saved_analysis_removed_with_dataset(client):
    created = client.post(
        "/api/v1/saved-analyses",
        json={"name": "Temporary", "plan": make_plan()},
    )
    saved_id = created.json()["id"]

    deleted = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )
    assert deleted.status_code == 204

    lookup = client.get(
        f"/api/v1/saved-analyses/{saved_id}"
    )
    assert lookup.status_code == 404