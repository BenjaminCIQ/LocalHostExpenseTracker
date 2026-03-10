from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TransferLinkingRule(Base):
    __tablename__ = "transfer_linking_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    source_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    target_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    source_keywords: Mapped[str] = mapped_column(String(500), default="")
    target_keywords: Mapped[str] = mapped_column(String(500), default="")
    date_window_days: Mapped[int] = mapped_column(Integer, default=3)
    amount_tolerance_abs: Mapped[float] = mapped_column(Float, default=0.01)
    amount_tolerance_pct: Mapped[float] = mapped_column(Float, default=0.01)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    source_account: Mapped["Account"] = relationship(
        foreign_keys=[source_account_id]
    )
    target_account: Mapped["Account"] = relationship(
        foreign_keys=[target_account_id]
    )
