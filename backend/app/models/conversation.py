from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.message import Message


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(
        String(36), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[str] = mapped_column(
        String(40), default=utc_now, nullable=False
    )
    updated_at: Mapped[str] = mapped_column(
        String(40), default=utc_now, nullable=False
    )

    messages: Mapped[list["Message"]] = relationship(  # noqa: UP037
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
    )