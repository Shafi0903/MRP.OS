import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.mrp import (
    MrpRunCreate,
    MrpRunRead,
    MrpProposalRead,
)
from app.services.mrp_service import MrpService

router = APIRouter()


@router.post("/runs", response_model=MrpRunRead, status_code=status.HTTP_201_CREATED)
def trigger_mrp_run(
    payload: MrpRunCreate,
    db: Session = Depends(get_db),
):
    service = MrpService(db)
    return service.run_mrp(payload)


@router.get("/runs", response_model=List[MrpRunRead])
def list_mrp_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = MrpService(db)
    return service.list_runs(skip=skip, limit=limit)


@router.get("/runs/{run_id}", response_model=MrpRunRead)
def get_mrp_run(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    service = MrpService(db)
    return service.get_run(run_id)


@router.get("/proposals", response_model=List[MrpProposalRead])
def list_mrp_proposals(
    mrp_run_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    proposal_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    service = MrpService(db)
    return service.list_proposals(
        mrp_run_id=mrp_run_id,
        status=status,
        proposal_type=proposal_type,
        skip=skip,
        limit=limit,
    )

