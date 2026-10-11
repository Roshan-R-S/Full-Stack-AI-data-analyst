from datetime import datetime, timezone

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SavedAnalysis(Base):
    __tablename__ = "saved_analyses"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(
        String(120), nullable=False
    )
    plan_json: Mapped[str] = mapped_column(
        Text, nullable=False
    )
    created_at: Mapped[str] = mapped_column(
        String(40), default=utc_now, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        String(40), default=utc_now, nullable=False
    )