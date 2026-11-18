import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    CheckConstraint,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    supplier_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        index=True,
    )
    contact_person: Mapped[Optional[str]] = mapped_column(
        String(120),
        nullable=True,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    address_line: Mapped[Optional[str]] = mapped_column(
        String(250),
        nullable=True,
    )
    city: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    state_region: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    postal_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    country: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        default="India",
    )
    payment_terms_days: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    # Relationships
    materials: Mapped[list["Material"]] = relationship(
        "Material",
        back_populates="preferred_supplier",
        foreign_keys="Material.preferred_supplier_id",
    )

    __table_args__ = (
        CheckConstraint(
            "payment_terms_days IS NULL OR (payment_terms_days >= 0 AND payment_terms_days <= 365)",
            name="chk_supplier_payment_terms_valid",
        ),
    )

    def __repr__(self) -> str:
        return f"<Supplier code={self.supplier_code} name={self.name}>"

    @property
    def payment_terms(self) -> Optional[str]:
        return f"Net {self.payment_terms_days}" if self.payment_terms_days is not None else "Net 30"

