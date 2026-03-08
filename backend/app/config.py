from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Expense Tracker"
    database_url: str = "sqlite:///./data/expense_tracker.db"
    data_dir: Path = Path("./data")
    ml_model_dir: Path = Path("./data/ml_models")
    upload_dir: Path = Path("./data/uploads")

    ml_min_samples_to_train: int = 30
    ml_retrain_threshold: int = 20
    ml_high_confidence: float = 0.85
    ml_medium_confidence: float = 0.5

    class Config:
        env_prefix = "EXPENSE_TRACKER_"


settings = Settings()
