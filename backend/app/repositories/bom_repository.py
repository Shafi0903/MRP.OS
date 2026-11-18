import uuid
from datetime import date
from typing import Optional, List
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session, selectinload
from app.models.bom import BomHeader, BomItem


class BomRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, bom_id: uuid.UUID) -> Optional[BomHeader]:
        stmt = (
            select(BomHeader)
            .where(BomHeader.id == bom_id)
            .options(
                selectinload(BomHeader.product),
                selectinload(BomHeader.items).selectinload(BomItem.material),
                selectinload(BomHeader.items).selectinload(BomItem.child_product),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_code(self, bom_code: str) -> Optional[BomHeader]:
        stmt = (
            select(BomHeader)
            .where(BomHeader.bom_code == bom_code)
            .options(
                selectinload(BomHeader.product),
                selectinload(BomHeader.items).selectinload(BomItem.material),
                selectinload(BomHeader.items).selectinload(BomItem.child_product),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_active_bom_for_product(self, product_id: uuid.UUID, on_date: Optional[date] = None) -> Optional[BomHeader]:
        if on_date is None:
            on_date = date.today()

        stmt = (
            select(BomHeader)
            .where(
                BomHeader.product_id == product_id,
                BomHeader.is_active == True,
                or_(BomHeader.effective_from == None, BomHeader.effective_from <= on_date),
                or_(BomHeader.effective_to == None, BomHeader.effective_to >= on_date),
            )
            .options(
                selectinload(BomHeader.product),
                selectinload(BomHeader.items).selectinload(BomItem.material),
                selectinload(BomHeader.items).selectinload(BomItem.child_product),
            )
            .order_by(BomHeader.created_at.desc())
        )
        return self.session.execute(stmt).scalars().first()

    def list_all(
        self,
        product_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[BomHeader]:
        stmt = (
            select(BomHeader)
            .options(
                selectinload(BomHeader.product),
                selectinload(BomHeader.items).selectinload(BomItem.material),
                selectinload(BomHeader.items).selectinload(BomItem.child_product),
            )
            .order_by(BomHeader.bom_code.asc())
        )
        if product_id:
            stmt = stmt.where(BomHeader.product_id == product_id)
        if is_active is not None:
            stmt = stmt.where(BomHeader.is_active == is_active)

        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def create(self, bom: BomHeader) -> BomHeader:
        self.session.add(bom)
        self.session.flush()
        return bom

    def delete(self, bom: BomHeader) -> None:
        self.session.delete(bom)
        self.session.flush()

