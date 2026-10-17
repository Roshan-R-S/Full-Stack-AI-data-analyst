import os

import pytest

from app.services import csv_cache

CSV_A = b"name,value\nAlpha,10\n"
CSV_B = b"name,value\nBravo,20\n"


@pytest.fixture(autouse=True)
def empty_cache():
    csv_cache.clear_csv_cache()
    yield
    csv_cache.clear_csv_cache()


def test_repeated_read_parses_once(tmp_path, monkeypatch):
    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    original = csv_cache.load_csv
    calls = []

    def counted(content):
        calls.append(content)
        return original(content)

    monkeypatch.setattr(csv_cache, "load_csv", counted)

    first = csv_cache.load_cached_csv(path)
    second = csv_cache.load_cached_csv(path)

    assert len(calls) == 1
    assert first.equals(second)


def test_cached_dataframe_is_isolated(tmp_path):
    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    first = csv_cache.load_cached_csv(path)
    first.loc[0, "value"] = 999

    second = csv_cache.load_cached_csv(path)

    assert second.loc[0, "value"] == 10


def test_changed_file_is_reloaded(tmp_path):
    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    first = csv_cache.load_cached_csv(path)
    previous = path.stat().st_mtime_ns

    path.write_bytes(CSV_B)

    new_time = previous + 1_000_000_000
    os.utime(path, ns=(new_time, new_time))

    second = csv_cache.load_cached_csv(path)

    assert first.loc[0, "value"] == 10
    assert second.loc[0, "value"] == 20


def test_deleted_file_is_not_returned_from_cache(tmp_path):
    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    csv_cache.load_cached_csv(path)
    path.unlink()

    with pytest.raises(FileNotFoundError):
        csv_cache.load_cached_csv(path)


def test_explicit_invalidation(tmp_path, monkeypatch):
    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    original = csv_cache.load_csv
    calls = []

    def counted(content):
        calls.append(content)
        return original(content)

    monkeypatch.setattr(csv_cache, "load_csv", counted)

    csv_cache.load_cached_csv(path)
    csv_cache.invalidate_cached_csv(path)
    csv_cache.load_cached_csv(path)

    assert len(calls) == 2


def test_cache_item_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(
        csv_cache, "MAX_CACHED_ITEMS", 1
    )

    first = tmp_path / "one.csv"
    second = tmp_path / "two.csv"

    first.write_bytes(CSV_A)
    second.write_bytes(CSV_B)

    original = csv_cache.load_csv
    calls = []

    def counted(content):
        calls.append(content)
        return original(content)

    monkeypatch.setattr(csv_cache, "load_csv", counted)

    csv_cache.load_cached_csv(first)
    csv_cache.load_cached_csv(second)
    csv_cache.load_cached_csv(first)

    assert len(calls) == 3


def test_memory_budget_disables_large_entries(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(
        csv_cache, "MAX_CACHE_BYTES", 1
    )

    path = tmp_path / "data.csv"
    path.write_bytes(CSV_A)

    original = csv_cache.load_csv
    calls = []

    def counted(content):
        calls.append(content)
        return original(content)

    monkeypatch.setattr(csv_cache, "load_csv", counted)

    csv_cache.load_cached_csv(path)
    csv_cache.load_cached_csv(path)

    assert len(calls) == 2
