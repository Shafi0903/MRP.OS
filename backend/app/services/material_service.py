import math
import uuid
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.material import Material
from app.schemas.material import MaterialCreate, MaterialUpdate
from app.repositories.material_repository import MaterialRepository
from app.core.errors import NotFoundException, ConflictException, ValidationException


class MaterialService:
    def __init__(self, repository: Optional[MaterialRepository] = None):
        self.repository = repository or MaterialRepository()

    def create(self, db: Session, schema: MaterialCreate) -> Material:
        normalized_code = schema.material_code.strip().upper()
        existing = self.repository.get_by_code(db, normalized_code)
        if existing:
            raise ConflictException(
                message=f"Material with code '{normalized_code}' already exists",
                code="DUPLICATE_CODE",
                details={"material_code": normalized_code},
            )

        material_data = schema.model_dump()
        material_data["material_code"] = normalized_code
        material = Material(**material_data)

        self.repository.create(db, material)
        db.commit()
        db.refresh(material)
        return material

    def get_by_id(self, db: Session, material_id: uuid.UUID) -> Material:
        material = self.repository.get_by_id(db, material_id)
        if not material:
            raise NotFoundException(
                message=f"Material with ID '{material_id}' not found",
                details={"id": str(material_id)},
            )
        return material

    def list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        material_type: Optional[str] = None,
        sort_by: str = "material_code",
        sort_order: str = "asc",
    ) -> Tuple[List[Material], int, int]:
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
            category=category,
            material_type=material_type,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        pages = math.ceil(total / page_size) if total > 0 else 0
        return items, total, pages

    def update(self, db: Session, material_id: uuid.UUID, schema: MaterialUpdate) -> Material:
        material = self.get_by_id(db, material_id)

        update_data = schema.model_dump(exclude_unset=True)

        if "material_code" in update_data and update_data["material_code"]:
            normalized_code = update_data["material_code"].strip().upper()
            if normalized_code != material.material_code:
                existing = self.repository.get_by_code(db, normalized_code)
                if existing and existing.id != material_id:
                    raise ConflictException(
                        message=f"Material with code '{normalized_code}' already exists",
                        code="DUPLICATE_CODE",
                        details={"material_code": normalized_code},
                    )
            update_data["material_code"] = normalized_code

        for key, value in update_data.items():
            setattr(material, key, value)

        self.repository.update(db, material)
        db.commit()
        db.refresh(material)
        return material

    def delete(self, db: Session, material_id: uuid.UUID, hard_delete: bool = False) -> None:
        material = self.get_by_id(db, material_id)

        if hard_delete:
            self.repository.delete(db, material)
        else:
            material.is_active = False
            self.repository.update(db, material)

        db.commit()

