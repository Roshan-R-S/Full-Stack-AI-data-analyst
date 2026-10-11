import pytest

from app.analytics.csv_loader import load_csv


def test_valid_csv():
    df = load_csv(b"Name,Revenue\nAlpha,100\nBeta,200\n")

    assert df.shape == (2, 2)
    assert df["Revenue"].sum() == 300


def test_empty_csv():
    with pytest.raises(ValueError):
        load_csv(b"")


def test_header_without_rows():
    with pytest.raises(ValueError):
        load_csv(b"Name,Revenue\n")


def test_invalid_binary():
    with pytest.raises(ValueError):
        load_csv(b"Name,Revenue\x00\nAlpha,100\n")