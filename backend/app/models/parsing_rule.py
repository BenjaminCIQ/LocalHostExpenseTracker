from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ParsingRule(Base):
    __tablename__ = "parsing_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=100)

    import_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_profiles.id"), nullable=True
    )

    operator_token: Mapped[str | None] = mapped_column(String(50), nullable=True)
    match_regex: Mapped[str] = mapped_column(Text)

    merchant_group: Mapped[int] = mapped_column(Integer, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

