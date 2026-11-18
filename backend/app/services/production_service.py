import uuid
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.production import ProductionOrder, ProductionOrderStatusHistory
from app.models.product import Product
from app.models.bom import BomHeader
from app.schemas.production import (
    ProductionOrderCreate,
    ProductionOrderUpdate,
    ProductionOrderTransition,
    ProductionOrderProgress,
    ProductionOrderRead,
    ProductionOrderStatusHistoryRead,
)
from app.repositories.production_repository import ProductionRepository
from app.services.sequence_service import generate_document_code
from app.core.errors import (
    NotFoundException,
    ValidationException,
    ConflictException,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


ALLOWED_TRANSITIONS = {
    "DRAFT": ["PLANNED", "CANCELLED"],
    "PLANNED": ["DRAFT", "RELEASED", "CANCELLED"],
    "RELEASED": ["IN_PROGRESS", "CANCELLED"],
    "IN_PROGRESS": ["COMPLETED", "CANCELLED"],
    "COMPLETED": [],
    "CANCELLED": [],
}


class ProductionService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = ProductionRepository(session)

    def _format_order_read(self, order: ProductionOrder) -> ProductionOrderRead:
        prod = order.product
        bom = order.bom_header
        return ProductionOrderRead(
            id=order.id,
            order_code=order.order_code,
            product_id=order.product_id,
            product_code=prod.product_code if prod else None,
            product_name=prod.name if prod else None,
            bom_header_id=order.bom_header_id,
            bom_revision=order.bom_revision or (bom.revision if bom else None),
            planned_quantity=order.planned_quantity,
            completed_quantity=order.completed_quantity,
            unit_of_measure=order.unit_of_measure,
            planned_start_date=order.planned_start_date,
            due_date=order.due_date,
            priority=order.priority,
            status=order.status,
            notes=order.notes,
            cancellation_reason=order.cancellation_reason,
            actual_start_at=order.actual_start_at,
            actual_completion_at=order.actual_completion_at,
            version=order.version,
            created_at=order.created_at,
            updated_at=order.updated_at,
        )

    def create_order(self, payload: ProductionOrderCreate) -> ProductionOrderRead:
        product = self.session.get(Product, payload.product_id)
        if not product:
            raise NotFoundException(message=f"Product {payload.product_id} not found")

        uom = payload.unit_of_measure or product.unit_of_measure
        if uom != product.unit_of_measure:
            raise ValidationException(
                message=f"Production order UOM '{uom}' must match product UOM '{product.unit_of_measure}'",
                details={"product_uom": product.unit_of_measure, "order_uom": uom},
            )

        start_date = payload.planned_start_date
        if not start_date:
            lead_days = product.lead_time_days or 0
            start_date = payload.due_date - timedelta(days=lead_days)

        if payload.due_date < start_date:
            raise ValidationException(
                message="Due date cannot precede planned start date",
                details={"start_date": str(start_date), "due_date": str(payload.due_date)},
            )

        order_code = generate_document_code(self.session, "PRD")

        order = ProductionOrder(
            order_code=order_code,
            product_id=payload.product_id,
            bom_header_id=payload.bom_header_id,
            planned_quantity=payload.planned_quantity,
            completed_quantity=Decimal("0.0000"),
            unit_of_measure=uom,
            planned_start_date=start_date,
            due_date=payload.due_date,
            priority=payload.priority,
            status="DRAFT",
            notes=payload.notes,
            version=1,
        )
        self.repo.create(order)

        # Initial history record
        hist = ProductionOrderStatusHistory(
            production_order_id=order.id,
            from_status=None,
            to_status="DRAFT",
            reason="Order created in draft",
            changed_at=utc_now(),
        )
        self.session.add(hist)
        self.session.commit()

        return self.get_order(order.id)

    def get_order(self, order_id: uuid.UUID) -> ProductionOrderRead:
        order = self.repo.get_by_id(order_id)
        if not order:
            raise NotFoundException(message=f"Production order {order_id} not found")
        return self._format_order_read(order)

    def list_orders(
        self,
        status: Optional[str] = None,
        product_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ProductionOrderRead]:
        orders = self.repo.list_orders(status=status, product_id=product_id, skip=skip, limit=limit)
        return [self._format_order_read(o) for o in orders]

    def transition_order(
        self,
        order_id: uuid.UUID,
        payload: ProductionOrderTransition,
    ) -> ProductionOrderRead:
        order = self.repo.get_by_id_for_update(order_id)
        if not order:
            raise NotFoundException(message=f"Production order {order_id} not found")

        if order.version != payload.version:
            raise ConflictException(
                message="Version conflict: the production order was updated by another user",
                details={"current_version": order.version, "provided_version": payload.version},
            )

        target = payload.to_status
        current = order.status

        if target not in ALLOWED_TRANSITIONS.get(current, []):
            raise ConflictException(
                message=f"Invalid status transition from {current} to {target}",
                details={"current_status": current, "target_status": target},
            )

        # Precondition checks
        if target == "PLANNED":
            # Resolve or verify BOM
            if not order.bom_header_id:
                # Find active BOM for product
                bom = self.session.query(BomHeader).filter(
                    BomHeader.product_id == order.product_id,
                    BomHeader.is_active == True,
                ).first()
                if not bom:
                    raise ValidationException(
                        message="Cannot plan production order: No active Bill of Materials found for product",
                        details={"product_id": str(order.product_id)},
                    )
                order.bom_header_id = bom.id
                order.bom_revision = bom.revision
            else:
                bom = self.session.get(BomHeader, order.bom_header_id)
                if not bom or not bom.is_active:
                    raise ValidationException(
                        message="Cannot plan production order: Referenced BOM is inactive or missing",
                        details={"bom_header_id": str(order.bom_header_id)},
                    )
                order.bom_revision = bom.revision

        elif target == "RELEASED":
            if not order.bom_header_id or not order.bom_header or not order.bom_header.is_active:
                raise ValidationException(
                    message="Cannot release production order: BOM is inactive or invalid",
                    details={"bom_header_id": str(order.bom_header_id)},
                )

        elif target == "IN_PROGRESS":
            order.actual_start_at = utc_now()

        elif target == "COMPLETED":
            if order.completed_quantity <= Decimal("0.0000"):
                raise ValidationException(
                    message="Cannot complete production order with zero completed quantity",
                    details={"completed_quantity": str(order.completed_quantity)},
                )
            order.actual_completion_at = utc_now()

        elif target == "CANCELLED":
            if current == "IN_PROGRESS" and order.completed_quantity > Decimal("0.0000"):
                raise ConflictException(
                    message="Cannot cancel an in-progress order with completed quantity",
                    details={"completed_quantity": str(order.completed_quantity)},
                )
            if not payload.reason:
                raise ValidationException(message="Cancellation reason is required when cancelling an order")
            order.cancellation_reason = payload.reason

        order.status = target
        order.version += 1

        hist = ProductionOrderStatusHistory(
            production_order_id=order.id,
            from_status=current,
            to_status=target,
            reason=payload.reason,
            changed_at=utc_now(),
        )
        self.session.add(hist)
        self.session.commit()

        return self.get_order(order.id)

    def record_progress(
        self,
        order_id: uuid.UUID,
        payload: ProductionOrderProgress,
    ) -> ProductionOrderRead:
        order = self.repo.get_by_id_for_update(order_id)
        if not order:
            raise NotFoundException(message=f"Production order {order_id} not found")

        if order.version != payload.version:
            raise ConflictException(
                message="Version conflict",
                details={"current_version": order.version, "provided_version": payload.version},
            )

        if order.status != "IN_PROGRESS":
            raise ConflictException(
                message=f"Progress can only be recorded for IN_PROGRESS orders (current: {order.status})",
                details={"status": order.status},
            )

        if payload.completed_quantity < order.completed_quantity:
            raise ValidationException(
                message="Completed quantity cannot decrease",
                details={"current": str(order.completed_quantity), "submitted": str(payload.completed_quantity)},
            )

        if payload.completed_quantity > order.planned_quantity:
            raise ValidationException(
                message="Completed quantity cannot exceed planned quantity",
                details={"planned": str(order.planned_quantity), "submitted": str(payload.completed_quantity)},
            )

        order.completed_quantity = payload.completed_quantity
        order.version += 1
        self.session.commit()

        return self.get_order(order.id)

    def list_history(self, order_id: uuid.UUID) -> List[ProductionOrderStatusHistoryRead]:
        order = self.repo.get_by_id(order_id)
        if not order:
            raise NotFoundException(message=f"Production order {order_id} not found")
        return [ProductionOrderStatusHistoryRead.model_validate(h) for h in order.status_history]
