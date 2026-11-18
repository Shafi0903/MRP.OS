import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict


class MrpRunCreate(BaseModel):
    planning_start_date: Optional[date] = Field(default=None, description="Start date for horizon, defaults to today")
    planning_horizon_periods: int = Field(default=12, ge=1, le=52)
    period_type: Literal["DAILY", "WEEKLY"] = "WEEKLY"
    production_order_ids: List[uuid.UUID] = Field(default_factory=list)


class MrpResultRead(BaseModel):
    id: uuid.UUID
    mrp_run_id: uuid.UUID
    material_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    period_index: int
    period_start_date: date
    gross_requirements: Decimal
    scheduled_receipts: Decimal
    projected_available_before: Decimal
    net_requirements: Decimal
    planned_order_receipt_qty: Decimal
    projected_available_after: Decimal
    safety_stock: Decimal
    lead_time_periods: int
    planned_order_release_date: Optional[date] = None
    planned_order_receipt_date: Optional[date] = None
    proposal_status: str

    model_config = ConfigDict(from_attributes=True)


class MrpProposalRead(BaseModel):
    id: uuid.UUID
    mrp_run_id: uuid.UUID
    material_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    preferred_supplier_id: Optional[uuid.UUID] = None
    preferred_supplier_name: Optional[str] = None
    proposal_type: str
    quantity: Decimal
    standard_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    release_date: date
    receipt_date: date
    release_period_index: int
    receipt_period_index: int
    status: str
    converted_po_item_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MrpRunRead(BaseModel):
    id: uuid.UUID
    run_code: str
    planning_start_date: date
    planning_horizon_periods: int
    period_type: str
    status: str
    algorithm_version: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    materials_planned_count: int = 0
    proposals_count: int = 0
    shortage_count: int = 0
    past_due_count: int = 0
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

