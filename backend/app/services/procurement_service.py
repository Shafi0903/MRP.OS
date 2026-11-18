import uuid
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.procurement import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatusHistory,
    GoodsReceipt,
    GoodsReceiptItem,
)
from app.models.supplier import Supplier
from app.models.material import Material
from app.models.mrp import MrpProposal
from app.schemas.procurement import (
    PurchaseOrderCreate,
    PurchaseOrderFromProposals,
    PurchaseOrderTransition,
    PurchaseOrderRead,
    PurchaseOrderItemRead,
    GoodsReceiptCreate,
    GoodsReceiptRead,
    GoodsReceiptItemRead,
    PurchaseOrderStatusHistoryRead,
)
from app.schemas.inventory import InventoryTransactionCreate
from app.repositories.procurement_repository import ProcurementRepository
from app.services.inventory_service import InventoryService
from app.services.sequence_service import generate_document_code
from app.core.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


PO_ALLOWED_TRANSITIONS = {
    "DRAFT": ["SUBMITTED", "CANCELLED"],
    "SUBMITTED": ["APPROVED", "DRAFT", "CANCELLED"],
    "APPROVED": ["SENT", "CANCELLED"],
    "SENT": ["CANCELLED"],  # Receipt is system-driven
    "PARTIALLY_RECEIVED": [],  # System-driven
    "RECEIVED": [],
    "CANCELLED": [],
}


