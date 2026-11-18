import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.product_service import ProductService
from app.schemas.product import ProductCreate, ProductUpdate, ProductRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/products", tags=["Products"])


def get_product_service() -> ProductService:
    return ProductService()


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    db: Session = Depends(get_db),
    service: ProductService = Depends(get_product_service),
) -> ProductRead:
    return service.create(db=db, schema=product_in)


@router.get("", response_model=PaginatedResponse[ProductRead], status_code=status.HTTP_200_OK)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    product_type: Optional[str] = Query(None),
    sort_by: str = Query("product_code"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    service: ProductService = Depends(get_product_service),
) -> PaginatedResponse[ProductRead]:
    items, total, pages = service.list(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
        product_type=product_type,
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


@router.get("/{product_id}", response_model=ProductRead)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: ProductService = Depends(get_product_service),
) -> ProductRead:
    return service.get_by_id(db=db, product_id=product_id)


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: uuid.UUID,
    product_in: ProductUpdate,
    db: Session = Depends(get_db),
    service: ProductService = Depends(get_product_service),
) -> ProductRead:
    return service.update(db=db, product_id=product_id, schema=product_in)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: uuid.UUID,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
    service: ProductService = Depends(get_product_service),
) -> None:
    service.delete(db=db, product_id=product_id, hard_delete=hard_delete)

