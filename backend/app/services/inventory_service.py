import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.inventory import InventoryBalance, InventoryTransaction
from app.models.material import Material
from app.schemas.inventory import (
    InventoryTransactionCreate,
    InventoryBalanceRead,
    InventoryTransactionRead,
)
from app.repositories.inventory_repository import InventoryRepository
from app.services.sequence_service import generate_document_code
from app.core.errors import NotFoundException, ValidationException


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class InventoryService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = InventoryRepository(session)

    def _format_balance_read(self, bal: InventoryBalance) -> InventoryBalanceRead:
        mat = bal.material
        return InventoryBalanceRead(
            id=bal.id,
            material_id=bal.material_id,
            material_code=mat.material_code if mat else None,
            material_name=mat.name if mat else None,
            unit_of_measure=mat.unit_of_measure if mat else None,
            standard_cost=mat.standard_cost if mat else None,
            on_hand_quantity=bal.on_hand_quantity,
            reserved_quantity=bal.reserved_quantity,
            available_quantity=bal.available_quantity,
            safety_stock=mat.safety_stock if mat else None,
            reorder_point=mat.reorder_point if mat else None,
            last_reconciled_at=bal.last_reconciled_at,
        )

    def _format_transaction_read(self, txn: InventoryTransaction) -> InventoryTransactionRead:
        mat = txn.material
        return InventoryTransactionRead(
            id=txn.id,
            transaction_code=txn.transaction_code,
            material_id=txn.material_id,
            material_code=mat.material_code if mat else None,
            transaction_type=txn.transaction_type,
            quantity=txn.quantity,
            unit_of_measure=txn.unit_of_measure,
            reference_type=txn.reference_type,
            reference_id=txn.reference_id,
            notes=txn.notes,
            occurred_at=txn.occurred_at,
            created_at=txn.created_at,
        )

    def record_transaction(
        self,
        payload: InventoryTransactionCreate,
        commit: bool = True,
    ) -> InventoryTransaction:
        material = self.session.get(Material, payload.material_id)
        if not material:
            raise NotFoundException(message=f"Material {payload.material_id} not found")

        if payload.unit_of_measure != material.unit_of_measure:
            raise ValidationException(
                message=f"Transaction UOM '{payload.unit_of_measure}' does not match material UOM '{material.unit_of_measure}'",
                details={"material_uom": material.unit_of_measure, "provided_uom": payload.unit_of_measure},
            )

        balance = self.repo.get_or_create_balance(payload.material_id)

        # Mutate balance based on transaction type
        if payload.transaction_type == "RECEIPT":
            balance.on_hand_quantity += payload.quantity
        elif payload.transaction_type == "ISSUE":
            if balance.on_hand_quantity < payload.quantity:
                raise ValidationException(
                    message=f"Insufficient inventory on hand for issue ({balance.on_hand_quantity} < {payload.quantity})",
                    details={"on_hand": str(balance.on_hand_quantity), "requested": str(payload.quantity)},
                )
            balance.on_hand_quantity -= payload.quantity
        elif payload.transaction_type == "RESERVATION":
            if balance.available_quantity < payload.quantity:
                raise ValidationException(
                    message=f"Insufficient available inventory for reservation ({balance.available_quantity} < {payload.quantity})",
                    details={"available": str(balance.available_quantity), "requested": str(payload.quantity)},
                )
            balance.reserved_quantity += payload.quantity
        elif payload.transaction_type == "RELEASE":
            if balance.reserved_quantity < payload.quantity:
                raise ValidationException(
                    message=f"Cannot release more than reserved ({balance.reserved_quantity} < {payload.quantity})",
                    details={"reserved": str(balance.reserved_quantity), "requested": str(payload.quantity)},
                )
            balance.reserved_quantity -= payload.quantity
        elif payload.transaction_type == "ADJUSTMENT":
            balance.on_hand_quantity = payload.quantity

        balance.available_quantity = balance.on_hand_quantity - balance.reserved_quantity
        balance.last_reconciled_at = utc_now()

        txn_code = generate_document_code(self.session, "ITX")
        txn = InventoryTransaction(
            transaction_code=txn_code,
            material_id=payload.material_id,
            transaction_type=payload.transaction_type,
            quantity=payload.quantity,
            unit_of_measure=payload.unit_of_measure,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            notes=payload.notes,
            occurred_at=utc_now(),
        )
        self.repo.create_transaction(txn)

        if commit:
            self.session.commit()
            self.session.refresh(txn)

        return txn

    def get_balance(self, material_id: uuid.UUID) -> InventoryBalanceRead:
        bal = self.repo.get_balance_by_material(material_id)
        if not bal:
            material = self.session.get(Material, material_id)
            if not material:
                raise NotFoundException(message=f"Material {material_id} not found")
            self.repo.get_or_create_balance(material_id)
            self.session.commit()
            bal = self.repo.get_balance_by_material(material_id)
        return self._format_balance_read(bal)

    def list_balances(self, skip: int = 0, limit: int = 100) -> List[InventoryBalanceRead]:
        balances = self.repo.list_balances(skip=skip, limit=limit)
        return [self._format_balance_read(b) for b in balances]

    def list_transactions(
        self,
        material_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[InventoryTransactionRead]:
        txns = self.repo.list_transactions(material_id=material_id, skip=skip, limit=limit)
        return [self._format_transaction_read(t) for t in txns]
