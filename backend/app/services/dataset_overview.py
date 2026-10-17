import re

import pandas as pd

from app.services.profiling_service import profile_dataframe

OVERVIEW_QUESTIONS = {
    "what is this data about",
    "what is this dataset about",
    "what is the dataset about",
    "what does this dataset contain",
    "what is in this dataset",
    "describe this dataset",
    "describe the dataset",
    "summarize this dataset",
    "summarise this dataset",
    "give me an overview of this dataset",
    "tell me about this dataset",
    "what is this csv about",
}


def is_overview_question(question: str) -> bool:
    normalized = " ".join(
        re.findall(r"[a-z0-9]+", question.casefold())
    )
    return normalized in OVERVIEW_QUESTIONS


def describe_dataset(df: pd.DataFrame) -> str:
    profile = profile_dataframe(df)

    names = {
        re.sub(r"[^a-z0-9]", "", str(column).lower())
        for column in df.columns
    }

    if "cardtype" in names or "creditscore" in names:
        subject = "credit-card and financial information"
    elif "product" in names and (
        "revenue" in names or "sales" in names
    ):
        subject = "sales and product information"
    else:
        subject = "structured records across the listed fields"

    columns = profile["columns"]
    shown = columns[:15]

    column_details = "\n".join(
        f"- `{str(item['name']).replace('`', '')}` "
        f"({item['dtype']})"
        for item in shown
    )

    remaining = len(columns) - len(shown)

    if remaining:
        column_details += (
            f"\n- ...and {remaining} additional columns"
        )

    return (
        "## Dataset overview\n\n"
        f"Based on the column names, this dataset appears "
        f"to contain {subject}. The exact business meaning "
        f"cannot be confirmed without a data dictionary.\n\n"
        f"**Records:** {profile['row_count']:,}\n\n"
        f"**Columns:** {profile['column_count']}\n\n"
        f"**Missing cells:** {profile['missing_cells']:,}\n\n"
        f"**Duplicate rows:** {profile['duplicate_rows']:,}\n\n"
        "### Available columns\n\n"
        f"{column_details}\n\n"
        "You can explore this dataset using filtering, "
        "grouping, averages, totals, counts and charts."
    )
