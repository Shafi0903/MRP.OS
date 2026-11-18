import uuid
import json
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.mrp import MrpRun, MrpResult, MrpProposal
from app.models.material import Material
from app.models.product import Product
from app.models.inventory import InventoryBalance
from app.models.production import ProductionOrder
from app.models.procurement import PurchaseOrder, PurchaseOrderItem
from app.schemas.mrp import (
    MrpRunCreate,
    MrpRunRead,
    MrpResultRead,
    MrpProposalRead,
)
from app.domain.mrp.calendar import generate_planning_periods, map_date_to_period
from app.domain.mrp.netting import calculate_material_mrp
from app.repositories.mrp_repository import MrpRepository
from app.services.bom_service import BomService
from app.services.sequence_service import generate_document_code
from app.core.errors import NotFoundException


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MrpService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = MrpRepository(session)
        self.bom_service = BomService(session)

    def _format_proposal_read(self, prop: MrpProposal) -> MrpProposalRead:
        mat = prop.material
        cost = mat.standard_cost if mat else None
        total_cost = None
        if cost is not None:
            total_cost = (prop.quantity * cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        pref_sup_id = mat.preferred_supplier_id if mat else None
        pref_sup_name = mat.preferred_supplier.name if mat and mat.preferred_supplier else None

        return MrpProposalRead(
            id=prop.id,
            mrp_run_id=prop.mrp_run_id,
            material_id=prop.material_id,
            material_code=mat.material_code if mat else None,
            material_name=mat.name if mat else None,
            unit_of_measure=mat.unit_of_measure if mat else None,
            preferred_supplier_id=pref_sup_id,
            preferred_supplier_name=pref_sup_name,
            proposal_type=prop.proposal_type,
            quantity=prop.quantity,
            standard_cost=cost,
            total_cost=total_cost,
            release_date=prop.release_date,
            receipt_date=prop.receipt_date,
            release_period_index=prop.release_period_index,
            receipt_period_index=prop.receipt_period_index,
            status=prop.status,
            converted_po_item_id=prop.converted_po_item_id,
            created_at=prop.created_at,
        )

    def _format_run_read(self, run: MrpRun) -> MrpRunRead:
        proposals_count = len(run.proposals)
        shortage_count = sum(1 for p in run.proposals if p.status == "PAST_DUE")
        past_due_count = sum(1 for p in run.proposals if p.status == "PAST_DUE")
        unique_mats = len(set(r.material_id for r in run.results))

        return MrpRunRead(
            id=run.id,
            run_code=run.run_code,
            planning_start_date=run.planning_start_date,
            planning_horizon_periods=run.planning_horizon_periods,
            period_type=run.period_type,
            status=run.status,
            algorithm_version=run.algorithm_version,
            started_at=run.started_at,
            completed_at=run.completed_at,
            materials_planned_count=unique_mats,
            proposals_count=proposals_count,
            shortage_count=shortage_count,
            past_due_count=past_due_count,
            error_message=run.error_message,
        )

    def run_mrp(self, payload: MrpRunCreate) -> MrpRunRead:
        start_date = payload.planning_start_date or date.today()
        horizon = payload.planning_horizon_periods
        period_type = payload.period_type

        periods = generate_planning_periods(
            start_date=start_date,
            horizon_periods=horizon,
            period_type=period_type,
        )

        run_code = generate_document_code(self.session, "MRP")
        run = MrpRun(
            run_code=run_code,
            planning_start_date=start_date,
            planning_horizon_periods=horizon,
            period_type=period_type,
            status="RUNNING",
            started_at=utc_now(),
        )
        self.session.add(run)
        self.session.flush()

        # Step 1: Collect Demand Sources (Production Orders)
        prod_orders_stmt = select(ProductionOrder).where(
            ProductionOrder.status.in_(["PLANNED", "RELEASED", "IN_PROGRESS"])
        )
        if payload.production_order_ids:
            prod_orders_stmt = prod_orders_stmt.where(ProductionOrder.id.in_(payload.production_order_ids))
        prod_orders = list(self.session.execute(prod_orders_stmt).scalars().all())

        # Step 2: Explode Demand to Material Gross Requirements by Period
        gross_requirements_by_mat: Dict[uuid.UUID, Dict[int, Decimal]] = {}

        for po in prod_orders:
            # Map PO due date to period
            period_idx = map_date_to_period(po.due_date, periods)
            if period_idx is None or period_idx < 0 or period_idx >= horizon:
                continue

            # Explode BOM for product
            active_bom = self.bom_service.get_active_bom_for_product(po.product_id, po.planned_start_date)
            if active_bom:
                exploded_items = self.bom_service.explode_bom(active_bom.id, po.planned_quantity - po.completed_quantity)
                for item in exploded_items:
                    if item.item_type == "MATERIAL":
                        mat_id = item.item_id
                        if mat_id not in gross_requirements_by_mat:
                            gross_requirements_by_mat[mat_id] = {}
                        gross_requirements_by_mat[mat_id][period_idx] = (
                            gross_requirements_by_mat[mat_id].get(period_idx, Decimal("0.0000")) + item.effective_quantity
                        )

        # Step 3: Collect Scheduled Receipts (Open Purchase Orders)
        scheduled_receipts_by_mat: Dict[uuid.UUID, Dict[int, Decimal]] = {}
        po_items_stmt = (
            select(PurchaseOrderItem)
            .join(PurchaseOrder)
            .where(PurchaseOrder.status.in_(["APPROVED", "SENT", "PARTIALLY_RECEIVED"]))
        )
        open_po_items = list(self.session.execute(po_items_stmt).scalars().all())

        for poi in open_po_items:
            open_qty = max(Decimal("0.0000"), poi.ordered_quantity - poi.received_quantity)
            if open_qty > Decimal("0.0000"):
                p_idx = map_date_to_period(poi.expected_receipt_date, periods)
                if p_idx is not None and 0 <= p_idx < horizon:
                    mat_id = poi.material_id
                    if mat_id not in scheduled_receipts_by_mat:
                        scheduled_receipts_by_mat[mat_id] = {}
                    scheduled_receipts_by_mat[mat_id][p_idx] = (
                        scheduled_receipts_by_mat[mat_id].get(p_idx, Decimal("0.0000")) + open_qty
                    )

        # Step 4: Collect Inventory Balances
        balances_stmt = select(InventoryBalance)
        balances_map = {b.material_id: b for b in self.session.execute(balances_stmt).scalars().all()}

        # Step 5: Run Calculation for each active material
        materials = list(self.session.execute(select(Material).where(Material.is_active == True)).scalars().all())

        all_results = []
        all_proposals = []

        for mat in materials:
            gr_map = gross_requirements_by_mat.get(mat.id, {})
            sr_map = scheduled_receipts_by_mat.get(mat.id, {})
            bal = balances_map.get(mat.id)
            on_hand = bal.on_hand_quantity if bal else Decimal("0.0000")
            reserved = bal.reserved_quantity if bal else Decimal("0.0000")

            # Check if this material has any activity (demand, SR, or stock)
            if not gr_map and not sr_map and on_hand == 0:
                continue

            mat_calc = calculate_material_mrp(
                material_id=mat.id,
                initial_on_hand=on_hand,
                initial_reserved=reserved,
                safety_stock=mat.safety_stock or Decimal("0.0000"),
                lead_time_days=mat.lead_time_days or 0,
                lot_sizing_policy=mat.lot_sizing_rule or "LOT_FOR_LOT",
                fixed_lot_size=mat.fixed_lot_size,
                minimum_order_qty=mat.minimum_order_quantity,
                periods=periods,
                gross_requirements=gr_map,
                scheduled_receipts=sr_map,
                period_type=period_type,
            )

            for r in mat_calc["results"]:
                res_model = MrpResult(
                    mrp_run_id=run.id,
                    material_id=mat.id,
                    period_index=r["period_index"],
                    period_start_date=r["period_start_date"],
                    gross_requirements=r["gross_requirements"],
                    scheduled_receipts=r["scheduled_receipts"],
                    projected_available_before=r["projected_available_before"],
                    net_requirements=r["net_requirements"],
                    planned_order_receipt_qty=r["planned_order_receipt_qty"],
                    projected_available_after=r["projected_available_after"],
                    safety_stock=r["safety_stock"],
                    lead_time_periods=r["lead_time_periods"],
                    planned_order_release_date=r["planned_order_release_date"],
                    planned_order_receipt_date=r["planned_order_receipt_date"],
                    proposal_status=r["proposal_status"],
                    explanation_json=json.dumps(r["explanation"]),
                )
                self.session.add(res_model)
                all_results.append(res_model)

            for p in mat_calc["proposals"]:
                prop_model = MrpProposal(
                    mrp_run_id=run.id,
                    material_id=mat.id,
                    proposal_type=p["proposal_type"],
                    quantity=p["quantity"],
                    release_date=p["release_date"],
                    receipt_date=p["receipt_date"],
                    release_period_index=p["release_period_index"],
                    receipt_period_index=p["receipt_period_index"],
                    status=p["status"],
                )
                self.session.add(prop_model)
                all_proposals.append(prop_model)

        run.status = "COMPLETED"
        run.completed_at = utc_now()
        self.session.commit()

        return self._format_run_read(run)

    def get_run(self, run_id: uuid.UUID) -> MrpRunRead:
        run = self.repo.get_run(run_id)
        if not run:
            raise NotFoundException(message=f"MRP Run {run_id} not found")
        return self._format_run_read(run)

    def list_runs(self, skip: int = 0, limit: int = 50) -> List[MrpRunRead]:
        runs = self.repo.list_runs(skip=skip, limit=limit)
        return [self._format_run_read(r) for r in runs]

    def list_proposals(
        self,
        mrp_run_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        proposal_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[MrpProposalRead]:
        props = self.repo.list_proposals(
            mrp_run_id=mrp_run_id,
            status=status,
            proposal_type=proposal_type,
            skip=skip,
            limit=limit,
        )
        return [self._format_proposal_read(p) for p in props]

