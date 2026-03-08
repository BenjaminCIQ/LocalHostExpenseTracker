from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
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
