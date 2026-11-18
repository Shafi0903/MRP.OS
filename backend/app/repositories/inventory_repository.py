import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.inventory import InventoryBalance, InventoryTransaction


class InventoryRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_balance_by_material(self, material_id: uuid.UUID) -> Optional[InventoryBalance]:
        stmt = (
            select(InventoryBalance)
            .where(InventoryBalance.material_id == material_id)
            .options(selectinload(InventoryBalance.material))
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_or_create_balance(self, material_id: uuid.UUID) -> InventoryBalance:
        bal = self.get_balance_by_material(material_id)
        if not bal:
            bal = InventoryBalance(
                material_id=material_id,
            )
            self.session.add(bal)
            self.session.flush()
        return bal

    def list_balances(self, skip: int = 0, limit: int = 100) -> List[InventoryBalance]:
        stmt = (
            select(InventoryBalance)
            .options(selectinload(InventoryBalance.material))
            .offset(skip)
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())

    def create_transaction(self, txn: InventoryTransaction) -> InventoryTransaction:
        self.session.add(txn)
        self.session.flush()
        return txn

    def list_transactions(
        self,
        material_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[InventoryTransaction]:
        stmt = (
            select(InventoryTransaction)
            .options(selectinload(InventoryTransaction.material))
            .order_by(InventoryTransaction.occurred_at.desc())
        )
        if material_id:
            stmt = stmt.where(InventoryTransaction.material_id == material_id)
        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

