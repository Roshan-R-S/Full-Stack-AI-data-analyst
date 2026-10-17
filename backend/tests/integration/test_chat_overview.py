import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.ai.planner import AIMetric, AIPlan
from app.api.v1 import chat as chat_api
from app.api.v1 import conversations as conversations_api
from app.api.v1 import datasets as dataset_api
from app.db.session import Base, get_db
from app.models.dataset import Dataset
from app.models.message import Message
from app.models.saved_analysis import SavedAnalysis  # noqa: F401
from app.services.csv_cache import clear_csv_cache
from app.services.dataset_overview import is_overview_question

DATASET_ID = "00000000-0000-0000-0000-000000000801"
CSV = b"Card_Type,Annual_Income\nBasic,100\nGold,200\n"


@pytest.fixture
def api(tmp_path, monkeypatch):
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

    monkeypatch.setattr(dataset_api, "UPLOAD_DIR", tmp_path)
    (tmp_path / f"{DATASET_ID}.csv").write_bytes(CSV)

    with factory() as db:
        db.add(Dataset(
            id=DATASET_ID,
            filename="cards.csv",
            row_count=2,
            column_count=2,
        ))
        db.commit()

    app = FastAPI()
    app.include_router(chat_api.router, prefix="/api/v1")
    app.include_router(
        conversations_api.router,
        prefix="/api/v1",
    )

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    clear_csv_cache()

    try:
        with TestClient(app) as client:
            yield client, factory
    finally:
        clear_csv_cache()
        engine.dispose()


def ask(client, question, conversation_id=None):
    payload = {
        "dataset_id": DATASET_ID,
        "question": question,
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    return client.post("/api/v1/chat/ask", json=payload)


def test_overview_question_detection():
    assert is_overview_question("What is this data about?")
    assert is_overview_question("WHAT IS THIS DATA ABOUT!!!")
    assert not is_overview_question(
        "What is the average Annual_Income by Card_Type?"
    )


def test_overview_works_without_gemini_and_is_saved(
    api, monkeypatch
):
    client, factory = api

    def reject_gemini():
        raise AssertionError(
            "Overview must not require Gemini."
        )

    monkeypatch.setattr(
        chat_api, "get_gemini_client", reject_gemini
    )

    response = ask(client, "What is this data about?")

    assert response.status_code == 200, response.text
    result = response.json()

    assert result["model"] == "local-profile"
    assert result["plan"] is None
    assert result["analysis"] is None
    assert "**Records:** 2" in result["answer"]
    assert "Card_Type" in result["answer"]

    history = client.get(
        f"/api/v1/conversations/{result['conversation_id']}"
    )
    assert history.status_code == 200

    messages = history.json()["messages"]
    assert len(messages) == 2
    assert messages[1]["content"] == result["answer"]
    assert messages[1]["plan"] is None
    assert messages[1]["analysis"] is None

    with factory() as db:
        saved = db.scalars(select(Message)).all()
        assert len(saved) == 2


def test_multiple_overviews_use_existing_conversation(api):
    client, _ = api

    first = ask(client, "What is this data about?")
    assert first.status_code == 200

    conversation_id = first.json()["conversation_id"]

    second = ask(
        client,
        "Describe this dataset",
        conversation_id,
    )
    assert second.status_code == 200
    assert second.json()["conversation_id"] == conversation_id

    history = client.get(
        f"/api/v1/conversations/{conversation_id}"
    )
    assert len(history.json()["messages"]) == 4


def test_quantitative_analysis_still_works(api, monkeypatch):
    client, _ = api

    monkeypatch.setattr(
        chat_api, "get_gemini_client", lambda: object()
    )

    def fake_plan(_client, _model, _question, _df):
        return AIPlan(
            supported=True,
            reason="",
            group_by=["Card_Type"],
            metrics=[
                AIMetric(
                    column="Annual_Income",
                    aggregation="mean",
                )
            ],
            filters=[],
            sort_direction="desc",
            limit=20,
        )

    monkeypatch.setattr(
        chat_api, "plan_question", fake_plan
    )
    monkeypatch.setattr(
        chat_api,
        "explain_results",
        lambda *_args: "Verified analysis complete.",
    )

    response = ask(
        client,
        "What is the average Annual_Income by Card_Type?",
    )

    assert response.status_code == 200, response.text
    result = response.json()

    assert result["plan"] is not None
    assert result["analysis"] is not None
    assert result["analysis"]["source_rows"] == 2
    assert result["answer"] == "Verified analysis complete."
