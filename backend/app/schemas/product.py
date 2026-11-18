import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

ProductType = Literal["FINISHED", "SEMI_FINISHED"]


class ProductBase(BaseModel):
    product_code: str = Field(..., min_length=2, max_length=30, description="Unique product identifier code")
    name: str = Field(..., min_length=2, max_length=120, description="Product descriptive name")
    description: Optional[str] = Field(None, max_length=500)
    product_type: ProductType = Field("FINISHED", description="Classification: FINISHED or SEMI_FINISHED")
    unit_of_measure: str = Field("EA", min_length=1, max_length=20, description="Unit of measure (default EA)")
    lead_time_days: int = Field(default=0, ge=0, le=3650, description="Production lead time in days (0-3650)")
    is_active: bool = Field(default=True, description="Active status flag")

    @field_validator("product_code", mode="before")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().upper()
            if not v:
                raise ValueError("Product code cannot be blank")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Product name cannot be blank")
        return v

    @field_validator("unit_of_measure", mode="before")
    @classmethod
    def normalize_uom(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().upper()
            if not v:
                raise ValueError("Unit of measure cannot be blank")
        return v


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_code: Optional[str] = Field(None, min_length=2, max_length=30)
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    product_type: Optional[ProductType] = None
    unit_of_measure: Optional[str] = Field(None, min_length=1, max_length=20)
    lead_time_days: Optional[int] = Field(None, ge=0, le=3650)
    is_active: Optional[bool] = None

    @field_validator("product_code", mode="before")
    @classmethod
    def normalize_update_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not v:
                raise ValueError("Product code cannot be blank")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_update_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Product name cannot be blank")
        return v

    @field_validator("unit_of_measure", mode="before")
    @classmethod
    def normalize_update_uom(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not v:
                raise ValueError("Unit of measure cannot be blank")
        return v


class ProductRead(ProductBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

