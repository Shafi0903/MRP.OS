import os
import sys
from decimal import Decimal
from datetime import date, timedelta

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.material import Material
from app.services.material_service import MaterialService
from app.services.supplier_service import SupplierService
from app.services.product_service import ProductService
from app.services.bom_service import BomService
from app.services.inventory_service import InventoryService
from app.services.production_service import ProductionService
from app.services.mrp_service import MrpService
from app.schemas.material import MaterialCreate, MaterialUpdate
from app.schemas.supplier import SupplierCreate, SupplierUpdate
from app.schemas.product import ProductCreate, ProductUpdate
from app.schemas.bom import BomHeaderCreate, BomItemCreate
from app.schemas.inventory import InventoryTransactionCreate
from app.schemas.production import ProductionOrderCreate, ProductionOrderTransition
from app.schemas.mrp import MrpRunCreate

DEMO_SUPPLIERS = [
    {
        "supplier_code": "SUP-TATA-01",
        "name": "Tata Steel Limited",
        "contact_person": "Rajesh Sharma",
        "email": "industrial.sales@tatasteel.com",
        "phone": "+91 22 6665 8282",
        "city": "Mumbai",
        "state_region": "Maharashtra",
        "country": "India",
        "payment_terms_days": 30,
        "notes": "Primary vendor for cold-rolled steel coils and structural MS plates.",
    },
    {
        "supplier_code": "SUP-SUND-01",
        "name": "Sundram Fasteners Limited",
        "contact_person": "K. Venkatesh",
        "email": "orders@sundram.com",
        "phone": "+91 44 2852 1870",
        "city": "Chennai",
        "state_region": "Tamil Nadu",
        "country": "India",
        "payment_terms_days": 45,
        "notes": "Certified automotive and industrial high-tensile metric fasteners.",
    },
    {
        "supplier_code": "SUP-UFLX-01",
        "name": "Uflex Packaging Industries Ltd",
        "contact_person": "Amitabh Verma",
        "email": "packaging.corp@uflexltd.com",
        "phone": "+91 120 401 2345",
        "city": "Noida",
        "state_region": "Uttar Pradesh",
        "country": "India",
        "payment_terms_days": 30,
        "notes": "Corrugated cartons, heavy-duty shipping boxes, and protective film.",
    },
    {
        "supplier_code": "SUP-HIND-01",
        "name": "Hindalco Industries Limited",
        "contact_person": "Pradeep Kulkarni",
        "email": "extrusion.sales@adityabirla.com",
        "phone": "+91 20 6604 1000",
        "city": "Pune",
        "state_region": "Maharashtra",
        "country": "India",
        "payment_terms_days": 30,
        "notes": "Structural aluminum alloys, extrusions, and billets.",
    },
]

DEMO_PRODUCTS = [
    {
        "product_code": "PRD-DESK-001",
        "name": "ErgoLift Dual-Motor Standing Desk",
        "description": "Smart height-adjustable motorized desk with anti-collision and pre-set digital controller",
        "product_type": "FINISHED",
        "unit_of_measure": "NOS",
        "lead_time_days": 8,
    },
    {
        "product_code": "PRD-DRAWER-001",
        "name": "Modular 3-Tier Under-Desk Pedestal",
        "description": "CRCA steel central locking under-desk storage drawer with ball-bearing slides",
        "product_type": "SEMI_FINISHED",
        "unit_of_measure": "NOS",
        "lead_time_days": 4,
    },
    {
        "product_code": "PRD-CHAIR-002",
        "name": "Mesh Matrix High-Back Executive Chair",
        "description": "Ergonomic executive mesh chair with multi-lock synchro tilt and 3D armrests",
        "product_type": "FINISHED",
        "unit_of_measure": "NOS",
        "lead_time_days": 6,
    },
]

