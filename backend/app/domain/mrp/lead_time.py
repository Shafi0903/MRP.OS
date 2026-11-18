import math
from datetime import date, timedelta
from typing import Tuple, List, Dict, Any


def calculate_lead_time_offset(
    receipt_period_index: int,
    receipt_date: date,
    lead_time_days: int,
    periods: List[Dict[str, Any]],
    period_type: str = "WEEKLY",
) -> Tuple[int, date, str]:
    """
    Given receipt period and lead time days, calculate planned order release period and release date.
    Returns: (release_period_index, release_date, proposal_status)
    Statuses: 'NORMAL', 'PAST_DUE', 'OUTSIDE_HORIZON'
    """
    if lead_time_days <= 0:
        return (receipt_period_index, receipt_date, "NORMAL")

    release_date = receipt_date - timedelta(days=lead_time_days)

    if period_type.upper() == "DAILY":
        lead_time_periods = lead_time_days
    else:  # WEEKLY
        lead_time_periods = math.ceil(lead_time_days / 7.0)

    release_period_index = receipt_period_index - lead_time_periods

    if release_period_index < 0:
        status = "PAST_DUE"
    elif receipt_period_index >= len(periods):
        status = "OUTSIDE_HORIZON"
    else:
        status = "NORMAL"

    return (release_period_index, release_date, status)

