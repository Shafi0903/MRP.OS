import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.deps import get_material_service
from app.services.material_service import MaterialService
from app.schemas.material import MaterialCreate, MaterialUpdate, MaterialRead
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/materials", tags=["Materials"])


@router.post(
    "",
    response_model=MaterialRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new material",
)
def create_material(
    material_in: MaterialCreate,
    db: Session = Depends(get_db),
    service: MaterialService = Depends(get_material_service),
) -> MaterialRead:
    """Create a new material record with unique material code and non-negative unit cost."""
    return service.create(db=db, schema=material_in)


@router.get(
    "",
    response_model=PaginatedResponse[MaterialRead],
    status_code=status.HTTP_200_OK,
    summary="List materials with pagination and filters",
)
def list_materials(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for code, name, or description"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    material_type: Optional[str] = Query(None, description="Filter by material type"),
    sort_by: str = Query("material_code", description="Field to sort by"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$", description="Sort order"),
    db: Session = Depends(get_db),
    service: MaterialService = Depends(get_material_service),
) -> PaginatedResponse[MaterialRead]:
    """Retrieve a paginated list of materials matching query parameters."""
    items, total, pages = service.list(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
        category=category,
        material_type=material_type,
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


@router.get(
    "/{material_id}",
    response_model=MaterialRead,
    status_code=status.HTTP_200_OK,
    summary="Get a material by ID",
)
def get_material(
    material_id: uuid.UUID,
    db: Session = Depends(get_db),
    service: MaterialService = Depends(get_material_service),
) -> MaterialRead:
    """Retrieve details of a single material by its UUID."""
    return service.get_by_id(db=db, material_id=material_id)


@router.patch(
    "/{material_id}",
    response_model=MaterialRead,
    status_code=status.HTTP_200_OK,
    summary="Partially update a material",
)
def update_material(
    material_id: uuid.UUID,
    material_in: MaterialUpdate,
    db: Session = Depends(get_db),
    service: MaterialService = Depends(get_material_service),
) -> MaterialRead:
    """Update fields of an existing material."""
    return service.update(db=db, material_id=material_id, schema=material_in)


@router.delete(
    "/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete or deactivate a material",
)
def delete_material(
    material_id: uuid.UUID,
    hard_delete: bool = Query(False, description="If true, permanently remove record; otherwise deactivate"),
    db: Session = Depends(get_db),
    service: MaterialService = Depends(get_material_service),
) -> None:
    """Deactivate or remove a material record."""
    service.delete(db=db, material_id=material_id, hard_delete=hard_delete)
