import pandas as pd


def profile_dataframe(df: pd.DataFrame) -> dict:
    columns = []

    for name in df.columns:
        series = df[name]
        info = {
            "name": str(name),
            "dtype": str(series.dtype),
            "missing": int(series.isna().sum()),
            "unique": int(series.nunique(dropna=True)),
        }

        if pd.api.types.is_numeric_dtype(series):
            values = pd.to_numeric(
                series, errors="coerce"
            ).replace([float("inf"), float("-inf")], float("nan"))
            values = values.dropna()

            if not values.empty:
                info["statistics"] = {
                    "min": float(values.min()),
                    "max": float(values.max()),
                    "mean": float(values.mean()),
                    "sum": float(values.sum()),
                }
        else:
            counts = (
                series.dropna()
                .astype(str)
                .value_counts()
                .head(5)
            )
            info["top_values"] = [
                {"value": key, "count": int(count)}
                for key, count in counts.items()
            ]

        columns.append(info)

    return {
        "row_count": len(df),
        "column_count": len(df.columns),
        "missing_cells": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "columns": columns,
    }