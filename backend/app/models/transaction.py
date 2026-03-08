from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        Index("ix_transactions_dedup", "dedup_hash", unique=True),
        Index("ix_transactions_date", "date"),
        Index("ix_transactions_merchant", "merchant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    import_batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("import_batches.id"), nullable=True
    )

    date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Float)
    raw_description: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    merchant: Mapped[str] = mapped_column(String(200), default="")
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    dedup_hash: Mapped[str] = mapped_column(String(64))

    predicted_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    final_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    classification_source: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    account: Mapped["Account"] = relationship(back_populates="transactions")
    import_batch: Mapped["ImportBatch | None"] = relationship(
        back_populates="transactions"
    )
    predicted_category: Mapped["Category | None"] = relationship(
        foreign_keys=[predicted_category_id]
    )
    final_category: Mapped["Category | None"] = relationship(
        foreign_keys=[final_category_id]
    )
