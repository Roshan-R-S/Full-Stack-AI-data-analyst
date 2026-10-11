from uuid import UUID

import pandas as pd
import pytest
from pydantic import ValidationError

from app.analytics.executor import execute_analysis
from app.schemas.analysis import AnalysisRequest

DATASET_ID = UUID(
    "00000000-0000-0000-0000-000000000001"
)


@pytest.fixture
def sales_df():
    return pd.DataFrame({
        "Product": ["A", "B", "A", "C", "B"],
        "Region": [
            "North", "South", "East", "West", "North"
        ],
        "Quantity": [10, 8, 12, 5, 15],
        "Revenue": [1500, 1200, 1800, 950, 2250],
    })


def make_plan(**overrides):
    data = {
        "dataset_id": DATASET_ID,
        "metrics": [
            {
                "column": "Revenue",
                "aggregation": "sum",
                "alias": "total_revenue",
            }
        ],
    }
    data.update(overrides)
    return AnalysisRequest(**data)


def test_total_revenue(sales_df):
    result = execute_analysis(sales_df, make_plan())

    assert result["rows"][0]["total_revenue"] == 7700
    assert result["matched_rows"] == 5


def test_group_by_region(sales_df):
    plan = make_plan(
        group_by=["Region"],
        sort={
            "column": "total_revenue",
            "direction": "desc",
        },
    )

    result = execute_analysis(sales_df, plan)

    assert result["rows"][0] == {
        "Region": "North",
        "total_revenue": 3750,
    }
    assert result["result_count"] == 4


def test_numeric_filter(sales_df):
    plan = make_plan(
        filters=[{
            "column": "Revenue",
            "operator": "gt",
            "value": 1000,
        }]
    )

    result = execute_analysis(sales_df, plan)

    assert result["matched_rows"] == 4
    assert result["rows"][0]["total_revenue"] == 6750


def test_in_filter(sales_df):
    plan = make_plan(
        filters=[{
            "column": "Region",
            "operator": "in",
            "value": ["North", "East"],
        }]
    )

    result = execute_analysis(sales_df, plan)

    assert result["matched_rows"] == 3
    assert result["rows"][0]["total_revenue"] == 5550


def test_contains_filter(sales_df):
    plan = make_plan(
        filters=[{
            "column": "Region",
            "operator": "contains",
            "value": "north",
        }]
    )

    result = execute_analysis(sales_df, plan)

    assert result["matched_rows"] == 2


def test_unknown_column_rejected(sales_df):
    plan = make_plan(
        group_by=["DoesNotExist"],
    )

    with pytest.raises(ValueError, match="Unknown"):
        execute_analysis(sales_df, plan)


def test_invalid_numeric_aggregation(sales_df):
    plan = make_plan(
        metrics=[{
            "column": "Product",
            "aggregation": "sum",
            "alias": "bad_total",
        }]
    )

    with pytest.raises(ValueError, match="numeric"):
        execute_analysis(sales_df, plan)


def test_invalid_sort_rejected(sales_df):
    plan = make_plan(
        sort={
            "column": "NonExistent",
            "direction": "desc",
        },
    )

    with pytest.raises(ValueError, match="Sort column"):
        execute_analysis(sales_df, plan)


def test_unsupported_aggregation_rejected():
    with pytest.raises(ValidationError):
        make_plan(
            metrics=[{
                "column": "Revenue",
                "aggregation": "execute",
                "alias": "unsafe",
            }]
        )


def test_result_limit(sales_df):
    plan = make_plan(
        group_by=["Region"],
        limit=2,
    )

    result = execute_analysis(sales_df, plan)

    assert result["returned_rows"] == 2
    assert result["result_count"] == 4
    assert result["truncated"] is True