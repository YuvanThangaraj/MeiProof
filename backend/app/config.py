from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    meiproof_env: str = "development"
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    # Legacy aliases retained for projects still using anon/service_role JWT keys.
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    storage_bucket: str = "claim-evidence"
    max_upload_bytes: int = 20 * 1024 * 1024
    max_pdf_pages: int = 20
    ocr_enabled: bool = True
    tesseract_cmd: str = ""
    cors_origins: str = "http://localhost:8443,http://127.0.0.1:8443"
    allowed_mime_types: tuple[str, ...] = ("application/pdf", "image/jpeg", "image/png", "image/webp")
    demo_mode: bool = False
    demo_login_enabled: bool = False
    demo_login_email: str = ""
    demo_login_password: str = ""
    demo_login_user_id: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def public_api_key(self) -> str:
        return self.supabase_publishable_key or self.supabase_anon_key

    @property
    def privileged_api_key(self) -> str:
        return self.supabase_secret_key or self.supabase_service_role_key

    @property
    def demo_login_available(self) -> bool:
        return (
            self.demo_login_enabled
            and self.meiproof_env.lower() == "development"
            and bool(
                self.supabase_url
                and self.public_api_key
                and self.demo_login_email
                and self.demo_login_password
                and self.demo_login_user_id
            )
        )

settings = Settings()
