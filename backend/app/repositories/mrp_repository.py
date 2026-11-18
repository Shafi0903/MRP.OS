import uuid
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.models.mrp import MrpRun, MrpResult, MrpProposal
from app.models.material import Material


class MrpRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_run(self, run_id: uuid.UUID) -> Optional[MrpRun]:
        stmt = (
            select(MrpRun)
            .where(MrpRun.id == run_id)
            .options(
                selectinload(MrpRun.results).selectinload(MrpResult.material),
                selectinload(MrpRun.proposals).selectinload(MrpProposal.material).selectinload(Material.preferred_supplier),
            )
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_runs(self, skip: int = 0, limit: int = 50) -> List[MrpRun]:
        stmt = (
            select(MrpRun)
            .order_by(MrpRun.started_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())

    def create_run(self, run: MrpRun) -> MrpRun:
        self.session.add(run)
        self.session.flush()
        return run

    def list_proposals(
        self,
        mrp_run_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        proposal_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[MrpProposal]:
        stmt = (
            select(MrpProposal)
            .options(
                selectinload(MrpProposal.material).selectinload(Material.preferred_supplier)
            )
            .order_by(MrpProposal.release_date.asc())
        )
        if mrp_run_id:
            stmt = stmt.where(MrpProposal.mrp_run_id == mrp_run_id)
        if status:
            stmt = stmt.where(MrpProposal.status == status)
        if proposal_type:
            stmt = stmt.where(MrpProposal.proposal_type == proposal_type)

        stmt = stmt.offset(skip).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def get_proposals_for_update(self, proposal_ids: List[uuid.UUID]) -> List[MrpProposal]:
        stmt = (
            select(MrpProposal)
            .where(MrpProposal.id.in_(proposal_ids))
            .options(selectinload(MrpProposal.material))
            .with_for_update()
        )
        return list(self.session.execute(stmt).scalars().all())

