import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String,
    Numeric,
    DateTime,
    CheckConstraint,
    Text,
    Uuid,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("materials.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
    )
    on_hand_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    reserved_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    available_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    last_reconciled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    material = relationship("Material", foreign_keys=[material_id])

    __table_args__ = (
        CheckConstraint("on_hand_quantity >= 0", name="chk_inventory_on_hand_non_negative"),
        CheckConstraint("reserved_quantity >= 0", name="chk_inventory_reserved_non_negative"),
    )

    def __repr__(self) -> str:
        return f"<InventoryBalance material_id={self.material_id} on_hand={self.on_hand_quantity} avail={self.available_quantity}>"


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    transaction_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("materials.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    transaction_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )
    unit_of_measure: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    reference_type: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    material = relationship("Material", foreign_keys=[material_id])

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'RESERVATION', 'RELEASE')",
            name="chk_inventory_transaction_type_valid",
        ),
    )

    def __repr__(self) -> str:
        return f"<InventoryTransaction code={self.transaction_code} type={self.transaction_type} qty={self.quantity}>"

