import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator


class BomItemBase(BaseModel):
    material_id: Optional[uuid.UUID] = None
    child_product_id: Optional[uuid.UUID] = None
    quantity: Decimal = Field(..., gt=0, description="Quantity required per parent unit")
    unit_of_measure: str = Field(..., max_length=20)
    scrap_factor: Decimal = Field(default=Decimal("0.0000"), ge=0, lt=1, description="Scrap or loss rate e.g. 0.05 for 5%")
    lead_time_offset_days: int = Field(default=0, ge=0)
    item_sequence: int = Field(default=10, ge=1)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_target(self) -> "BomItemBase":
        if self.material_id is None and self.child_product_id is None:
            raise ValueError("Either material_id or child_product_id must be provided")
        if self.material_id is not None and self.child_product_id is not None:
            raise ValueError("Cannot specify both material_id and child_product_id on the same line")
        return self


class BomItemCreate(BomItemBase):
    pass


class BomItemRead(BomItemBase):
    id: uuid.UUID
    bom_header_id: uuid.UUID
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_cost: Optional[Decimal] = None
    child_product_code: Optional[str] = None
    child_product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BomHeaderBase(BaseModel):
    product_id: uuid.UUID
    revision: str = Field(default="Rev 1.0", max_length=20)
    description: Optional[str] = None
    is_active: bool = True
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class BomHeaderCreate(BomHeaderBase):
    items: List[BomItemCreate] = Field(default_factory=list)


class BomHeaderUpdate(BaseModel):
    revision: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    items: Optional[List[BomItemCreate]] = None


class BomHeaderRead(BomHeaderBase):
    id: uuid.UUID
    bom_code: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    product_uom: Optional[str] = None
    product_type: Optional[str] = None
    approximate_cost: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime
    items: List[BomItemRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class BomExplosionItem(BaseModel):
    level: int
    line_number: int
    item_type: str  # "MATERIAL" or "SUBASSEMBLY"
    item_id: uuid.UUID
    item_code: str
    item_name: str
    parent_code: Optional[str] = None
    quantity_per_parent: Decimal
    extended_quantity: Decimal
    scrap_factor: Decimal
    effective_quantity: Decimal
    unit_of_measure: str
    lead_time_days: int
    cumulative_lead_time_days: int
    unit_cost: Decimal
    extended_cost: Decimal

