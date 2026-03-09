from datetime import datetime

from sqlalchemy import ForeignKey, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    bank_name: Mapped[str] = mapped_column(String(100), default="")
    account_type: Mapped[str] = mapped_column(String(50), default="checking")
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    owner: Mapped[str] = mapped_column(String(100), default="")
    person_id: Mapped[int | None] = mapped_column(
        ForeignKey("persons.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    person: Mapped["Person | None"] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account"
    )
    import_batches: Mapped[list["ImportBatch"]] = relationship(
        back_populates="account"
    )
