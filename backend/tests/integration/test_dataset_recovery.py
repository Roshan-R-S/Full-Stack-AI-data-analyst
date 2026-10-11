from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import datasets as dataset_api
from app.db.session import Base, get_db
from app.models.conversation import Conversation
from app.models.dataset import Dataset
from app.models.message import Message
from app.models.saved_analysis import SavedAnalysis

DATASET_ID = "00000000-0000-0000-0000-000000000701"
CONVERSATION_ID = "00000000-0000-0000-0000-000000000702"
SAVED_ID = "00000000-0000-0000-0000-000000000703"

CSV_DATA = b"item,value\nAlpha,10\nBeta,20\n"


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

    monkeypatch.setattr(
        dataset_api, "UPLOAD_DIR", tmp_path
    )

    test_app = FastAPI()
    test_app.include_router(
        dataset_api.router,
        prefix="/api/v1",
    )

    def override_db():
        with factory() as session:
            yield session

    test_app.dependency_overrides[get_db] = override_db

    with TestClient(test_app) as client:
        yield client, factory, engine, tmp_path

    test_app.dependency_overrides.clear()
    engine.dispose()


def seed_dataset(factory, directory, with_related=False):
    with factory() as db:
        db.add(Dataset(
            id=DATASET_ID,
            filename="sample.csv",
            row_count=2,
            column_count=2,
        ))

        if with_related:
            db.add(Conversation(
                id=CONVERSATION_ID,
                dataset_id=DATASET_ID,
                title="Example conversation",
            ))

            db.add(SavedAnalysis(
                id=SAVED_ID,
                dataset_id=DATASET_ID,
                name="Example analysis",
                plan_json="{}",
            ))

            db.flush()

            db.add(Message(
                conversation_id=CONVERSATION_ID,
                role="user",
                content="Example question",
            ))

        db.commit()

    path = directory / f"{DATASET_ID}.csv"
    path.write_bytes(CSV_DATA)
    return path


def test_upload_success_persists_file_and_metadata(api):
    client, factory, _, directory = api

    response = client.post(
        "/api/v1/datasets",
        files={"file": ("sample.csv", CSV_DATA, "text/csv")},
    )

    assert response.status_code == 201, response.text
    dataset_id = response.json()["id"]

    assert (
        directory / f"{dataset_id}.csv"
    ).read_bytes() == CSV_DATA

    with factory() as db:
        assert db.get(Dataset, dataset_id) is not None


def test_invalid_upload_does_not_create_records(api):
    client, factory, _, directory = api

    response = client.post(
        "/api/v1/datasets",
        files={
            "file": (
                "sample.csv",
                b"item,value\x00bad",
                "text/csv",
            )
        },
    )

    assert response.status_code == 422
    assert list(directory.iterdir()) == []

    with factory() as db:
        assert db.scalars(select(Dataset)).all() == []


def test_partial_disk_write_failure_is_cleaned(
    api, monkeypatch
):
    client, factory, _, directory = api

    original = Path.write_bytes

    def fail_after_partial_write(path, content):
        original(path, content[:4])
        raise OSError("simulated disk failure")

    monkeypatch.setattr(
        Path, "write_bytes", fail_after_partial_write
    )

    response = client.post(
        "/api/v1/datasets",
        files={"file": ("sample.csv", CSV_DATA, "text/csv")},
    )

    assert response.status_code == 503
    assert "simulated" not in response.text
    assert list(directory.iterdir()) == []

    with factory() as db:
        assert db.scalars(select(Dataset)).all() == []


def test_upload_database_failure_removes_csv(api):
    client, factory, engine, directory = api

    def reject_insert(
        _conn, _cursor, statement,
        _params, _context, _many
    ):
        if "INSERT INTO datasets" in statement:
            raise RuntimeError("simulated database failure")

    event.listen(
        engine, "before_cursor_execute", reject_insert
    )

    response = client.post(
        "/api/v1/datasets",
        files={"file": ("sample.csv", CSV_DATA, "text/csv")},
    )

    assert response.status_code == 503
    assert list(directory.iterdir()) == []

    with factory() as db:
        assert db.scalars(select(Dataset)).all() == []


