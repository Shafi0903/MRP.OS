from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services.material_service import MaterialService


def get_material_service() -> MaterialService:
    return MaterialService()

