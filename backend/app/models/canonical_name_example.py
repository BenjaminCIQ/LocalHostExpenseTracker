from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CanonicalNameExample(Base):
    __tablename__ = "canonical_name_examples"

    id: Mapped[int] = mapped_column(primary_key=True)
    input_text: Mapped[str] = mapped_column(Text)
    input_merchant: Mapped[str] = mapped_column(String(200), default="")
    target_merchant: Mapped[str] = mapped_column(String(200), default="")
    target_description: Mapped[str] = mapped_column(Text, default="")
    count: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
