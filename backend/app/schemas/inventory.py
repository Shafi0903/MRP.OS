import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class InventoryTransactionCreate(BaseModel):
    material_id: uuid.UUID
    transaction_type: Literal["RECEIPT", "ISSUE", "ADJUSTMENT", "RESERVATION", "RELEASE"]
    quantity: Decimal = Field(..., gt=0, description="Quantity for transaction")
    unit_of_measure: str = Field(..., max_length=20)
    reference_type: Optional[str] = Field(None, max_length=30)
    reference_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class InventoryBalanceRead(BaseModel):
    id: uuid.UUID
    material_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    standard_cost: Optional[Decimal] = None
    on_hand_quantity: Decimal
    reserved_quantity: Decimal
    available_quantity: Decimal
    safety_stock: Optional[Decimal] = None
    reorder_point: Optional[Decimal] = None
    last_reconciled_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryTransactionRead(BaseModel):
    id: uuid.UUID
    transaction_code: str
    material_id: uuid.UUID
    material_code: Optional[str] = None
    transaction_type: str
    quantity: Decimal
    unit_of_measure: str
    reference_type: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    occurred_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

