import pandas as pd
from pandas.api.types import is_numeric_dtype

from app.schemas.analysis import AnalysisRequest

NUMERIC_AGGREGATIONS = {
    "sum", "mean", "min", "max"
}


def validate_analysis_plan(
    df: pd.DataFrame,
    plan: AnalysisRequest,
) -> None:
    columns = set(df.columns)

    if len(set(plan.group_by)) != len(plan.group_by):
        raise ValueError(
            "Duplicate group_by columns are not allowed."
        )

    for column in plan.group_by:
        if column not in columns:
            raise ValueError(
                f"Unknown grouping column: {column}"
            )

    for filter_spec in plan.filters:
        column = filter_spec.column
        operator = filter_spec.operator
        value = filter_spec.value

        if column not in columns:
            raise ValueError(
                f"Unknown filter column: {column}"
            )

        if operator == "in":
            if not isinstance(value, list):
                raise ValueError(
                    "'in' requires a list of values."
                )

            if not 1 <= len(value) <= 20:
                raise ValueError(
                    "'in' requires 1 to 20 values."
                )

        elif isinstance(value, list):
            raise ValueError(
                f"'{operator}' requires a single value."
            )

        if operator in {"gt", "gte", "lt", "lte"}:
            if not is_numeric_dtype(df[column]):
                raise ValueError(
                    f"Numeric comparison is not supported "
                    f"for column: {column}"
                )

            if isinstance(value, bool) or not isinstance(
                value, (int, float)
            ):
                raise ValueError(
                    "Numeric comparisons require a number."
                )

        if operator == "contains":
            if not isinstance(value, str):
                raise ValueError(
                    "'contains' requires a string."
                )

            if is_numeric_dtype(df[column]):
                raise ValueError(
                    "'contains' requires a text column."
                )

    aliases = [m.alias for m in plan.metrics]

    if len(set(aliases)) != len(aliases):
        raise ValueError(
            "Metric aliases must be unique."
        )

    if set(aliases).intersection(plan.group_by):
        raise ValueError(
            "Metric aliases cannot match grouping columns."
        )

    for metric in plan.metrics:
        if metric.column not in columns:
            raise ValueError(
                f"Unknown metric column: {metric.column}"
            )

        if (
            metric.aggregation in NUMERIC_AGGREGATIONS
            and not is_numeric_dtype(df[metric.column])
        ):
            raise ValueError(
                f"Aggregation '{metric.aggregation}' "
                f"requires a numeric column."
            )

    if plan.sort:
        allowed = set(plan.group_by) | set(aliases)

        if plan.sort.column not in allowed:
            raise ValueError(
                "Sort column must be a grouping "
                "column or metric alias."
            )