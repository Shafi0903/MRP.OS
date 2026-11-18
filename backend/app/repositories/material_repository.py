import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, asc, desc
from sqlalchemy.orm import Session
from app.models.material import Material


class MaterialRepository:
    def get_by_id(self, db: Session, material_id: uuid.UUID) -> Optional[Material]:
        stmt = select(Material).where(Material.id == material_id)
        return db.execute(stmt).scalar_one_or_none()

    def get_by_code(self, db: Session, material_code: str) -> Optional[Material]:
        stmt = select(Material).where(Material.material_code == material_code)
        return db.execute(stmt).scalar_one_or_none()

    def list(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        is_active: Optional[bool] = None,
        category: Optional[str] = None,
        material_type: Optional[str] = None,
        sort_by: str = "material_code",
        sort_order: str = "asc",
    ) -> Tuple[List[Material], int]:
        query = select(Material)
        count_query = select(func.count()).select_from(Material)

        # Filters
        filters = []
        if search:
            search_term = f"%{search.strip()}%"
            filters.append(
                or_(
                    Material.material_code.ilike(search_term),
                    Material.name.ilike(search_term),
                    Material.description.ilike(search_term),
                )
            )

        if is_active is not None:
            filters.append(Material.is_active == is_active)

        if category:
            filters.append(Material.category == category)

        if material_type:
            filters.append(Material.material_type == material_type)

        if filters:
            query = query.where(*filters)
            count_query = count_query.where(*filters)

        total = db.execute(count_query).scalar_one()

        # Sorting
        sort_column = getattr(Material, sort_by, Material.material_code)
        order_fn = desc if sort_order.lower() == "desc" else asc
        query = query.order_by(order_fn(sort_column))

        # Pagination
        query = query.offset(skip).limit(limit)
        items = list(db.execute(query).scalars().all())

        return items, total

    def create(self, db: Session, material: Material) -> Material:
        db.add(material)
        db.flush()
        db.refresh(material)
        return material

    def update(self, db: Session, material: Material) -> Material:
        db.flush()
        db.refresh(material)
        return material

    def delete(self, db: Session, material: Material) -> None:
        db.delete(material)
        db.flush()

