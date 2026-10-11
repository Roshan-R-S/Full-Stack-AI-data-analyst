from datetime import UTC, datetime

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True
    )
    filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    row_count: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    column_count: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    uploaded_at: Mapped[str] = mapped_column(
        String(40),
        default=lambda: datetime.now(
            UTC
        ).isoformat(),
        nullable=False,
    )