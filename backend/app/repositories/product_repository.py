import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, asc, desc
from sqlalchemy.orm import Session
from app.models.product import Product


class ProductRepository:
    def get_by_id(self, db: Session, product_id: uuid.UUID) -> Optional[Product]:
        stmt = select(Product).where(Product.id == product_id)
        return db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, db: Session, product_code: str) -> Optional[Product]:
        stmt = select(Product).where(Product.product_code == product_code)
        return db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        product_type: Optional[str] = None,
        sort_by: str = "product_code",
        sort_order: str = "asc",
    ) -> Tuple[List[Product], int]:
        query = select(Product)
        count_query = select(func.count()).select_from(Product)

        filters = []
        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Product.product_code.ilike(term),
                    Product.name.ilike(term),
                    Product.description.ilike(term),
                )
            )

        if is_active is not None:
            filters.append(Product.is_active == is_active)

        if product_type:
            filters.append(Product.product_type == product_type)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        total = db.execute(count_query).scalar_one()

        sort_col = getattr(Product, sort_by, Product.product_code)
        order_fn = desc if sort_order.lower() == "desc" else asc
        query = query.order_by(order_fn(sort_col))

        query = query.offset(skip).limit(limit)
        items = list(db.execute(query).scalars().all())

        return items, total

    def create(self, db: Session, product: Product) -> Product:
        db.add(product)
        db.flush()
        db.refresh(product)
        return product

    def update(self, db: Session, product: Product) -> Product:
        db.flush()
        db.refresh(product)
        return product

    def delete(self, db: Session, product: Product) -> None:
        db.delete(product)
        db.flush()

