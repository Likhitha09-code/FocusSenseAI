from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    app_env: str = "development"
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    database_url: str = ""

    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_ENV_FILE), ".env"),
        extra="ignore",
    )


settings = Settings()