from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import AnalysisRequest


class SaveAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    plan: AnalysisRequest


class RenameSavedAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)