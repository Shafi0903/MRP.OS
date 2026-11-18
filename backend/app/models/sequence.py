import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, UniqueConstraint, DateTime, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentSequence(Base):
    __tablename__ = "document_sequences"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    prefix: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    last_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("prefix", "year", name="uq_document_sequence_prefix_year"),
    )

    def __repr__(self) -> str:
        return f"<DocumentSequence prefix={self.prefix} year={self.year} last_value={self.last_value}>"

