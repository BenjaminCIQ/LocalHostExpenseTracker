from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ClassificationLog(Base):
    __tablename__ = "classification_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"))
    predicted_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    final_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    classification_source: Mapped[str] = mapped_column(String(50))
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    pipeline_stage: Mapped[str] = mapped_column(String(50))
    timestamp: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    transaction: Mapped["Transaction"] = relationship()
    predicted_category: Mapped["Category | None"] = relationship(
        foreign_keys=[predicted_category_id]
    )
    final_category: Mapped["Category | None"] = relationship(
        foreign_keys=[final_category_id]
    )
