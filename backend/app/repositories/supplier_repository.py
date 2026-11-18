import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, asc, desc
from sqlalchemy.orm import Session
from app.models.supplier import Supplier


class SupplierRepository:
    def get_by_id(self, db: Session, supplier_id: uuid.UUID) -> Optional[Supplier]:
        stmt = select(Supplier).where(Supplier.id == supplier_id)
        return db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, db: Session, supplier_code: str) -> Optional[Supplier]:
        stmt = select(Supplier).where(Supplier.supplier_code == supplier_code)
        return db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        sort_by: str = "name",
        sort_order: str = "asc",
    ) -> Tuple[List[Supplier], int]:
        query = select(Supplier)
        count_query = select(func.count()).select_from(Supplier)

        filters = []
        if search:
            term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Supplier.supplier_code.ilike(term),
                    Supplier.name.ilike(term),
                    Supplier.contact_person.ilike(term),
                    Supplier.email.ilike(term),
                )
            )

        if is_active is not None:
            filters.append(Supplier.is_active == is_active)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        total = db.execute(count_query).scalar_one()

        sort_col = getattr(Supplier, sort_by, Supplier.name)
        order_fn = desc if sort_order.lower() == "desc" else asc
        query = query.order_by(order_fn(sort_col))

        query = query.offset(skip).limit(limit)
        items = list(db.execute(query).scalars().all())

        return items, total

    def create(self, db: Session, supplier: Supplier) -> Supplier:
        db.add(supplier)
        db.flush()
        db.refresh(supplier)
        return supplier

    def update(self, db: Session, supplier: Supplier) -> Supplier:
        db.flush()
        db.refresh(supplier)
        return supplier

    def delete(self, db: Session, supplier: Supplier) -> None:
        db.delete(supplier)
        db.flush()

