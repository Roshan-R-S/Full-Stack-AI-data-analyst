from uuid import UUID

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    dataset_id: UUID
    conversation_id: UUID | None = None
    question: str = Field(
        min_length=5,
        max_length=500,
    )