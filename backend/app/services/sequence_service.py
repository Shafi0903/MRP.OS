from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.sequence import DocumentSequence


def generate_document_code(session: Session, prefix: str, year: int | None = None) -> str:
    """
    Generate sequential document code: {prefix}-{year}-{NNNNNN}
    Thread-safe / transaction-safe allocation using row lock where supported.
    """
    if year is None:
        year = datetime.now(timezone.utc).year

    # Attempt to lock or fetch existing sequence row
    stmt = (
        select(DocumentSequence)
        .where(DocumentSequence.prefix == prefix, DocumentSequence.year == year)
        .with_for_update()
    )
    seq = session.execute(stmt).scalar_one_or_none()

    if not seq:
        seq = DocumentSequence(prefix=prefix, year=year, last_value=1)
        session.add(seq)
        session.flush()
        val = 1
    else:
        seq.last_value += 1
        session.flush()
        val = seq.last_value

    return f"{prefix}-{year}-{val:06d}"

