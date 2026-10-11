from uuid import UUID

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    dataset_id: UUID
    question: str = Field(
        min_length=5,
        max_length=500,
    )