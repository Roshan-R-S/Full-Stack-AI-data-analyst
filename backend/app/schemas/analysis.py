from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

Scalar = str | int | float | bool


class FilterSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1)
    operator: Literal[
        "eq", "ne", "gt", "gte",
        "lt", "lte", "in", "contains"
    ]
    value: Scalar | list[Scalar]


class MetricSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1)
    aggregation: Literal[
        "sum", "mean", "min",
        "max", "count", "nunique"
    ]
    alias: str = Field(
        pattern=r"^[A-Za-z_][A-Za-z0-9_]*$"
    )


class SortSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1)
    direction: Literal["asc", "desc"] = "desc"


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataset_id: UUID

    filters: list[FilterSpec] = Field(
        default_factory=list,
        max_length=10,
    )

    group_by: list[str] = Field(
        default_factory=list,
        max_length=3,
    )

    metrics: list[MetricSpec] = Field(
        min_length=1,
        max_length=5,
    )

    sort: SortSpec | None = None

    limit: int = Field(default=50, ge=1, le=100)