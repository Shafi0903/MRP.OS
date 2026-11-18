import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.bom import (
    BomHeaderCreate,
    BomHeaderRead,
    BomExplosionItem,
)
from app.services.bom_service import BomService

router = APIRouter()


@router.post("", response_model=BomHeaderRead, status_code=status.HTTP_201_CREATED)
def create_bom(
    payload: BomHeaderCreate,
    db: Session = Depends(get_db),
):
    service = BomService(db)
    return service.create_bom(payload)


@router.get("", response_model=List[BomHeaderRead])
def list_boms(
    product_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = BomService(db)
    return service.list_boms(product_id=product_id, is_active=is_active, skip=skip, limit=limit)


@router.get("/{bom_id}", response_model=BomHeaderRead)
def get_bom(
    bom_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = BomService(db)
    return service.get_bom(bom_id)


@router.get("/{bom_id}/explosion", response_model=List[BomExplosionItem])
def explode_bom(
    bom_id: uuid.UUID,
    quantity: Decimal = Query(Decimal("1.0"), gt=0, description="Parent production demand quantity"),
    db: Session = Depends(get_db),
):
    service = BomService(db)
    return service.explode_bom(bom_id, demand_quantity=quantity)

