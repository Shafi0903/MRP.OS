import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderTransition,
    ProductionOrderProgress,
    ProductionOrderRead,
    ProductionOrderStatusHistoryRead,
)
from app.services.production_service import ProductionService

router = APIRouter()


@router.post("", response_model=ProductionOrderRead, status_code=status.HTTP_201_CREATED)
def create_production_order(
    payload: ProductionOrderCreate,
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.create_order(payload)


@router.get("", response_model=List[ProductionOrderRead])
def list_production_orders(
    status: Optional[str] = None,
    product_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.list_orders(status=status, product_id=product_id, skip=skip, limit=limit)


@router.get("/{order_id}", response_model=ProductionOrderRead)
def get_production_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.get_order(order_id)


@router.post("/{order_id}/transitions", response_model=ProductionOrderRead)
def transition_production_order(
    order_id: uuid.UUID,
    payload: ProductionOrderTransition,
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.transition_order(order_id, payload)


@router.post("/{order_id}/progress", response_model=ProductionOrderRead)
def record_production_progress(
    order_id: uuid.UUID,
    payload: ProductionOrderProgress,
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.record_progress(order_id, payload)


@router.get("/{order_id}/history", response_model=List[ProductionOrderStatusHistoryRead])
def list_production_order_history(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = ProductionService(db)
    return service.list_history(order_id)

