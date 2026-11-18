import math
import uuid
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierUpdate
from app.repositories.supplier_repository import SupplierRepository
from app.core.errors import NotFoundException, ConflictException, ValidationException


class SupplierService:
    def __init__(self, repository: Optional[SupplierRepository] = None):
        self.repository = repository or SupplierRepository()

    def create(self, db: Session, schema: SupplierCreate) -> Supplier:
        normalized_code = schema.supplier_code.strip().upper()
        existing = self.repository.get_by_code(db, normalized_code)
        if existing:
            raise ConflictException(
                message=f"Supplier with code '{normalized_code}' already exists",
                code="DUPLICATE_CODE",
                details={"supplier_code": normalized_code},
            )

        data = schema.model_dump()
        data["supplier_code"] = normalized_code
        supplier = Supplier(**data)

        self.repository.create(db, supplier)
        db.commit()
        db.refresh(supplier)
        return supplier

    def get_by_id(self, db: Session, supplier_id: uuid.UUID) -> Supplier:
        supplier = self.repository.get_by_id(db, supplier_id)
        if not supplier:
            raise NotFoundException(
                message=f"Supplier with ID '{supplier_id}' not found",
                details={"id": str(supplier_id)},
            )
        return supplier

    def list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> Tuple[List[Supplier], int, int]:
        if page < 1:
            raise ValidationException("Page must be >= 1")
        if page_size < 1 or page_size > 100:
            raise ValidationException("Page size must be between 1 and 100")

        skip = (page - 1) * page_size
        items, total = self.repository.list(
            db=db,
            skip=skip,
            limit=page_size,
            search=search,
            is_active=is_active,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        pages = math.ceil(total / page_size) if total > 0 else 0
        return items, total, pages

    def update(self, db: Session, supplier_id: uuid.UUID, schema: SupplierUpdate) -> Supplier:
        supplier = self.get_by_id(db, supplier_id)
        update_data = schema.model_dump(exclude_unset=True)

        if "supplier_code" in update_data and update_data["supplier_code"]:
            normalized_code = update_data["supplier_code"].strip().upper()
            if normalized_code != supplier.supplier_code:
                existing = self.repository.get_by_code(db, normalized_code)
                if existing and existing.id != supplier_id:
                    raise ConflictException(
                        message=f"Supplier with code '{normalized_code}' already exists",
                        code="DUPLICATE_CODE",
                        details={"supplier_code": normalized_code},
                    )
            update_data["supplier_code"] = normalized_code

        for key, value in update_data.items():
            setattr(supplier, key, value)

        self.repository.update(db, supplier)
        db.commit()
        db.refresh(supplier)
        return supplier

    def delete(self, db: Session, supplier_id: uuid.UUID, hard_delete: bool = False) -> None:
        supplier = self.get_by_id(db, supplier_id)
        if hard_delete:
            self.repository.delete(db, supplier)
        else:
            supplier.is_active = False
            self.repository.update(db, supplier)
        db.commit()

