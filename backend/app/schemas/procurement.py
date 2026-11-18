import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, ConfigDict


class PurchaseOrderItemCreate(BaseModel):
    material_id: uuid.UUID
    ordered_quantity: Decimal = Field(..., gt=0)
    unit_of_measure: str = Field(..., max_length=20)
    unit_price: Decimal = Field(..., ge=0)
    expected_receipt_date: date
    notes: Optional[str] = None


class PurchaseOrderItemRead(BaseModel):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    line_number: int
    material_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    ordered_quantity: Decimal
    received_quantity: Decimal
    open_quantity: Decimal
    unit_of_measure: str
    unit_price: Decimal
    line_total: Decimal
    expected_receipt_date: date
    source_proposal_id: Optional[uuid.UUID] = None
    source_mrp_run_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderCreate(BaseModel):
    supplier_id: uuid.UUID
    order_date: Optional[date] = None
    currency: str = Field(default="INR", max_length=3)
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate] = Field(default_factory=list)


class ProposalConversionLine(BaseModel):
    proposal_id: uuid.UUID
    unit_price: Decimal = Field(..., ge=0)


class PurchaseOrderFromProposals(BaseModel):
    supplier_id: uuid.UUID
    order_date: Optional[date] = None
    notes: Optional[str] = None
    lines: List[ProposalConversionLine] = Field(..., min_length=1)


class PurchaseOrderTransition(BaseModel):
    to_status: Literal["DRAFT", "SUBMITTED", "APPROVED", "SENT", "CANCELLED"]
    reason: Optional[str] = None
    version: int


class PurchaseOrderStatusHistoryRead(BaseModel):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    from_status: Optional[str] = None
    to_status: str
    reason: Optional[str] = None
    changed_at: datetime
    changed_by: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class GoodsReceiptLineCreate(BaseModel):
    purchase_order_item_id: uuid.UUID
    received_quantity: Decimal = Field(..., gt=0)
    notes: Optional[str] = None


class GoodsReceiptCreate(BaseModel):
    receipt_date: Optional[date] = None
    delivery_reference: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    lines: List[GoodsReceiptLineCreate] = Field(..., min_length=1)


class GoodsReceiptItemRead(BaseModel):
    id: uuid.UUID
    goods_receipt_id: uuid.UUID
    purchase_order_item_id: uuid.UUID
    material_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    received_quantity: Decimal
    unit_of_measure: str
    inventory_transaction_id: uuid.UUID
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GoodsReceiptRead(BaseModel):
    id: uuid.UUID
    receipt_number: str
    purchase_order_id: uuid.UUID
    supplier_id: uuid.UUID
    supplier_name: Optional[str] = None
    receipt_date: date
    delivery_reference: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_at: datetime
    items: List[GoodsReceiptItemRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderRead(BaseModel):
    id: uuid.UUID
    po_number: str
    supplier_id: uuid.UUID
    supplier_name: Optional[str] = None
    supplier_gstin: Optional[str] = None
    status: str
    order_date: date
    currency: str
    payment_terms: Optional[str] = None
    total_amount: Decimal
    notes: Optional[str] = None
    cancellation_reason: Optional[str] = None
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    version: int
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseOrderItemRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

