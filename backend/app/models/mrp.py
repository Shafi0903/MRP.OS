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
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MrpRun(Base):
    __tablename__ = "mrp_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    run_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        index=True,
        nullable=False,
    )
    planning_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    planning_horizon_periods: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    period_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="WEEKLY",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="COMPLETED",
        index=True,
    )
    input_snapshot_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    algorithm_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="1.0.0",
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    results: Mapped[List["MrpResult"]] = relationship(
        "MrpResult",
        back_populates="mrp_run",
        cascade="all, delete-orphan",
    )
    proposals: Mapped[List["MrpProposal"]] = relationship(
        "MrpProposal",
        back_populates="mrp_run",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')", name="chk_mrp_run_status_valid"),
        CheckConstraint("period_type IN ('DAILY', 'WEEKLY')", name="chk_mrp_run_period_type_valid"),
        CheckConstraint("planning_horizon_periods > 0", name="chk_mrp_run_horizon_positive"),
    )

    def __repr__(self) -> str:
        return f"<MrpRun code={self.run_code} status={self.status}>"


class MrpResult(Base):
    __tablename__ = "mrp_results"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    mrp_run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("mrp_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("materials.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    period_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    period_start_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    gross_requirements: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    scheduled_receipts: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    projected_available_before: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    net_requirements: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    planned_order_receipt_qty: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    projected_available_after: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    safety_stock: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
        default=Decimal("0.0000"),
    )
    lead_time_periods: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    planned_order_release_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    planned_order_receipt_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    proposal_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="NORMAL",
    )
    explanation_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    mrp_run = relationship("MrpRun", back_populates="results")
    material = relationship("Material")

    __table_args__ = (
        UniqueConstraint("mrp_run_id", "material_id", "period_index", name="uq_mrp_result_run_material_period"),
    )

    def __repr__(self) -> str:
        return f"<MrpResult run={self.mrp_run_id} mat={self.material_id} p={self.period_index}>"


class MrpProposal(Base):
    __tablename__ = "mrp_proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    mrp_run_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("mrp_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("materials.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    proposal_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PURCHASE",
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(14, 4),
        nullable=False,
    )
    release_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    receipt_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    release_period_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    receipt_period_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="OPEN",
        index=True,
    )
    converted_po_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    mrp_run = relationship("MrpRun", back_populates="proposals")
    material = relationship("Material")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_mrp_proposal_quantity_positive"),
        CheckConstraint("status IN ('OPEN', 'PAST_DUE', 'OUTSIDE_HORIZON', 'CONVERTED', 'CANCELLED')", name="chk_mrp_proposal_status_valid"),
        CheckConstraint("proposal_type IN ('PURCHASE', 'PRODUCTION', 'TRANSFER')", name="chk_mrp_proposal_type_valid"),
    )

    def __repr__(self) -> str:
        return f"<MrpProposal id={self.id} type={self.proposal_type} qty={self.quantity} status={self.status}>"

