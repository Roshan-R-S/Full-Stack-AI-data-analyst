from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import chat as chat_api
from app.db.session import Base, get_db
from app.main import app
from app.models.dataset import Dataset
from app.schemas.analysis import AnalysisRequest

DATASET_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def client(monkeypatch):
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(
        bind=engine, expire_on_commit=False
    )

    with session_factory() as session:
        session.add(Dataset(
            id=DATASET_ID,
            filename="test.csv",
            row_count=2,
            column_count=1,
        ))
        session.commit()

    def override_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db

    monkeypatch.setattr(
        chat_api, "read_stored_dataset", lambda _id: object()
    )
    monkeypatch.setattr(
        chat_api, "get_gemini_client", lambda: object()
    )
    monkeypatch.setattr(
        chat_api, "get_model_name", lambda: "test-model"
    )
    monkeypatch.setattr(
        chat_api, "plan_question", lambda *args: object()
    )

    monkeypatch.setattr(
        chat_api,
        "compile_ai_plan",
        lambda *args: AnalysisRequest(
            dataset_id=UUID(DATASET_ID),
            group_by=[],
            metrics=[{
                "column": "value",
                "aggregation": "mean",
                "alias": "result",
            }],
        ),
    )

    monkeypatch.setattr(
        chat_api,
        "execute_analysis",
        lambda *args: {
            "dataset_id": DATASET_ID,
            "source_rows": 2,
            "matched_rows": 2,
            "result_count": 1,
            "returned_rows": 1,
            "truncated": False,
            "columns": ["result"],
            "rows": [{"result": 10.0}],
        },
    )

    monkeypatch.setattr(
        chat_api,
        "explain_results",
        lambda *args: "Verified mean is 10.",
    )

    test_client = TestClient(app)

    yield test_client

    test_client.close()
    app.dependency_overrides.clear()
    engine.dispose()


def test_persistent_conversation_lifecycle(client):
    first = client.post(
        "/api/v1/chat/ask",
        json={
            "dataset_id": DATASET_ID,
            "question": "What is the average value?",
        },
    )

    assert first.status_code == 200, first.text
    conversation_id = first.json()["conversation_id"]

    second = client.post(
        "/api/v1/chat/ask",
        json={
            "dataset_id": DATASET_ID,
            "conversation_id": conversation_id,
            "question": "What is the overall average?",
        },
    )

    assert second.status_code == 200, second.text
    assert second.json()["conversation_id"] == conversation_id

    history = client.get(
        f"/api/v1/conversations/{conversation_id}"
    )
    assert history.status_code == 200
    assert len(history.json()["messages"]) == 4
    assert history.json()["messages"][1]["analysis"]["rows"] == [
        {"result": 10.0}
    ]

    listing = client.get(
        "/api/v1/conversations",
        params={"dataset_id": DATASET_ID},
    )
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    rename = client.patch(
        f"/api/v1/conversations/{conversation_id}",
        json={"title": "My analytical session"},
    )
    assert rename.status_code == 200
    assert rename.json()["title"] == "My analytical session"

    deleted = client.delete(
        f"/api/v1/conversations/{conversation_id}"
    )
    assert deleted.status_code == 204

    missing = client.get(
        f"/api/v1/conversations/{conversation_id}"
    )
    assert missing.status_code == 404


def test_unknown_conversation_is_rejected(client):
    response = client.post(
        "/api/v1/chat/ask",
        json={
            "dataset_id": DATASET_ID,
            "conversation_id":
                "00000000-0000-0000-0000-000000000099",
            "question": "What is the average value?",
        },
    )
    assert response.status_code == 404