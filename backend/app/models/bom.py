import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy import (
    String,
    Numeric,
    Integer,
    Boolean,
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


class BomHeader(Base):
    __tablename__ = "bom_headers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    bom_code: Mapped[str] = mapped_column(
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
    revision: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="Rev 1.0",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    effective_from: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    effective_to: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
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
    product = relationship("Product", foreign_keys=[product_id])
    items: Mapped[List["BomItem"]] = relationship(
        "BomItem",
        back_populates="bom_header",
        cascade="all, delete-orphan",
        order_by="BomItem.item_sequence",
    )

    def __repr__(self) -> str:
        return f"<BomHeader code={self.bom_code} revision={self.revision}>"


class BomItem(Base):
    __tablename__ = "bom_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    bom_header_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("bom_headers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("materials.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    child_product_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )
    unit_of_measure: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="EA",
    )
    scrap_factor: Mapped[Decimal] = mapped_column(
        Numeric(6, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    lead_time_offset_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    item_sequence: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    bom_header: Mapped["BomHeader"] = relationship("BomHeader", back_populates="items")
    material = relationship("Material", foreign_keys=[material_id])
    child_product = relationship("Product", foreign_keys=[child_product_id])

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_bom_item_quantity_positive"),
        CheckConstraint("scrap_factor >= 0 AND scrap_factor < 1", name="chk_bom_item_scrap_factor_range"),
        CheckConstraint("lead_time_offset_days >= 0", name="chk_bom_item_lead_time_offset_non_negative"),
        CheckConstraint(
            "(material_id IS NOT NULL AND child_product_id IS NULL) OR (material_id IS NULL AND child_product_id IS NOT NULL)",
            name="chk_bom_item_target_mutual_exclusive",
        ),
    )

    def __repr__(self) -> str:
        return f"<BomItem id={self.id} qty={self.quantity} uom={self.unit_of_measure}>"

