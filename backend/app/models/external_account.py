from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExternalAccount(Base):
    __tablename__ = "external_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    account_type: Mapped[str] = mapped_column(String(40), default="investment")
    account_group: Mapped[str] = mapped_column(String(20), default="asset")
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    owner: Mapped[str] = mapped_column(String(100), default="")
    person_id: Mapped[int | None] = mapped_column(ForeignKey("persons.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Future price-feed extension hooks.
    ticker: Mapped[str | None] = mapped_column(String(32), nullable=True)
    asset_class: Mapped[str | None] = mapped_column(String(40), nullable=True)
    pricing_provider: Mapped[str | None] = mapped_column(String(40), nullable=True)
    last_price_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    person: Mapped["Person | None"] = relationship(back_populates="external_accounts")
    snapshots: Mapped[list["ExternalValuationSnapshot"]] = relationship(
        back_populates="external_account", cascade="all, delete-orphan"
    )
    funding_links: Mapped[list["ExternalFundingLink"]] = relationship(
        back_populates="external_account", cascade="all, delete-orphan"
    )


class ExternalValuationSnapshot(Base):
    __tablename__ = "external_valuation_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_account_id: Mapped[int] = mapped_column(ForeignKey("external_accounts.id"))
    snapshot_date: Mapped[datetime] = mapped_column(DateTime)
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    external_account: Mapped["ExternalAccount"] = relationship(back_populates="snapshots")


class ExternalFundingLink(Base):
    __tablename__ = "external_funding_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    external_account_id: Mapped[int] = mapped_column(ForeignKey("external_accounts.id"))
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id"))
    linked_amount: Mapped[float] = mapped_column(Float)
    link_type: Mapped[str] = mapped_column(String(20), default="funding_in")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    external_account: Mapped["ExternalAccount"] = relationship(back_populates="funding_links")
    transaction: Mapped["Transaction"] = relationship()
