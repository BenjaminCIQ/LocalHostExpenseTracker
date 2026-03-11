from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Expense Tracker"
    database_url: str = "sqlite:///./data/expense_tracker.db"
    database_passphrase: Optional[str] = None
    data_dir: Path = Path("./data")
    ml_model_dir: Path = Path("./data/ml_models")
    upload_dir: Path = Path("./data/uploads")
    static_dir: Optional[Path] = None
    env: str = "development"

    ml_min_samples_to_train: int = 30
    ml_retrain_threshold: int = 20
    ml_high_confidence: float = 0.85
    ml_medium_confidence: float = 0.5

    soft_similarity_min_score: int = 85
    soft_similarity_limit: int = 25

    transfer_amount_tolerance: float = 0.0
    transfer_date_window_days: int = 3
    transfer_high_confidence_threshold: float = 0.9
    transfer_review_confidence_threshold: float = 0.75
    transfer_candidate_seed_limit_default: int = 1200
    transfer_candidate_max_results_default: int = 400
    transfer_candidate_min_confidence_default: float = 0.55
    transfer_candidate_amount_tolerance_default: float = 5.0
    transfer_candidate_date_window_days_default: int = 5

    auth_cookie_name: str = "expense_tracker_session"
    auth_cookie_secure: bool = False
    auth_session_hours: int = 8
    auth_remember_days: int = 30
    auth_password_iterations: int = 390000
    auth_token_pepper: str = "change-me-in-production"
    auth_lockout_threshold: int = 5
    auth_lockout_window_minutes: int = 15
    auth_lockout_minutes: int = 15
    cors_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_allow_origin_regex: str = (
        r"^https?://("
        r"localhost|127\.0\.0\.1|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    )

    class Config:
        env_prefix = "EXPENSE_TRACKER_"
        extra = "ignore"


settings = Settings()
