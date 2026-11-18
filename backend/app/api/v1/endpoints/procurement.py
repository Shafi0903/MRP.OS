import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.procurement import (
    PurchaseOrderCreate,
    PurchaseOrderFromProposals,
    PurchaseOrderTransition,
    PurchaseOrderRead,
    GoodsReceiptCreate,
    GoodsReceiptRead,
    PurchaseOrderStatusHistoryRead,
)
from app.services.procurement_service import ProcurementService

router = APIRouter()


@router.post("/purchase-orders", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.create_po(payload)


@router.post("/purchase-orders/from-proposals", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED)
def create_po_from_proposals(
    payload: PurchaseOrderFromProposals,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.create_po_from_proposals(payload)


@router.get("/purchase-orders", response_model=List[PurchaseOrderRead])
def list_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.list_pos(status=status, supplier_id=supplier_id, skip=skip, limit=limit)


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderRead)
def get_purchase_order(
    po_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.get_po(po_id)


@router.post("/purchase-orders/{po_id}/transitions", response_model=PurchaseOrderRead)
def transition_purchase_order(
    po_id: uuid.UUID,
    payload: PurchaseOrderTransition,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.transition_po(po_id, payload)


@router.post("/purchase-orders/{po_id}/receipts", response_model=GoodsReceiptRead, status_code=status.HTTP_201_CREATED)
def post_goods_receipt(
    po_id: uuid.UUID,
    payload: GoodsReceiptCreate,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.post_goods_receipt(po_id, payload)


@router.get("/purchase-orders/{po_id}/history", response_model=List[PurchaseOrderStatusHistoryRead])
def list_po_history(
    po_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.list_history(po_id)


@router.get("/goods-receipts", response_model=List[GoodsReceiptRead])
def list_goods_receipts(
    po_id: Optional[uuid.UUID] = None,
    supplier_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = ProcurementService(db)
    return service.list_receipts(po_id=po_id, supplier_id=supplier_id, skip=skip, limit=limit)

