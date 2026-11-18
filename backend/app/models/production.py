import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String,
    Numeric,
    Integer,
    DateTime,
    Date,
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


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    order_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    bom_header_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bom_headers.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    bom_revision: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    planned_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )
    completed_quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    unit_of_measure: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    planned_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    priority: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="NORMAL",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DRAFT",
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    actual_start_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    actual_completion_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
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
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )

    # Relationships
    product = relationship("Product")
    bom_header = relationship("BomHeader")
    status_history: Mapped[List["ProductionOrderStatusHistory"]] = relationship(
        "ProductionOrderStatusHistory",
        back_populates="production_order",
        cascade="all, delete-orphan",
        order_by="ProductionOrderStatusHistory.changed_at",
    )

    __table_args__ = (
        CheckConstraint("planned_quantity > 0", name="chk_prod_order_planned_qty_positive"),
        CheckConstraint("completed_quantity >= 0 AND completed_quantity <= planned_quantity", name="chk_prod_order_completed_qty_range"),
        CheckConstraint("due_date >= planned_start_date", name="chk_prod_order_dates_valid"),
        CheckConstraint("priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')", name="chk_prod_order_priority_valid"),
        CheckConstraint("status IN ('DRAFT', 'PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')", name="chk_prod_order_status_valid"),
        Index("ix_prod_orders_status_due_date", "status", "due_date"),
    )

    def __repr__(self) -> str:
        return f"<ProductionOrder code={self.order_code} status={self.status}>"


class ProductionOrderStatusHistory(Base):
    __tablename__ = "production_order_status_history"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    production_order_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("production_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    to_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    changed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )

    production_order = relationship("ProductionOrder", back_populates="status_history")

    def __repr__(self) -> str:
        return f"<ProductionOrderStatusHistory order={self.production_order_id} {self.from_status}->{self.to_status}>"

