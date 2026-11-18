from decimal import Decimal, ROUND_CEILING
from typing import Optional


def calculate_lot_size(
    net_requirement: Decimal,
    lot_sizing_policy: str = "LOT_FOR_LOT",
    fixed_lot_size: Optional[Decimal] = None,
    minimum_order_qty: Optional[Decimal] = None,
) -> Decimal:
    """
    Calculate planned order receipt quantity based on lot-sizing policy and minimum order quantity (MOQ).
    """
    if net_requirement <= Decimal("0.0000"):
        return Decimal("0.0000")

    policy_norm = lot_sizing_policy.upper()

    if policy_norm in ("FIXED", "FIXED_LOT_SIZE"):
        if fixed_lot_size and fixed_lot_size > Decimal("0.0000"):
            multiples = (net_requirement / fixed_lot_size).to_integral_value(rounding=ROUND_CEILING)
            planned_qty = multiples * fixed_lot_size
        else:
            planned_qty = net_requirement
    elif policy_norm in ("LOT_FOR_LOT", "L4L"):
        planned_qty = net_requirement
    elif policy_norm == "PERIOD":
        planned_qty = net_requirement
    else:
        planned_qty = net_requirement

    if minimum_order_qty and minimum_order_qty > Decimal("0.0000"):
        planned_qty = max(planned_qty, minimum_order_qty)

    return planned_qty.quantize(Decimal("0.0001"))