DEMO_MATERIALS = [
    {
        "material_code": "MAT-STEEL-001",
        "name": "Hot Rolled Mild Steel Sheet 2.5mm",
        "description": "IS 2062 Grade E250 structural quality mild steel sheet",
        "category": "Raw Material",
        "material_type": "RAW",
        "unit": "KG",
        "procurement_type": "BUY",
        "unit_cost": "68.5000",
        "lead_time_days": 5,
        "safety_stock": "500.0000",
        "minimum_order_qty": "200.0000",
        "lot_size": "FIXED",
        "fixed_lot_size": "100.0000",
    },
    {
        "material_code": "MAT-BOLT-M8",
        "name": "High Tensile Hex Flange Bolt M8 x 45mm",
        "description": "IS 1364 Grade 8.8 zinc flake coated metric hex flange bolt",
        "category": "Fasteners",
        "material_type": "COMPONENT",
        "unit": "NOS",
        "procurement_type": "BUY",
        "unit_cost": "4.2500",
        "lead_time_days": 3,
        "safety_stock": "2000.0000",
        "minimum_order_qty": "500.0000",
        "lot_size": "LOT_FOR_LOT",
    },
    {
        "material_code": "MAT-PACK-BOX",
        "name": "7-Ply Heavy Duty Master Corrugated Carton",
        "description": "Heavy duty export shipping box 180 GSM Kraft paper (750x450x450mm)",
        "category": "Packaging",
        "material_type": "PACKAGING",
        "unit": "NOS",
        "procurement_type": "BUY",
        "unit_cost": "45.0000",
        "lead_time_days": 2,
        "safety_stock": "350.0000",
        "minimum_order_qty": "100.0000",
        "lot_size": "LOT_FOR_LOT",
    },
    {
        "material_code": "MAT-ALUM-6061",
        "name": "Architectural Aluminum Extrusion 6063-T6",
        "description": "Anodized aluminum alloy rail profile for motorized track guide",
        "category": "Raw Material",
        "material_type": "RAW",
        "unit": "MTR",
        "procurement_type": "BUY",
        "unit_cost": "385.0000",
        "lead_time_days": 7,
        "safety_stock": "120.0000",
        "minimum_order_qty": "50.0000",
        "lot_size": "FIXED",
        "fixed_lot_size": "25.0000",
    },
    {
        "material_code": "MAT-LUBR-001",
        "name": "Servo System 68 Anti-Wear Hydraulic Oil",
        "description": "IOCL industrial premium high-viscosity index hydraulic fluid",
        "category": "Consumables",
        "material_type": "CONSUMABLE",
        "unit": "LTR",
        "procurement_type": "BUY",
        "unit_cost": "245.0000",
        "lead_time_days": 4,
        "safety_stock": "200.0000",
        "minimum_order_qty": "100.0000",
        "lot_size": "LOT_FOR_LOT",
    },
]

