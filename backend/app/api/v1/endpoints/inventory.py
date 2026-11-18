import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.inventory import (
    InventoryTransactionCreate,
    InventoryBalanceRead,
    InventoryTransactionRead,
)
from app.services.inventory_service import InventoryService

router = APIRouter()


@router.get("/balances", response_model=List[InventoryBalanceRead])
def list_balances(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    return service.list_balances(skip=skip, limit=limit)


@router.get("/balances/{material_id}", response_model=InventoryBalanceRead)
def get_balance(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    return service.get_balance(material_id)


@router.post("/transactions", response_model=InventoryTransactionRead, status_code=status.HTTP_201_CREATED)
def record_transaction(
    payload: InventoryTransactionCreate,
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    txn = service.record_transaction(payload, commit=True)
    return service._format_transaction_read(txn)


@router.get("/transactions", response_model=List[InventoryTransactionRead])
def list_transactions(
    material_id: Optional[uuid.UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = InventoryService(db)
    return service.list_transactions(material_id=material_id, skip=skip, limit=limit)

