import json
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "MRP Management System"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # Regional settings
    DEFAULT_CURRENCY: str = "INR"
    BUSINESS_TIMEZONE: str = "Asia/Kolkata"

    # SQLite fallback by default for quick local running, configurable to PostgreSQL via .env
    DATABASE_URL: str = "sqlite:///./mrp.db"
    
    # CORS Origins (accepted as JSON list or comma-separated string)
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    
    SECRET_KEY: str = "development-secret-key-change-in-production-non-empty"

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, str):
            trimmed = self.CORS_ORIGINS.strip()
            if trimmed.startswith("[") and trimmed.endswith("]"):
                try:
                    return json.loads(trimmed)
                except Exception:
                    pass
            return [i.strip() for i in trimmed.split(",") if i.strip()]
        return self.CORS_ORIGINS

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
