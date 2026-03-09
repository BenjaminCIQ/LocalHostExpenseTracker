from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MerchantCategoryStats(Base):
    __tablename__ = "merchant_category_stats"
    __table_args__ = (
        UniqueConstraint("merchant", "category_id", name="uq_merchant_category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant: Mapped[str] = mapped_column(String(200), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    count: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)

    category: Mapped["Category"] = relationship()


class MerchantAlias(Base):
    __tablename__ = "merchant_aliases"
    __table_args__ = (
        UniqueConstraint("normalized_source", name="uq_merchant_alias_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    normalized_source: Mapped[str] = mapped_column(String(200), index=True)
    canonical_merchant: Mapped[str] = mapped_column(String(200), index=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
