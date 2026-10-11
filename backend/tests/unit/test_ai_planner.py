from uuid import UUID

import pandas as pd
import pytest

from app.ai.planner import AIPlan, compile_ai_plan
from app.analytics.executor import execute_analysis

DATASET_ID = UUID(
    "00000000-0000-0000-0000-000000000001"
)


@pytest.fixture
def sample_data():
    return pd.DataFrame({
        "Card_Type": ["Gold", "Basic", "Gold"],
        "Annual_Income": [100, 200, 300],
        "Age": [24, 43, 51],
    })


def make_ai_plan(**overrides):
    data = {
        "supported": True,
        "reason": "",
        "group_by": ["Card_Type"],
        "metrics": [{
            "column": "Annual_Income",
            "aggregation": "mean",
        }],
        "filters": [],
        "sort_direction": "desc",
        "limit": 10,
    }
    data.update(overrides)
    return AIPlan(**data)


def test_ai_plan_to_verified_analysis(sample_data):
    plan = compile_ai_plan(
        make_ai_plan(), DATASET_ID, sample_data
    )

    result = execute_analysis(sample_data, plan)

    assert result["rows"][0] == {
        "Card_Type": "Basic",
        "result": 200,
    }


def test_numeric_filter_conversion(sample_data):
    ai_plan = make_ai_plan(
        filters=[{
            "column": "Age",
            "operator": "gt",
            "value": "40",
        }],
    )

    plan = compile_ai_plan(
        ai_plan, DATASET_ID, sample_data
    )
    result = execute_analysis(sample_data, plan)

    assert result["matched_rows"] == 2


def test_unknown_column_rejected(sample_data):
    ai_plan = make_ai_plan(
        group_by=["Fake_Column"],
    )

    with pytest.raises(ValueError, match="Unknown"):
        compile_ai_plan(
            ai_plan, DATASET_ID, sample_data
        )


def test_unsupported_question_rejected(sample_data):
    ai_plan = make_ai_plan(
        supported=False,
        reason="Forecasting is not supported.",
    )

    with pytest.raises(ValueError, match="Forecasting"):
        compile_ai_plan(
            ai_plan, DATASET_ID, sample_data
        )