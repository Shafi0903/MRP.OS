import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MaterialType = Literal["RAW", "COMPONENT", "PACKAGING", "CONSUMABLE", "SUBASSEMBLY"]
ProcurementType = Literal["BUY", "MAKE", "BOTH"]
LotSizeType = Literal["LOT_FOR_LOT", "FIXED", "PERIOD"]


class MaterialBase(BaseModel):
    material_code: str = Field(..., min_length=2, max_length=30, description="Unique material identifier code")
    name: str = Field(..., min_length=2, max_length=120, description="Descriptive material name")
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field("General", max_length=50)
    material_type: MaterialType = Field("RAW", description="Material classification")
    unit: str = Field("EA", min_length=1, max_length=20, description="Unit of measure (e.g. EA, KG, M)")
    procurement_type: ProcurementType = Field("BUY", description="Acquisition method")
    unit_cost: Decimal = Field(default=Decimal("0.0000"), ge=0, description="Unit cost (non-negative)")
    lead_time_days: int = Field(default=0, ge=0, description="Procurement/production lead time in days")
    safety_stock: Decimal = Field(default=Decimal("0.0000"), ge=0, description="Target minimum inventory balance")
    minimum_order_qty: Decimal = Field(default=Decimal("0.0000"), ge=0, description="Minimum procurement batch quantity")
    lot_size: LotSizeType = Field(default="LOT_FOR_LOT", description="Lot sizing policy")
    fixed_lot_size: Optional[Decimal] = Field(None, ge=0, description="Fixed order multiple (required if FIXED lot size)")
    preferred_supplier_id: Optional[uuid.UUID] = Field(None, description="Preferred supplier UUID")
    is_active: bool = Field(default=True, description="Active status flag")

    @field_validator("material_code", mode="before")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().upper()
            if not v:
                raise ValueError("Material code cannot be empty or whitespace only")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Material name cannot be empty or whitespace only")
        return v

    @field_validator("unit", mode="before")
    @classmethod
    def normalize_unit(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Unit of measure cannot be empty or whitespace only")
        return v

    @model_validator(mode="after")
    def validate_lot_sizing(self) -> "MaterialBase":
        if self.lot_size == "FIXED":
            if self.fixed_lot_size is None or self.fixed_lot_size <= 0:
                raise ValueError("fixed_lot_size must be greater than 0 when lot_size is FIXED")
        return self


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    material_code: Optional[str] = Field(None, min_length=2, max_length=30)
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    category: Optional[str] = Field(None, max_length=50)
    material_type: Optional[MaterialType] = None
    unit: Optional[str] = Field(None, min_length=1, max_length=20)
    procurement_type: Optional[ProcurementType] = None
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    lead_time_days: Optional[int] = Field(None, ge=0)
    safety_stock: Optional[Decimal] = Field(None, ge=0)
    minimum_order_qty: Optional[Decimal] = Field(None, ge=0)
    lot_size: Optional[LotSizeType] = None
    fixed_lot_size: Optional[Decimal] = Field(None, ge=0)
    preferred_supplier_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None

    @field_validator("material_code", mode="before")
    @classmethod
    def normalize_update_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not v:
                raise ValueError("Material code cannot be blank")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_update_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Material name cannot be blank")
        return v

    @field_validator("unit", mode="before")
    @classmethod
    def normalize_update_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Unit of measure cannot be blank")
        return v

    @model_validator(mode="after")
    def validate_lot_sizing(self) -> "MaterialUpdate":
        if self.lot_size == "FIXED":
            if self.fixed_lot_size is not None and self.fixed_lot_size <= 0:
                raise ValueError("fixed_lot_size must be greater than 0 when lot_size is FIXED")
        return self


class MaterialRead(MaterialBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

