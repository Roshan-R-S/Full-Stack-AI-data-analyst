import io
import zipfile

import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1 import exports as export_api
from app.db.session import Base, get_db
from app.models.dataset import Dataset
from app.models.message import Message  # noqa: F401
from app.models.saved_analysis import SavedAnalysis  # noqa: F401

DATASET_ID = "00000000-0000-0000-0000-000000000901"


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

    with factory() as db:
        db.add(Dataset(
            id=DATASET_ID,
            filename="chart-test.csv",
            row_count=15,
            column_count=2,
        ))
        db.commit()

    dataframe = pd.DataFrame({
        "Category": ["=2+3"] + [
            f"Group {i}" for i in range(1, 15)
        ],
        "Amount": list(range(1, 16)),
    })

    monkeypatch.setattr(
        export_api,
        "read_stored_dataset",
        lambda _id: dataframe.copy(),
    )

    app = FastAPI()
    app.include_router(export_api.router, prefix="/api/v1")

    def override_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def payload(chart_type="bar", aggregation="sum"):
    return {
        "plan": {
            "dataset_id": DATASET_ID,
            "group_by": ["Category"],
            "metrics": [{
                "column": "Amount",
                "aggregation": aggregation,
                "alias": "total_amount",
            }],
            "sort": {
                "column": "total_amount",
                "direction": "desc",
            },
            "limit": 100,
        },
        "chart_type": chart_type,
        "metric_alias": "total_amount",
    }


def export(client, request):
    return client.post(
        "/api/v1/exports/analysis/xlsx",
        json=request,
    )


def test_excel_contains_native_chart_and_data(client):
    response = export(client, payload())

    assert response.status_code == 200, response.text
    assert response.content.startswith(b"PK")

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        names = wb.namelist()
        assert "xl/charts/chart1.xml" in names
        assert "xl/worksheets/sheet1.xml" in names
        assert "xl/worksheets/sheet2.xml" in names


def test_donut_combines_extra_categories(client):
    response = export(client, payload("donut"))

    assert response.status_code == 200, response.text

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        assert b"Other (4 categories)" in wb.read(
            "xl/sharedStrings.xml"
        )
        assert b"doughnutChart" in wb.read(
            "xl/charts/chart1.xml"
        )


def test_pie_rejects_averages(client):
    response = export(client, payload("pie", "mean"))
    assert response.status_code == 422


def test_invalid_metric_is_rejected(client):
    request = payload()
    request["metric_alias"] = "nonexistent"

    response = export(client, request)
    assert response.status_code == 422


def test_strings_cannot_become_excel_formulas(client):
    response = export(client, payload())
    assert response.status_code == 200

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        assert b"=2+3" in wb.read("xl/sharedStrings.xml")

        for name in wb.namelist():
            if name.startswith("xl/worksheets/sheet"):
                xml = wb.read(name)
                assert b"<f>" not in xml
                assert b"<f " not in xml


def multi_payload(chart_types=None, aggregation="sum"):
    request = payload(aggregation=aggregation)
    request.pop("chart_type")
    request["chart_types"] = (
        chart_types
        if chart_types is not None
        else ["bar", "horizontal", "donut"]
    )
    return request


def export_multi(client, request):
    return client.post(
        "/api/v1/exports/analysis/xlsx/multi",
        json=request,
    )


def test_multi_chart_export_contains_three_charts(client):
    response = export_multi(client, multi_payload())

    assert response.status_code == 200, response.text

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        names = wb.namelist()

        for index in range(1, 4):
            assert f"xl/charts/chart{index}.xml" in names

        assert "xl/charts/chart4.xml" not in names
        assert b"Charts" in wb.read("xl/workbook.xml")
        assert b"Chart Data" in wb.read("xl/workbook.xml")
        assert b"Verified Data" in wb.read("xl/workbook.xml")

        assert b"doughnutChart" in wb.read(
            "xl/charts/chart3.xml"
        )


def test_multi_chart_combines_other_categories(client):
    response = export_multi(
        client, multi_payload(["bar", "pie"])
    )

    assert response.status_code == 200, response.text

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        assert b"Other (4 categories)" in wb.read(
            "xl/sharedStrings.xml"
        )


def test_multi_chart_rejects_duplicate_types(client):
    response = export_multi(
        client, multi_payload(["bar", "bar"])
    )

    assert response.status_code == 422


def test_multi_chart_rejects_invalid_pie_aggregation(client):
    response = export_multi(
        client, multi_payload(["bar", "pie"], "mean")
    )

    assert response.status_code == 422


def test_multi_chart_prevents_excel_formulas(client):
    response = export_multi(
        client, multi_payload(["bar", "horizontal"])
    )

    assert response.status_code == 200, response.text

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        assert b"=2+3" in wb.read(
            "xl/sharedStrings.xml"
        )

        for name in wb.namelist():
            if name.startswith("xl/worksheets/sheet"):
                xml = wb.read(name)
                assert b"<f>" not in xml
                assert b"<f " not in xml


def dashboard_payload():
    request = payload()
    request["plan"]["metrics"].append({
        "column": "Amount",
        "aggregation": "count",
        "alias": "count_amount",
    })
    request.pop("chart_type")
    request.pop("metric_alias")
    request["charts"] = [
        {"chart_type": "bar", "metric_alias": "total_amount"},
        {"chart_type": "horizontal", "metric_alias": "count_amount"},
    ]
    return request


def export_dashboard(client, request):
    return client.post(
        "/api/v1/exports/analysis/xlsx/dashboard",
        json=request,
    )


def test_dashboard_excel_exports_different_metrics(client):
    response = export_dashboard(client, dashboard_payload())

    assert response.status_code == 200, response.text

    with zipfile.ZipFile(io.BytesIO(response.content)) as wb:
        names = wb.namelist()
        assert "xl/charts/chart1.xml" in names
        assert "xl/charts/chart2.xml" in names
        assert "xl/charts/chart3.xml" not in names
        assert b"count_amount" in wb.read("xl/sharedStrings.xml")


def test_dashboard_excel_rejects_duplicate_charts(client):
    request = dashboard_payload()
    request["charts"][1] = request["charts"][0].copy()

    response = export_dashboard(client, request)

    assert response.status_code == 422


def test_dashboard_excel_rejects_invalid_metric(client):
    request = dashboard_payload()
    request["charts"][1]["metric_alias"] = "unknown_metric"

    response = export_dashboard(client, request)

    assert response.status_code == 422
