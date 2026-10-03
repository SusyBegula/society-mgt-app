from functools import lru_cache
from typing import Literal
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: Literal["development", "staging", "production"] = "production"
    database_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    dev_otp: str = "123456"
    allow_demo_auth: bool = False
    allow_demo_payment: bool = False
    sms_url: str = ""
    sms_token: str = ""
    payment_provider: Literal["development", "razorpay"] = "razorpay"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_society_id: str = ""
    razorpay_accounts: dict[str, dict[str, str]] = {}
    platform_admin_user_ids: list[str] = []
    storage_backend: Literal["local", "s3", "supabase"] = "local"
    storage_path: str = "./uploads"
    s3_bucket: str = ""
    s3_endpoint_url: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "society"
    cors_origins: list[str] = []

    @model_validator(mode="after")
    def secure_production(self):
        if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("replace-"):
            raise ValueError("Set JWT_SECRET to at least 32 random characters")
        if self.storage_backend == "supabase":
            if not self.supabase_url or not self.supabase_service_key:
                raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required when STORAGE_BACKEND=supabase")
        elif self.storage_backend == "s3":
            if not self.s3_bucket:
                raise ValueError("S3_BUCKET is required when STORAGE_BACKEND=s3")
        if self.app_env == "production":
            use_demo_auth = self.allow_demo_auth
            use_demo_payment = self.allow_demo_payment
            if not use_demo_payment and self.payment_provider == "development":
                raise ValueError("Production requires Razorpay unless ALLOW_DEMO_PAYMENT=true")
            if not use_demo_auth and not self.sms_url.startswith("https://"):
                raise ValueError("Production requires HTTPS SMS delivery unless ALLOW_DEMO_AUTH=true")
            # Societies without a configured merchant can use offline collections.
            for account in self.razorpay_accounts.values():
                if not all(account.get(k) for k in ("key_id", "key_secret", "webhook_secret")):
                    raise ValueError("Each Razorpay account needs key_id, key_secret and webhook_secret")
            if not use_demo_auth and not all([self.sms_token, self.sms_url]):
                raise ValueError("Production SMS credentials are required")
        return self


@lru_cache
def settings():
    return Settings()