def test_delete_removes_file_and_dependent_records(api):
    client, factory, _, directory = api

    path = seed_dataset(
        factory, directory, with_related=True
    )

    response = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )

    assert response.status_code == 204
    assert not path.exists()
    assert not list(directory.glob("*.deleting"))

    with factory() as db:
        assert db.get(Dataset, DATASET_ID) is None
        assert db.get(Conversation, CONVERSATION_ID) is None
        assert db.get(SavedAnalysis, SAVED_ID) is None
        assert db.scalars(select(Message)).all() == []


def test_delete_staging_failure_preserves_dataset(
    api, monkeypatch
):
    client, factory, _, directory = api
    path = seed_dataset(factory, directory)

    original_replace = Path.replace

    def reject_staging(source, target):
        if source == path:
            raise OSError("simulated rename failure")
        return original_replace(source, target)

    monkeypatch.setattr(
        Path, "replace", reject_staging
    )

    response = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )

    assert response.status_code == 503
    assert path.read_bytes() == CSV_DATA

    with factory() as db:
        assert db.get(Dataset, DATASET_ID) is not None


def test_delete_database_failure_restores_csv(api):
    client, factory, engine, directory = api
    path = seed_dataset(
        factory, directory, with_related=True
    )

    def reject_delete(
        _conn, _cursor, statement,
        _params, _context, _many
    ):
        if "DELETE FROM datasets" in statement:
            raise RuntimeError("simulated database failure")

    event.listen(
        engine, "before_cursor_execute", reject_delete
    )

    response = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )

    assert response.status_code == 503
    assert path.read_bytes() == CSV_DATA
    assert not list(directory.glob("*.deleting"))

    with factory() as db:
        assert db.get(Dataset, DATASET_ID) is not None
        assert db.get(Conversation, CONVERSATION_ID) is not None
        assert db.get(SavedAnalysis, SAVED_ID) is not None


def test_failed_final_cleanup_does_not_restore_metadata(
    api, monkeypatch
):
    client, factory, _, directory = api
    path = seed_dataset(factory, directory)

    original_unlink = Path.unlink

    def reject_staged_cleanup(self, *args, **kwargs):
        if self.name.endswith(".deleting"):
            raise OSError("simulated cleanup failure")
        return original_unlink(self, *args, **kwargs)

    monkeypatch.setattr(
        Path, "unlink", reject_staged_cleanup
    )

    response = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )

    assert response.status_code == 204
    assert not path.exists()

    staged_files = list(directory.glob("*.deleting"))
    assert len(staged_files) == 1

    with factory() as db:
        assert db.get(Dataset, DATASET_ID) is None


def test_disk_read_failure_returns_safe_error(
    api, monkeypatch
):
    client, _, _, directory = api
    path = directory / f"{DATASET_ID}.csv"

    # This test exercises file-reading error handling.
    # The metadata must exist for the preview endpoint.
    _, factory, _, _ = api
    seed_dataset(factory, directory)

    original_read = Path.read_bytes

    def reject_read(self):
        if self == path:
            raise OSError("simulated read failure")
        return original_read(self)

    monkeypatch.setattr(
        Path, "read_bytes", reject_read
    )

    response = client.get(
        f"/api/v1/datasets/{DATASET_ID}/preview"
    )

    assert response.status_code == 503
    assert "simulated" not in response.text


def test_delete_missing_file_cleans_stale_metadata(api):
    client, factory, _, directory = api
    path = seed_dataset(factory, directory)
    path.unlink()

    response = client.delete(
        f"/api/v1/datasets/{DATASET_ID}"
    )

    assert response.status_code == 204

    with factory() as db:
        assert db.get(Dataset, DATASET_ID) is None