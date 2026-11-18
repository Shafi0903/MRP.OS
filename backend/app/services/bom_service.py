import uuid
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Set, Dict, Any
from sqlalchemy.orm import Session
from app.models.bom import BomHeader, BomItem
from app.models.product import Product
from app.models.material import Material
from app.schemas.bom import (
    BomHeaderCreate,
    BomHeaderUpdate,
    BomHeaderRead,
    BomItemRead,
    BomExplosionItem,
)
from app.repositories.bom_repository import BomRepository
from app.services.sequence_service import generate_document_code
from app.core.errors import NotFoundException, ValidationException, ConflictException


class BomService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = BomRepository(session)

    def _format_bom_read(self, bom: BomHeader) -> BomHeaderRead:
        items_read = []
        approx_cost = Decimal("0.00")

        for item in bom.items:
            mat_code = item.material.material_code if item.material else None
            mat_name = item.material.name if item.material else None
            mat_cost = item.material.standard_cost if item.material else None
            child_code = item.child_product.product_code if item.child_product else None
            child_name = item.child_product.name if item.child_product else None

            if mat_cost is not None:
                line_cost = (item.quantity * (Decimal("1.0") + item.scrap_factor) * mat_cost).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                approx_cost += line_cost

            items_read.append(
                BomItemRead(
                    id=item.id,
                    bom_header_id=item.bom_header_id,
                    material_id=item.material_id,
                    child_product_id=item.child_product_id,
                    quantity=item.quantity,
                    unit_of_measure=item.unit_of_measure,
                    scrap_factor=item.scrap_factor,
                    lead_time_offset_days=item.lead_time_offset_days,
                    item_sequence=item.item_sequence,
                    notes=item.notes,
                    material_code=mat_code,
                    material_name=mat_name,
                    material_cost=mat_cost,
                    child_product_code=child_code,
                    child_product_name=child_name,
                )
            )

        return BomHeaderRead(
            id=bom.id,
            bom_code=bom.bom_code,
            product_id=bom.product_id,
            revision=bom.revision,
            description=bom.description,
            is_active=bom.is_active,
            effective_from=bom.effective_from,
            effective_to=bom.effective_to,
            created_at=bom.created_at,
            updated_at=bom.updated_at,
            product_code=bom.product.product_code if bom.product else None,
            product_name=bom.product.name if bom.product else None,
            product_uom=bom.product.unit_of_measure if bom.product else None,
            product_type=bom.product.product_type if bom.product else None,
            approximate_cost=approx_cost,
            items=items_read,
        )

    def detect_cycles(self, parent_product_id: uuid.UUID, visited: Set[uuid.UUID] | None = None) -> None:
        """
        DFS check to ensure no cyclical dependencies exist in BOM structures.
        """
        if visited is None:
            visited = set()

        if parent_product_id in visited:
            raise ValidationException(
                message=f"Circular reference detected in Bill of Materials hierarchy for product {parent_product_id}",
                details={"product_id": str(parent_product_id)},
            )

        visited.add(parent_product_id)
        active_bom = self.repo.get_active_bom_for_product(parent_product_id)
        if active_bom:
            for item in active_bom.items:
                if item.child_product_id:
                    self.detect_cycles(item.child_product_id, visited.copy())

    def create_bom(self, payload: BomHeaderCreate) -> BomHeaderRead:
        # Validate parent product exists
        product = self.session.get(Product, payload.product_id)
        if not product:
            raise NotFoundException(message=f"Product {payload.product_id} not found")

        # Generate BOM code
        bom_code = generate_document_code(self.session, "BOM")

        bom = BomHeader(
            bom_code=bom_code,
            product_id=payload.product_id,
            revision=payload.revision,
            description=payload.description,
            is_active=payload.is_active,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )

        for seq, item_in in enumerate(payload.items, start=1):
            if item_in.child_product_id == payload.product_id:
                raise ValidationException(
                    message="A product cannot contain itself as a component in its Bill of Materials",
                    details={"product_id": str(payload.product_id)},
                )

            item = BomItem(
                material_id=item_in.material_id,
                child_product_id=item_in.child_product_id,
                quantity=item_in.quantity,
                unit_of_measure=item_in.unit_of_measure,
                scrap_factor=item_in.scrap_factor,
                lead_time_offset_days=item_in.lead_time_offset_days,
                item_sequence=item_in.item_sequence or (seq * 10),
                notes=item_in.notes,
            )
            bom.items.append(item)

        self.repo.create(bom)

        # Check for cycles
        self.detect_cycles(payload.product_id)

        self.session.commit()
        return self.get_bom(bom.id)

    def get_bom(self, bom_id: uuid.UUID) -> BomHeaderRead:
        bom = self.repo.get_by_id(bom_id)
        if not bom:
            raise NotFoundException(message=f"BOM {bom_id} not found")
        return self._format_bom_read(bom)

    def get_active_bom_for_product(self, product_id: uuid.UUID, on_date: Optional[date] = None) -> Optional[BomHeaderRead]:
        bom = self.repo.get_active_bom_for_product(product_id, on_date)
        if not bom:
            return None
        return self._format_bom_read(bom)

    def list_boms(
        self,
        product_id: Optional[uuid.UUID] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[BomHeaderRead]:
        boms = self.repo.list_all(product_id=product_id, is_active=is_active, skip=skip, limit=limit)
        return [self._format_bom_read(b) for b in boms]

    def explode_bom(
        self,
        bom_id: uuid.UUID,
        demand_quantity: Decimal = Decimal("1.0"),
    ) -> List[BomExplosionItem]:
        """
        Multi-level BOM explosion calculating effective quantities and rolled up lead times.
        """
        bom = self.repo.get_by_id(bom_id)
        if not bom:
            raise NotFoundException(message=f"BOM {bom_id} not found")

        results: List[BomExplosionItem] = []
        line_counter = 1

        def _explode_recursive(
            current_bom: BomHeader,
            multiplier: Decimal,
            current_level: int,
            cum_lead_time: int,
            parent_code: str,
        ):
            nonlocal line_counter
            for item in current_bom.items:
                extended_qty = (item.quantity * multiplier).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                effective_qty = (extended_qty * (Decimal("1.0") + item.scrap_factor)).quantize(
                    Decimal("0.0001"), rounding=ROUND_HALF_UP
                )

                if item.material_id and item.material:
                    mat = item.material
                    unit_cost = mat.standard_cost or Decimal("0.00")
                    extended_cost = (effective_qty * unit_cost).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                    lead_time = mat.lead_time_days or 0
                    total_lead_time = cum_lead_time + lead_time + item.lead_time_offset_days

                    results.append(
                        BomExplosionItem(
                            level=current_level,
                            line_number=line_counter,
                            item_type="MATERIAL",
                            item_id=mat.id,
                            item_code=mat.material_code,
                            item_name=mat.name,
                            parent_code=parent_code,
                            quantity_per_parent=item.quantity,
                            extended_quantity=extended_qty,
                            scrap_factor=item.scrap_factor,
                            effective_quantity=effective_qty,
                            unit_of_measure=item.unit_of_measure,
                            lead_time_days=lead_time,
                            cumulative_lead_time_days=total_lead_time,
                            unit_cost=unit_cost,
                            extended_cost=extended_cost,
                        )
                    )
                    line_counter += 1

                elif item.child_product_id and item.child_product:
                    child_prod = item.child_product
                    lead_time = child_prod.lead_time_days or 0
                    total_lead_time = cum_lead_time + lead_time + item.lead_time_offset_days

                    # Find active subassembly BOM
                    sub_bom = self.repo.get_active_bom_for_product(child_prod.id)
                    sub_cost = Decimal("0.00")

                    results.append(
                        BomExplosionItem(
                            level=current_level,
                            line_number=line_counter,
                            item_type="SUBASSEMBLY",
                            item_id=child_prod.id,
                            item_code=child_prod.product_code,
                            item_name=child_prod.name,
                            parent_code=parent_code,
                            quantity_per_parent=item.quantity,
                            extended_quantity=extended_qty,
                            scrap_factor=item.scrap_factor,
                            effective_quantity=effective_qty,
                            unit_of_measure=item.unit_of_measure,
                            lead_time_days=lead_time,
                            cumulative_lead_time_days=total_lead_time,
                            unit_cost=sub_cost,
                            extended_cost=Decimal("0.00"),
                        )
                    )
                    line_counter += 1

                    if sub_bom:
                        _explode_recursive(
                            sub_bom,
                            effective_qty,
                            current_level + 1,
                            total_lead_time,
                            child_prod.product_code,
                        )

        parent_prod_code = bom.product.product_code if bom.product else bom.bom_code
        _explode_recursive(bom, demand_quantity, 1, 0, parent_prod_code)
        return results
