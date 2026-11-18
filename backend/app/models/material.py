import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    String,
    Numeric,
    Integer,
    Boolean,
    DateTime,
    CheckConstraint,
    Index,
    Uuid,
    Text,
    ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    material_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        index=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    category: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default="General",
    )
    material_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="RAW",
    )
    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="EA",
    )
    procurement_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="BUY",
    )
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    lead_time_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    safety_stock: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    minimum_order_qty: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    lot_size: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="LOT_FOR_LOT",
    )
    fixed_lot_size: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 4),
        nullable=True,
    )
    preferred_supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=True,
    )

    # Relationships
    preferred_supplier = relationship("Supplier", back_populates="materials", foreign_keys=[preferred_supplier_id])
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

    __table_args__ = (
        CheckConstraint("unit_cost >= 0", name="chk_material_unit_cost_non_negative"),
        CheckConstraint("lead_time_days >= 0", name="chk_material_lead_time_non_negative"),
        CheckConstraint("safety_stock >= 0", name="chk_material_safety_stock_non_negative"),
        CheckConstraint("minimum_order_qty >= 0", name="chk_material_moq_non_negative"),
    )

    def __repr__(self) -> str:
        return f"<Material code={self.material_code} name={self.name}>"

    @property
    def unit_of_measure(self) -> str:
        return self.unit

    @property
    def standard_cost(self) -> Decimal:
        return self.unit_cost

    @property
    def minimum_order_quantity(self) -> Decimal:
        return self.minimum_order_qty

    @property
    def lot_sizing_rule(self) -> str:
        return self.lot_size

    @property
    def reorder_point(self) -> Optional[Decimal]:
        return self.safety_stock

