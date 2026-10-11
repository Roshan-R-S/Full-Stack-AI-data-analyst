import io

import pandas as pd

from app.core.config import MAX_COLUMNS, MAX_ROWS


def load_csv(file_bytes: bytes) -> pd.DataFrame:
    if not file_bytes:
        raise ValueError("CSV file is empty.")

    if b"\x00" in file_bytes:
        raise ValueError("Binary or invalid CSV content.")

    try:
        df = pd.read_csv(
            io.BytesIO(file_bytes),
            encoding="utf-8-sig",
            on_bad_lines="error",
            nrows=MAX_ROWS + 1,
        )
    except (
        pd.errors.EmptyDataError,
        pd.errors.ParserError,
        UnicodeDecodeError,
        ValueError,
    ) as exc:
        raise ValueError(
            "Unable to parse CSV. Use a valid UTF-8 "
            "comma-separated file."
        ) from exc

    if df.empty:
        raise ValueError(
            "CSV must contain at least one data row."
        )

    if df.shape[0] > MAX_ROWS:
        raise ValueError(
            f"CSV exceeds the {MAX_ROWS:,} row limit."
        )

    if df.shape[1] > MAX_COLUMNS:
        raise ValueError(
            f"CSV exceeds the {MAX_COLUMNS} column limit."
        )

    return df