from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import date
from app.domain.mrp.lot_sizing import calculate_lot_size
from app.domain.mrp.lead_time import calculate_lead_time_offset


def calculate_material_mrp(
    material_id: Any,
    initial_on_hand: Decimal,
    initial_reserved: Decimal,
    safety_stock: Decimal,
    lead_time_days: int,
    lot_sizing_policy: str,
    fixed_lot_size: Optional[Decimal],
    minimum_order_qty: Optional[Decimal],
    periods: List[Dict[str, Any]],
    gross_requirements: Dict[int, Decimal],
    scheduled_receipts: Dict[int, Decimal],
    period_type: str = "WEEKLY",
) -> Dict[str, Any]:
    """
    Time-phased MRP calculation for a single material across the planning horizon.
    """
    initial_available = max(Decimal("0.0000"), initial_on_hand - initial_reserved)
    pab = initial_available

    period_results = []
    proposals = []

    for p in periods:
        p_idx = p["period_index"]
        p_date = p["start_date"]

        gr = gross_requirements.get(p_idx, Decimal("0.0000"))
        sr = scheduled_receipts.get(p_idx, Decimal("0.0000"))

        pab_before = pab
        balance = pab_before + sr

        # Net requirements: max(0, GR + SS - balance)
        net_req = max(Decimal("0.0000"), gr + safety_stock - balance)

        # Apply lot sizing
        if net_req > Decimal("0.0000"):
            porc = calculate_lot_size(
                net_requirement=net_req,
                lot_sizing_policy=lot_sizing_policy,
                fixed_lot_size=fixed_lot_size,
                minimum_order_qty=minimum_order_qty,
            )
        else:
            porc = Decimal("0.0000")

        # Projected available after
        pab_after = balance + porc - gr
        pab = pab_after

        # Lead time offset
        rel_period_idx = None
        rel_date = None
        prop_status = "NORMAL"

        if porc > Decimal("0.0000"):
            rel_period_idx, rel_date, prop_status = calculate_lead_time_offset(
                receipt_period_index=p_idx,
                receipt_date=p_date,
                lead_time_days=lead_time_days,
                periods=periods,
                period_type=period_type,
            )
            proposals.append({
                "material_id": material_id,
                "proposal_type": "PURCHASE",
                "quantity": porc,
                "release_date": rel_date,
                "receipt_date": p_date,
                "release_period_index": rel_period_idx,
                "receipt_period_index": p_idx,
                "status": "PAST_DUE" if prop_status == "PAST_DUE" else "OPEN",
            })

        period_results.append({
            "material_id": material_id,
            "period_index": p_idx,
            "period_start_date": p_date,
            "gross_requirements": gr,
            "scheduled_receipts": sr,
            "projected_available_before": pab_before,
            "net_requirements": net_req,
            "planned_order_receipt_qty": porc,
            "projected_available_after": pab_after,
            "safety_stock": safety_stock,
            "lead_time_periods": lead_time_days if period_type == "DAILY" else (lead_time_days + 6) // 7,
            "planned_order_release_date": rel_date,
            "planned_order_receipt_date": p_date if porc > 0 else None,
            "proposal_status": prop_status if porc > 0 else "NORMAL",
            "explanation": {
                "initial_available": str(initial_available),
                "pab_before": str(pab_before),
                "sr": str(sr),
                "gr": str(gr),
                "ss": str(safety_stock),
                "net_req": str(net_req),
                "porc": str(porc),
                "pab_after": str(pab_after),
            },
        })

    return {
        "material_id": material_id,
        "initial_available": initial_available,
        "results": period_results,
        "proposals": proposals,
    }