class ProcurementService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProcurementRepository(session)
        self.inventory_service = InventoryService(session)

    def _format_po_read(self, po: PurchaseOrder) -> PurchaseOrderRead:
        items_read = []
        for item in po.items:
            open_qty = max(Decimal("0.0000"), item.ordered_quantity - item.received_quantity)
            items_read.append(
                PurchaseOrderItemRead(
                    id=item.id,
                    purchase_order_id=item.purchase_order_id,
                    line_number=item.line_number,
                    material_id=item.material_id,
                    material_code=item.material.material_code if item.material else None,
                    material_name=item.material.name if item.material else None,
                    ordered_quantity=item.ordered_quantity,
                    received_quantity=item.received_quantity,
                    open_quantity=open_qty,
                    unit_of_measure=item.unit_of_measure,
                    unit_price=item.unit_price,
                    line_total=item.line_total,
                    expected_receipt_date=item.expected_receipt_date,
                    source_proposal_id=item.source_proposal_id,
                    source_mrp_run_id=item.source_mrp_run_id,
                    notes=item.notes,
                )
            )

        return PurchaseOrderRead(
            id=po.id,
            po_number=po.po_number,
            supplier_id=po.supplier_id,
            supplier_name=po.supplier.name if po.supplier else None,
            supplier_gstin=getattr(po.supplier, "tax_identifier", None),
            status=po.status,
            order_date=po.order_date,
            currency=po.currency,
            payment_terms=po.payment_terms,
            total_amount=po.total_amount,
            notes=po.notes,
            cancellation_reason=po.cancellation_reason,
            submitted_at=po.submitted_at,
            approved_at=po.approved_at,
            sent_at=po.sent_at,
            closed_at=po.closed_at,
            version=po.version,
            created_at=po.created_at,
            updated_at=po.updated_at,
            items=items_read,
        )

    def _format_receipt_read(self, receipt: GoodsReceipt) -> GoodsReceiptRead:
        items_read = []
        for item in receipt.items:
            items_read.append(
                GoodsReceiptItemRead(
                    id=item.id,
                    goods_receipt_id=item.goods_receipt_id,
                    purchase_order_item_id=item.purchase_order_item_id,
                    material_id=item.material_id,
                    material_code=item.material.material_code if item.material else None,
                    material_name=item.material.name if item.material else None,
                    received_quantity=item.received_quantity,
                    unit_of_measure=item.unit_of_measure,
                    inventory_transaction_id=item.inventory_transaction_id,
                    notes=item.notes,
                )
            )

        return GoodsReceiptRead(
            id=receipt.id,
            receipt_number=receipt.receipt_number,
            purchase_order_id=receipt.purchase_order_id,
            supplier_id=receipt.supplier_id,
            supplier_name=receipt.supplier.name if receipt.supplier else None,
            receipt_date=receipt.receipt_date,
            delivery_reference=receipt.delivery_reference,
            notes=receipt.notes,
            idempotency_key=receipt.idempotency_key,
            created_at=receipt.created_at,
            items=items_read,
        )

    def create_po(self, payload: PurchaseOrderCreate) -> PurchaseOrderRead:
        supplier = self.session.get(Supplier, payload.supplier_id)
        if not supplier:
            raise NotFoundException(message=f"Supplier {payload.supplier_id} not found")

        po_number = generate_document_code(self.session, "PUR")
        order_date = payload.order_date or date.today()
        pay_terms = payload.payment_terms or supplier.payment_terms

        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=payload.supplier_id,
            order_date=order_date,
            currency=payload.currency,
            payment_terms=pay_terms,
            notes=payload.notes,
            status="DRAFT",
            version=1,
        )

        total_amount = Decimal("0.00")
        for idx, item_in in enumerate(payload.items, start=1):
            mat = self.session.get(Material, item_in.material_id)
            if not mat:
                raise NotFoundException(message=f"Material {item_in.material_id} not found")

            if item_in.unit_of_measure != mat.unit_of_measure:
                raise ValidationException(
                    message=f"PO line unit '{item_in.unit_of_measure}' does not match material UOM '{mat.unit_of_measure}'",
                    details={"material_uom": mat.unit_of_measure, "line_uom": item_in.unit_of_measure},
                )

            line_total = (item_in.ordered_quantity * item_in.unit_price).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            total_amount += line_total

            item = PurchaseOrderItem(
                line_number=idx * 10,
                material_id=item_in.material_id,
                ordered_quantity=item_in.ordered_quantity,
                received_quantity=Decimal("0.0000"),
                unit_of_measure=item_in.unit_of_measure,
                unit_price=item_in.unit_price,
                line_total=line_total,
                expected_receipt_date=item_in.expected_receipt_date,
                notes=item_in.notes,
            )
            po.items.append(item)

        po.total_amount = total_amount
        self.session.add(po)
        self.session.flush()

        hist = PurchaseOrderStatusHistory(
            purchase_order_id=po.id,
            from_status=None,
            to_status="DRAFT",
            reason="Purchase order created",
            changed_at=utc_now(),
        )
        self.session.add(hist)
        self.session.commit()

        return self.get_po(po.id)

    def create_po_from_proposals(self, payload: PurchaseOrderFromProposals) -> PurchaseOrderRead:
        supplier = self.session.get(Supplier, payload.supplier_id)
        if not supplier:
            raise NotFoundException(message=f"Supplier {payload.supplier_id} not found")

        po_number = generate_document_code(self.session, "PUR")
        order_date = payload.order_date or date.today()

        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=payload.supplier_id,
            order_date=order_date,
            currency="INR",
            payment_terms=supplier.payment_terms,
            notes=payload.notes,
            status="DRAFT",
            version=1,
        )

        total_amount = Decimal("0.00")
        for idx, line in enumerate(payload.lines, start=1):
            proposal = self.session.get(MrpProposal, line.proposal_id)
            if not proposal:
                raise NotFoundException(message=f"MRP Proposal {line.proposal_id} not found")

            if proposal.status != "OPEN":
                raise ConflictException(
                    message=f"Proposal {line.proposal_id} is already {proposal.status}",
                    details={"proposal_id": str(line.proposal_id), "status": proposal.status},
                )

            mat = proposal.material
            line_total = (proposal.quantity * line.unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total_amount += line_total

            item = PurchaseOrderItem(
                line_number=idx * 10,
                material_id=proposal.material_id,
                ordered_quantity=proposal.quantity,
                received_quantity=Decimal("0.0000"),
                unit_of_measure=mat.unit_of_measure,
                unit_price=line.unit_price,
                line_total=line_total,
                expected_receipt_date=proposal.receipt_date,
                source_proposal_id=proposal.id,
                source_mrp_run_id=proposal.mrp_run_id,
                notes=f"Converted from MRP Proposal {proposal.id}",
            )
            po.items.append(item)

            proposal.status = "CONVERTED"
            proposal.converted_po_item_id = item.id

        po.total_amount = total_amount
        self.session.add(po)
        self.session.flush()

        hist = PurchaseOrderStatusHistory(
            purchase_order_id=po.id,
            from_status=None,
            to_status="DRAFT",
            reason="Created from MRP proposals",
            changed_at=utc_now(),
        )
        self.session.add(hist)
        self.session.commit()

        return self.get_po(po.id)

    def get_po(self, po_id: uuid.UUID) -> PurchaseOrderRead:
        po = self.repo.get_po_by_id(po_id)
        if not po:
            raise NotFoundException(message=f"Purchase order {po_id} not found")
        return self._format_po_read(po)

    def list_pos(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[PurchaseOrderRead]:
        pos = self.repo.list_pos(status=status, supplier_id=supplier_id, skip=skip, limit=limit)
        return [self._format_po_read(p) for p in pos]

    def transition_po(
        self,
        po_id: uuid.UUID,
        payload: PurchaseOrderTransition,
    ) -> PurchaseOrderRead:
        po = self.repo.get_po_by_id_for_update(po_id)
        if not po:
            raise NotFoundException(message=f"Purchase order {po_id} not found")

        if po.version != payload.version:
            raise ConflictException(
                message="Version conflict",
                details={"current_version": po.version, "provided_version": payload.version},
            )

        target = payload.to_status
        current = po.status

        if target not in PO_ALLOWED_TRANSITIONS.get(current, []):
            raise ConflictException(
                message=f"Invalid status transition from {current} to {target}",
                details={"current_status": current, "target_status": target},
            )

        if target == "SUBMITTED":
            if not po.items:
                raise ValidationException(message="Cannot submit a purchase order with zero lines")
            po.submitted_at = utc_now()

        elif target == "APPROVED":
            po.approved_at = utc_now()

        elif target == "SENT":
            po.sent_at = utc_now()

        elif target == "CANCELLED":
            if not payload.reason:
                raise ValidationException(message="Cancellation reason is required")
            po.cancellation_reason = payload.reason
            po.cancelled_at = utc_now()

        po.status = target
        po.version += 1

        hist = PurchaseOrderStatusHistory(
            purchase_order_id=po.id,
            from_status=current,
            to_status=target,
            reason=payload.reason,
            changed_at=utc_now(),
        )
        self.session.add(hist)
        self.session.commit()

        return self.get_po(po.id)

    def post_goods_receipt(
        self,
        po_id: uuid.UUID,
        payload: GoodsReceiptCreate,
    ) -> GoodsReceiptRead:
        if payload.idempotency_key:
            existing = self.repo.get_receipt_by_idempotency_key(payload.idempotency_key)
            if existing:
                return self._format_receipt_read(existing)

        po = self.repo.get_po_by_id_for_update(po_id)
        if not po:
            raise NotFoundException(message=f"Purchase order {po_id} not found")

        if po.status not in ("SENT", "PARTIALLY_RECEIVED"):
            raise ConflictException(
                message=f"Goods receipt can only be posted for SENT or PARTIALLY_RECEIVED purchase orders (current: {po.status})",
                details={"po_status": po.status},
            )

        receipt_number = generate_document_code(self.session, "GRN")
        receipt_date = payload.receipt_date or date.today()

        receipt = GoodsReceipt(
            receipt_number=receipt_number,
            purchase_order_id=po.id,
            supplier_id=po.supplier_id,
            receipt_date=receipt_date,
            delivery_reference=payload.delivery_reference,
            notes=payload.notes,
            idempotency_key=payload.idempotency_key,
        )
        self.session.add(receipt)
        self.session.flush()

        # Map PO items
        items_by_id = {item.id: item for item in po.items}

        for line in payload.lines:
            po_item = items_by_id.get(line.purchase_order_item_id)
            if not po_item:
                raise NotFoundException(
                    message=f"Purchase order line {line.purchase_order_item_id} not found on this PO"
                )

            open_qty = max(Decimal("0.0000"), po_item.ordered_quantity - po_item.received_quantity)
            if line.received_quantity > open_qty:
                raise ValidationException(
                    message=f"Received quantity exceeds open quantity ({line.received_quantity} > {open_qty})",
                    details={"open_quantity": str(open_qty), "received_quantity": str(line.received_quantity)},
                )

            # Record inventory transaction atomically
            inv_txn = self.inventory_service.record_transaction(
                InventoryTransactionCreate(
                    material_id=po_item.material_id,
                    transaction_type="RECEIPT",
                    quantity=line.received_quantity,
                    unit_of_measure=po_item.unit_of_measure,
                    reference_type="GOODS_RECEIPT",
                    reference_id=receipt.id,
                    notes=f"Goods Receipt {receipt_number} from PO {po.po_number}",
                ),
                commit=False,
            )

            gr_item = GoodsReceiptItem(
                goods_receipt_id=receipt.id,
                purchase_order_item_id=po_item.id,
                material_id=po_item.material_id,
                received_quantity=line.received_quantity,
                unit_of_measure=po_item.unit_of_measure,
                inventory_transaction_id=inv_txn.id,
                notes=line.notes,
            )
            receipt.items.append(gr_item)

            # Update PO item received quantity
            po_item.received_quantity += line.received_quantity

        # Evaluate PO completion status
        all_fully_received = all(item.received_quantity >= item.ordered_quantity for item in po.items)
        new_status = "RECEIVED" if all_fully_received else "PARTIALLY_RECEIVED"

        if po.status != new_status:
            old_status = po.status
            po.status = new_status
            if new_status == "RECEIVED":
                po.closed_at = utc_now()
            po.version += 1

            hist = PurchaseOrderStatusHistory(
                purchase_order_id=po.id,
                from_status=old_status,
                to_status=new_status,
                reason=f"Goods receipt {receipt_number}",
                changed_at=utc_now(),
            )
            self.session.add(hist)

        self.session.commit()
        refreshed_receipt = self.repo.get_receipt_by_id(receipt.id)
        return self._format_receipt_read(refreshed_receipt)

    def list_receipts(
        self,
        po_id: Optional[uuid.UUID] = None,
        supplier_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[GoodsReceiptRead]:
        receipts = self.repo.list_receipts(po_id=po_id, supplier_id=supplier_id, skip=skip, limit=limit)
        return [self._format_receipt_read(r) for r in receipts]

    def list_history(self, po_id: uuid.UUID) -> List[PurchaseOrderStatusHistoryRead]:
        po = self.repo.get_po_by_id(po_id)
        if not po:
            raise NotFoundException(message=f"Purchase order {po_id} not found")
        return [PurchaseOrderStatusHistoryRead.model_validate(h) for h in po.status_history]
