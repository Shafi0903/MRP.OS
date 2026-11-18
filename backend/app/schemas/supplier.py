import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, EmailStr


class SupplierBase(BaseModel):
    supplier_code: str = Field(..., min_length=2, max_length=30, description="Unique supplier identifier code")
    name: str = Field(..., min_length=2, max_length=150, description="Supplier business name")
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    address_line: Optional[str] = Field(None, max_length=250)
    city: Optional[str] = Field(None, max_length=100)
    state_region: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field("USA", max_length=100)
    payment_terms_days: Optional[int] = Field(None, ge=0, le=365, description="Net payment terms in days (0-365)")
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: bool = Field(default=True, description="Active status flag")

    @field_validator("supplier_code", mode="before")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip().upper()
            if not v:
                raise ValueError("Supplier code cannot be blank")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                raise ValueError("Supplier name cannot be blank")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and "@" not in v:
                raise ValueError("Invalid email format")
            if not v:
                return None
        return v


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    supplier_code: Optional[str] = Field(None, min_length=2, max_length=30)
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    contact_person: Optional[str] = Field(None, max_length=120)
    email: Optional[str] = Field(None, max_length=150)
    phone: Optional[str] = Field(None, max_length=30)
    address_line: Optional[str] = Field(None, max_length=250)
    city: Optional[str] = Field(None, max_length=100)
    state_region: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    payment_terms_days: Optional[int] = Field(None, ge=0, le=365)
    notes: Optional[str] = Field(None, max_length=1000)
    is_active: Optional[bool] = None

    @field_validator("supplier_code", mode="before")
    @classmethod
    def normalize_update_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip().upper()
            if not v:
                raise ValueError("Supplier code cannot be blank")
        return v

    @field_validator("name", mode="before")
    @classmethod
    def normalize_update_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Supplier name cannot be blank")
        return v

    @field_validator("email", mode="before")
    @classmethod
    def validate_update_email(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and "@" not in v:
                raise ValueError("Invalid email format")
            if not v:
                return None
        return v


class SupplierRead(SupplierBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

