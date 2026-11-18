import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.supplier_service import SupplierService
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


def get_supplier_service() -> SupplierService:
    return SupplierService()


@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
def create_supplier(
    supplier_in: SupplierCreate,
    db: Session = Depends(get_db),
    service: SupplierService = Depends(get_supplier_service),
) -> SupplierRead:
    return service.create(db=db, schema=supplier_in)


@router.get("", response_model=PaginatedResponse[SupplierRead], status_code=status.HTTP_200_OK)
def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    service: SupplierService = Depends(get_supplier_service),
) -> PaginatedResponse[SupplierRead]:
    items, total, pages = service.list(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{supplier_id}", response_model=SupplierRead)
def get_supplier(
    supplier_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: SupplierService = Depends(get_supplier_service),
) -> SupplierRead:
    return service.get_by_id(db=db, supplier_id=supplier_id)


@router.patch("/{supplier_id}", response_model=SupplierRead)
def update_supplier(
    supplier_id: uuid.UUID,
    supplier_in: SupplierUpdate,
    db: Session = Depends(get_db),
    service: SupplierService = Depends(get_supplier_service),
) -> SupplierRead:
    return service.update(db=db, supplier_id=supplier_id, schema=supplier_in)


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: uuid.UUID,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
    service: SupplierService = Depends(get_supplier_service),
) -> None:
    service.delete(db=db, supplier_id=supplier_id, hard_delete=hard_delete)

