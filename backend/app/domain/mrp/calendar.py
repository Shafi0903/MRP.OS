from datetime import date, timedelta
from typing import List, Dict, Any


def generate_planning_periods(
    start_date: date,
    horizon_periods: int,
    period_type: str = "WEEKLY",
) -> List[Dict[str, Any]]:
    """
    Generate period buckets starting from start_date.
    Index: 0..N-1
    """
    periods = []
    current_date = start_date

    for idx in range(horizon_periods):
        if period_type.upper() == "DAILY":
            end_date = current_date
            next_date = current_date + timedelta(days=1)
        else:  # WEEKLY
            end_date = current_date + timedelta(days=6)
            next_date = current_date + timedelta(days=7)

        periods.append({
            "period_index": idx,
            "start_date": current_date,
            "end_date": end_date,
        })
        current_date = next_date

    return periods


def map_date_to_period(
    target_date: date,
    periods: List[Dict[str, Any]],
) -> int | None:
    """
    Find which period index contains target_date.
    Returns None if target_date is before period 0 or after last period.
    """
    if not periods:
        return None

    if target_date < periods[0]["start_date"]:
        return -1  # Past due / before horizon

    for p in periods:
        if p["start_date"] <= target_date <= p["end_date"]:
            return p["period_index"]

    if target_date > periods[-1]["end_date"]:
        return len(periods)  # Beyond horizon

    return None

