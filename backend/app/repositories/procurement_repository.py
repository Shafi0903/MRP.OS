import uuid
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.procurement import (
    PurchaseOrder,
    PurchaseOrderItem,
    GoodsReceipt,
    GoodsReceiptItem,
)


class ProcurementRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_po_by_id(self, po_id: uuid.UUID) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .where(PurchaseOrder.id == po_id)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.material),
                selectinload(PurchaseOrder.status_history),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_po_by_id_for_update(self, po_id: uuid.UUID) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .where(PurchaseOrder.id == po_id)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.material),
                selectinload(PurchaseOrder.status_history),
            )
            .with_for_update()
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_pos(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[PurchaseOrder]:
        stmt = (
            select(PurchaseOrder)
            .options(
                selectinload(PurchaseOrder.supplier),
                selectinload(PurchaseOrder.items).selectinload(PurchaseOrderItem.material),
            )
            .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.po_number.desc())
        )
        if status:
            stmt = stmt.where(PurchaseOrder.status == status)
        if supplier_id:
            stmt = stmt.where(PurchaseOrder.supplier_id == supplier_id)

        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def get_receipt_by_id(self, receipt_id: uuid.UUID) -> Optional[GoodsReceipt]:
        stmt = (
            select(GoodsReceipt)
            .where(GoodsReceipt.id == receipt_id)
            .options(
                selectinload(GoodsReceipt.supplier),
                selectinload(GoodsReceipt.items).selectinload(GoodsReceiptItem.material),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_receipt_by_idempotency_key(self, key: str) -> Optional[GoodsReceipt]:
        stmt = (
            select(GoodsReceipt)
            .where(GoodsReceipt.idempotency_key == key)
            .options(
                selectinload(GoodsReceipt.supplier),
                selectinload(GoodsReceipt.items).selectinload(GoodsReceiptItem.material),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_receipts(
        self,
        po_id: Optional[uuid.UUID] = None,
        supplier_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[GoodsReceipt]:
        stmt = (
            select(GoodsReceipt)
            .options(
                selectinload(GoodsReceipt.supplier),
                selectinload(GoodsReceipt.items).selectinload(GoodsReceiptItem.material),
            )
            .order_by(GoodsReceipt.created_at.desc())
        )
        if po_id:
            stmt = stmt.where(GoodsReceipt.purchase_order_id == po_id)
        if supplier_id:
            stmt = stmt.where(GoodsReceipt.supplier_id == supplier_id)

        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

