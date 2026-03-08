from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrainingData(Base):
    __tablename__ = "training_data"

    id: Mapped[int] = mapped_column(primary_key=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id"), unique=True
    )
    text_features: Mapped[str] = mapped_column(Text)
    merchant: Mapped[str] = mapped_column(String(200), default="")
    amount: Mapped[float] = mapped_column(Float)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    source: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    transaction: Mapped["Transaction"] = relationship()
    category: Mapped["Category"] = relationship()
