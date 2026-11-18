import math
import uuid
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate
from app.repositories.product_repository import ProductRepository
from app.core.errors import NotFoundException, ConflictException, ValidationException


class ProductService:
    def __init__(self, repository: Optional[ProductRepository] = None):
        self.repository = repository or ProductRepository()

    def create(self, db: Session, schema: ProductCreate) -> Product:
        normalized_code = schema.product_code.strip().upper()
        existing = self.repository.get_by_code(db, normalized_code)
        if existing:
            raise ConflictException(
                message=f"Product with code '{normalized_code}' already exists",
                code="DUPLICATE_CODE",
                details={"product_code": normalized_code},
            )

        data = schema.model_dump()
        data["product_code"] = normalized_code
        product = Product(**data)

        self.repository.create(db, product)
        db.commit()
        db.refresh(product)
        return product

    def get_by_id(self, db: Session, product_id: uuid.UUID) -> Product:
        product = self.repository.get_by_id(db, product_id)
        if not product:
            raise NotFoundException(
                message=f"Product with ID '{product_id}' not found",
                details={"id": str(product_id)},
            )
        return product

    def list(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        product_type: Optional[str] = None,
        sort_by: str = "product_code",
        sort_order: str = "asc",
    ) -> Tuple[List[Product], int, int]:
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
            product_type=product_type,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        pages = math.ceil(total / page_size) if total > 0 else 0
        return items, total, pages

    def update(self, db: Session, product_id: uuid.UUID, schema: ProductUpdate) -> Product:
        product = self.get_by_id(db, product_id)
        update_data = schema.model_dump(exclude_unset=True)

        if "product_code" in update_data and update_data["product_code"]:
            normalized_code = update_data["product_code"].strip().upper()
            if normalized_code != product.product_code:
                existing = self.repository.get_by_code(db, normalized_code)
                if existing and existing.id != product_id:
                    raise ConflictException(
                        message=f"Product with code '{normalized_code}' already exists",
                        code="DUPLICATE_CODE",
                        details={"product_code": normalized_code},
                    )
            update_data["product_code"] = normalized_code

        for key, value in update_data.items():
            setattr(product, key, value)

        self.repository.update(db, product)
        db.commit()
        db.refresh(product)
        return product

    def delete(self, db: Session, product_id: uuid.UUID, hard_delete: bool = False) -> None:
        product = self.get_by_id(db, product_id)
        if hard_delete:
            self.repository.delete(db, product)
        else:
            product.is_active = False
            self.repository.update(db, product)
        db.commit()