def seed():
    db = SessionLocal()
    sup_service = SupplierService()
    prod_service = ProductService()
    mat_service = MaterialService()
    bom_service = BomService(db)
    inv_service = InventoryService(db)
    prod_order_service = ProductionService(db)
    mrp_service = MrpService(db)

    try:
        # 1. Suppliers
        suppliers_map = {}
        for sup in DEMO_SUPPLIERS:
            existing = sup_service.repository.get_by_code(db, sup["supplier_code"])
            if not existing:
                created = sup_service.create(db, SupplierCreate(**sup))
                suppliers_map[sup["supplier_code"]] = created.id
                print(f"Created Indian Supplier: {created.supplier_code} - {created.name}")
            else:
                sup_service.update(db, existing.id, SupplierUpdate(**sup))
                suppliers_map[sup["supplier_code"]] = existing.id
                print(f"Updated Supplier: {existing.supplier_code}")

        # 2. Products
        products_map = {}
        for prod in DEMO_PRODUCTS:
            existing = prod_service.repository.get_by_code(db, prod["product_code"])
            if not existing:
                created = prod_service.create(db, ProductCreate(**prod))
                products_map[prod["product_code"]] = created.id
                print(f"Created Product: {created.product_code} - {created.name}")
            else:
                prod_service.update(db, existing.id, ProductUpdate(**prod))
                products_map[prod["product_code"]] = existing.id
                print(f"Updated Product: {existing.product_code}")

        # 3. Materials
        materials_map = {}
        for mat in DEMO_MATERIALS:
            existing = mat_service.repository.get_by_code(db, mat["material_code"])
            supplier_id = None
            if "STEEL" in mat["material_code"]:
                supplier_id = suppliers_map.get("SUP-TATA-01")
            elif "BOLT" in mat["material_code"]:
                supplier_id = suppliers_map.get("SUP-SUND-01")
            elif "PACK" in mat["material_code"]:
                supplier_id = suppliers_map.get("SUP-UFLX-01")
            elif "ALUM" in mat["material_code"]:
                supplier_id = suppliers_map.get("SUP-HIND-01")

            if not existing:
                mat["preferred_supplier_id"] = supplier_id
                created = mat_service.create(db, MaterialCreate(**mat))
                materials_map[mat["material_code"]] = created.id
                print(f"Created Material: {created.material_code}")
            else:
                mat["preferred_supplier_id"] = supplier_id or existing.preferred_supplier_id
                mat_service.update(db, existing.id, MaterialUpdate(**mat))
                materials_map[mat["material_code"]] = existing.id
                print(f"Updated Material: {existing.material_code} with INR cost ₹{mat['unit_cost']}")

        # 4. Create Multi-level BOMs if not exist
        desk_id = products_map.get("PRD-DESK-001")
        drawer_id = products_map.get("PRD-DRAWER-001")

        if desk_id and drawer_id:
            # Subassembly BOM for Pedestal Drawer
            drawer_bom = bom_service.get_active_bom_for_product(drawer_id)
            if not drawer_bom:
                drawer_bom = bom_service.create_bom(
                    BomHeaderCreate(
                        product_id=drawer_id,
                        revision="Rev 1.0",
                        description="Modular 3-Tier Pedestal Subassembly BOM",
                        items=[
                            BomItemCreate(
                                material_id=materials_map.get("MAT-STEEL-001"),
                                quantity=Decimal("12.5000"),
                                unit_of_measure="KG",
                                scrap_factor=Decimal("0.0200"),
                                item_sequence=10,
                            ),
                            BomItemCreate(
                                material_id=materials_map.get("MAT-BOLT-M8"),
                                quantity=Decimal("16.0000"),
                                unit_of_measure="NOS",
                                item_sequence=20,
                            ),
                        ],
                    )
                )
                print(f"Created Subassembly BOM: {drawer_bom.bom_code}")

            # Top-Level Finished Desk BOM
            desk_bom = bom_service.get_active_bom_for_product(desk_id)
            if not desk_bom:
                desk_bom = bom_service.create_bom(
                    BomHeaderCreate(
                        product_id=desk_id,
                        revision="Rev 1.0",
                        description="ErgoLift Standing Desk Master Assembly BOM",
                        items=[
                            BomItemCreate(
                                child_product_id=drawer_id,
                                quantity=Decimal("1.0000"),
                                unit_of_measure="NOS",
                                item_sequence=10,
                            ),
                            BomItemCreate(
                                material_id=materials_map.get("MAT-STEEL-001"),
                                quantity=Decimal("18.0000"),
                                unit_of_measure="KG",
                                scrap_factor=Decimal("0.0300"),
                                item_sequence=20,
                            ),
                            BomItemCreate(
                                material_id=materials_map.get("MAT-ALUM-6061"),
                                quantity=Decimal("3.5000"),
                                unit_of_measure="MTR",
                                item_sequence=30,
                            ),
                            BomItemCreate(
                                material_id=materials_map.get("MAT-BOLT-M8"),
                                quantity=Decimal("24.0000"),
                                unit_of_measure="NOS",
                                item_sequence=40,
                            ),
                            BomItemCreate(
                                material_id=materials_map.get("MAT-PACK-BOX"),
                                quantity=Decimal("1.0000"),
                                unit_of_measure="NOS",
                                item_sequence=50,
                            ),
                        ],
                    )
                )
                print(f"Created Master BOM: {desk_bom.bom_code}")

        # 5. Seed Initial Inventory Balances
        for code, mat_id in materials_map.items():
            mat_obj = db.get(Material, mat_id)
            bal = inv_service.repo.get_balance_by_material(mat_id)
            if not bal or bal.on_hand_quantity == 0:
                inv_service.record_transaction(
                    InventoryTransactionCreate(
                        material_id=mat_id,
                        transaction_type="RECEIPT",
                        quantity=Decimal("350.0000") if "STEEL" in code else Decimal("500.0000"),
                        unit_of_measure=mat_obj.unit,
                        notes="Factory opening stock",
                    ),
                    commit=True,
                )
                print(f"Seeded warehouse balance for {code}")

        # 6. Seed a Production Order
        existing_orders = prod_order_service.list_orders(limit=5)
        if not existing_orders:
            po = prod_order_service.create_order(
                ProductionOrderCreate(
                    product_id=desk_id,
                    planned_quantity=Decimal("50.0000"),
                    due_date=date.today() + timedelta(days=21),
                    priority="HIGH",
                    notes="Q4 Export Batch to Bangalore Hub",
                )
            )
            po = prod_order_service.transition_order(po.id, ProductionOrderTransition(to_status="PLANNED", version=po.version))
            po = prod_order_service.transition_order(po.id, ProductionOrderTransition(to_status="RELEASED", version=po.version))
            print(f"Created Released Production Order: {po.order_code}")

        # 7. Run MRP Engine to populate proposals
        mrp_run = mrp_service.run_mrp(
            MrpRunCreate(
                planning_start_date=date.today(),
                planning_horizon_periods=12,
                period_type="WEEKLY",
            )
        )
        print(f"Executed MRP Run: {mrp_run.run_code} with {mrp_run.proposals_count} proposals generated!")

        print("\nIndian Metrics & MRP Seed Completed Successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
