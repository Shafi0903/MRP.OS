from decimal import Decimal
from datetime import date
import pytest
from app.domain.mrp.calendar import generate_planning_periods
from app.domain.mrp.lot_sizing import calculate_lot_size
from app.domain.mrp.netting import calculate_material_mrp


def test_mrp_section_6_acceptance_fixture():
    """
    Direct verification of Section 6 numerical fixture from Documents/MRP_Engine.md
    """
    start_date = date(2026, 11, 16)
    periods = generate_planning_periods(start_date=start_date, horizon_periods=3, period_type="WEEKLY")

    gross_reqs = {
        0: Decimal("50.0000"),
        1: Decimal("70.0000"),
        2: Decimal("40.0000"),
    }
    scheduled_recs = {
        0: Decimal("0.0000"),
        1: Decimal("30.0000"),
        2: Decimal("0.0000"),
    }

    res = calculate_material_mrp(
        material_id="mat-fixture-01",
        initial_on_hand=Decimal("100.0000"),
        initial_reserved=Decimal("20.0000"),
        safety_stock=Decimal("10.0000"),
        lead_time_days=7,  # 1 weekly period
        lot_sizing_policy="LOT_FOR_LOT",
        fixed_lot_size=None,
        minimum_order_qty=None,
        periods=periods,
        gross_requirements=gross_reqs,
        scheduled_receipts=scheduled_recs,
        period_type="WEEKLY",
    )

    assert res["initial_available"] == Decimal("80.0000")
    period_results = res["results"]
    assert len(period_results) == 3

    # Period 0
    p0 = period_results[0]
    assert p0["projected_available_before"] == Decimal("80.0000")
    assert p0["net_requirements"] == Decimal("0.0000")
    assert p0["planned_order_receipt_qty"] == Decimal("0.0000")
    assert p0["projected_available_after"] == Decimal("30.0000")

    # Period 1
    p1 = period_results[1]
    assert p1["projected_available_before"] == Decimal("30.0000")
    assert p1["scheduled_receipts"] == Decimal("30.0000")
    assert p1["net_requirements"] == Decimal("20.0000")
    assert p1["planned_order_receipt_qty"] == Decimal("20.0000")
    assert p1["projected_available_after"] == Decimal("10.0000")

    # Period 2
    p2 = period_results[2]
    assert p2["projected_available_before"] == Decimal("10.0000")
    assert p2["scheduled_receipts"] == Decimal("0.0000")
    assert p2["net_requirements"] == Decimal("40.0000")
    assert p2["planned_order_receipt_qty"] == Decimal("40.0000")
    assert p2["projected_available_after"] == Decimal("10.0000")

    # Check Proposals
    proposals = res["proposals"]
    assert len(proposals) == 2

    # Proposal for Period 1 has release period 0
    prop1 = proposals[0]
    assert prop1["receipt_period_index"] == 1
    assert prop1["release_period_index"] == 0
    assert prop1["quantity"] == Decimal("20.0000")

    # Proposal for Period 2 has release period 1
    prop2 = proposals[1]
    assert prop2["receipt_period_index"] == 2
    assert prop2["release_period_index"] == 1
    assert prop2["quantity"] == Decimal("40.0000")


def test_lot_sizing_fixed_and_moq():
    # Fixed lot size = 50, Net requirement = 65 -> rounds up to 100
    res = calculate_lot_size(
        net_requirement=Decimal("65.0000"),
        lot_sizing_policy="FIXED",
        fixed_lot_size=Decimal("50.0000"),
        minimum_order_qty=Decimal("20.0000"),
    )
    assert res == Decimal("100.0000")

    # MOQ = 200, Net requirement = 10 -> min 200
    res2 = calculate_lot_size(
        net_requirement=Decimal("10.0000"),
        lot_sizing_policy="LOT_FOR_LOT",
        fixed_lot_size=None,
        minimum_order_qty=Decimal("200.0000"),
    )
    assert res2 == Decimal("200.0000")

