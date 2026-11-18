from fastapi import APIRouter
from app.api.v1.endpoints import (
    dashboard,
    materials,
    products,
    suppliers,
    bom,
    inventory,
    mrp,
    production,
    procurement,
)

api_router = APIRouter()
api_router.include_router(dashboard.router)
api_router.include_router(materials.router)
api_router.include_router(products.router)
api_router.include_router(suppliers.router)
api_router.include_router(bom.router, prefix="/boms", tags=["Bill of Materials"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory Ledger"])
api_router.include_router(mrp.router, prefix="/mrp", tags=["MRP Engine"])
api_router.include_router(production.router, prefix="/production-orders", tags=["Production Planning"])
api_router.include_router(procurement.router, tags=["Procurement"])
