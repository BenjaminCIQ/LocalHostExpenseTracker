from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ImportProfile(Base):
    __tablename__ = "import_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    format: Mapped[str] = mapped_column(String(50), default="csv")

    delimiter: Mapped[str | None] = mapped_column(String(8), nullable=True)

    date_column: Mapped[str] = mapped_column(String(200))
    amount_column: Mapped[str] = mapped_column(String(200))
    currency_column: Mapped[str | None] = mapped_column(String(200), nullable=True)

    merchant_columns_json: Mapped[str] = mapped_column(Text, default="[]")
    description_columns_json: Mapped[str] = mapped_column(Text, default="[]")

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

