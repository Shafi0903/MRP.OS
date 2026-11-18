import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.production import ProductionOrder, ProductionOrderStatusHistory


class ProductionRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, order_id: uuid.UUID) -> Optional[ProductionOrder]:
        stmt = (
            select(ProductionOrder)
            .where(ProductionOrder.id == order_id)
            .options(
                selectinload(ProductionOrder.product),
                selectinload(ProductionOrder.bom_header),
                selectinload(ProductionOrder.status_history),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_id_for_update(self, order_id: uuid.UUID) -> Optional[ProductionOrder]:
        stmt = (
            select(ProductionOrder)
            .where(ProductionOrder.id == order_id)
            .options(
                selectinload(ProductionOrder.product),
                selectinload(ProductionOrder.bom_header),
                selectinload(ProductionOrder.status_history),
            )
            .with_for_update()
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_orders(
        self,
        status: Optional[str] = None,
        product_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ProductionOrder]:
        stmt = (
            select(ProductionOrder)
            .options(
                selectinload(ProductionOrder.product),
                selectinload(ProductionOrder.bom_header),
            )
            .order_by(ProductionOrder.due_date.asc(), ProductionOrder.order_code.asc())
        )
        if status:
            stmt = stmt.where(ProductionOrder.status == status)
        if product_id:
            stmt = stmt.where(ProductionOrder.product_id == product_id)

        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def create(self, order: ProductionOrder) -> ProductionOrder:
        self.session.add(order)
        self.session.flush()
        return order

    def delete(self, order: ProductionOrder) -> None:
        self.session.delete(order)
        self.session.flush()

