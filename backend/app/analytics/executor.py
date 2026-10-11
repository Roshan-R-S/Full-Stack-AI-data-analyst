import json

import pandas as pd

from app.analytics.plan_validator import validate_analysis_plan
from app.schemas.analysis import AnalysisRequest


def apply_filters(
    df: pd.DataFrame,
    plan: AnalysisRequest,
) -> pd.DataFrame:
    result = df

    for spec in plan.filters:
        series = result[spec.column]
        op = spec.operator
        value = spec.value

        if op == "eq":
            mask = series.eq(value)
        elif op == "ne":
            mask = series.ne(value)
        elif op == "gt":
            mask = series.gt(value)
        elif op == "gte":
            mask = series.ge(value)
        elif op == "lt":
            mask = series.lt(value)
        elif op == "lte":
            mask = series.le(value)
        elif op == "in":
            mask = series.isin(value)
        elif op == "contains":
            mask = (
                series.astype("string")
                .str.contains(
                    value,
                    case=False,
                    regex=False,
                    na=False,
                )
            )
        else:
            raise ValueError(
                "Unsupported filter operator."
            )

        result = result.loc[mask.fillna(False)]

    return result


def execute_analysis(
    df: pd.DataFrame,
    plan: AnalysisRequest,
) -> dict:
    validate_analysis_plan(df, plan)

    filtered = apply_filters(df, plan)

    if filtered.empty:
        raise ValueError(
            "No records matched the selected filters."
        )

    if plan.group_by:
        aggregations = {
            metric.alias: pd.NamedAgg(
                column=metric.column,
                aggfunc=metric.aggregation,
            )
            for metric in plan.metrics
        }

        result = (
            filtered.groupby(
                plan.group_by,
                dropna=False,
            )
            .agg(**aggregations)
            .reset_index()
        )

    else:
        values = {}

        for metric in plan.metrics:
            series = filtered[metric.column]

            values[metric.alias] = getattr(
                series, metric.aggregation
            )()

        result = pd.DataFrame([values])

    if plan.sort:
        result = result.sort_values(
            plan.sort.column,
            ascending=plan.sort.direction == "asc",
            kind="stable",
            na_position="last",
        )

    result_count = len(result)
    limited = result.head(plan.limit)

    # Pandas serializes missing and non-finite
    # analytical values as JSON null.
    rows = json.loads(
        limited.to_json(
            orient="records",
            date_format="iso",
        )
    )

    return {
        "dataset_id": str(plan.dataset_id),
        "source_rows": len(df),
        "matched_rows": len(filtered),
        "result_count": result_count,
        "returned_rows": len(rows),
        "truncated": result_count > plan.limit,
        "columns": list(result.columns),
        "rows": rows,
    }