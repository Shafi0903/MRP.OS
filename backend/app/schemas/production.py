import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class ProductionOrderCreate(BaseModel):
    product_id: uuid.UUID
    planned_quantity: Decimal = Field(..., gt=0, description="Quantity to produce")
    unit_of_measure: Optional[str] = Field(None, max_length=20)
    planned_start_date: Optional[date] = None
    due_date: date
    priority: Literal["LOW", "NORMAL", "HIGH", "URGENT"] = "NORMAL"
    bom_header_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class ProductionOrderUpdate(BaseModel):
    version: int
    priority: Optional[Literal["LOW", "NORMAL", "HIGH", "URGENT"]] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    planned_quantity: Optional[Decimal] = Field(None, gt=0)


class ProductionOrderTransition(BaseModel):
    to_status: Literal["DRAFT", "PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
    reason: Optional[str] = None
    version: int


class ProductionOrderProgress(BaseModel):
    completed_quantity: Decimal = Field(..., ge=0)
    version: int


class ProductionOrderStatusHistoryRead(BaseModel):
    id: uuid.UUID
    production_order_id: uuid.UUID
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    changed_at: datetime
    changed_by: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class ProductionOrderRead(BaseModel):
    id: uuid.UUID
    order_code: str
    product_id: uuid.UUID
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    bom_header_id: Optional[uuid.UUID] = None
    bom_revision: Optional[str] = None
    planned_quantity: Decimal
    completed_quantity: Decimal
    unit_of_measure: str
    planned_start_date: date
    due_date: date
    priority: str
    status: str
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    actual_start_at: Optional[datetime] = None
    actual_completion_at: Optional[datetime] = None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

