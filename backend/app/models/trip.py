from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index("ix_trips_start_date", "start_date"),
        Index("ix_trips_end_date", "end_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    destination: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    overrides: Mapped[list["TripTransactionOverride"]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
    )
    suggestions: Mapped[list["TripMembershipSuggestion"]] = relationship(
        back_populates="trip",
        cascade="all, delete-orphan",
    )


class TripTransactionOverride(Base):
    __tablename__ = "trip_transaction_overrides"
    __table_args__ = (
        UniqueConstraint(
            "trip_id",
            "transaction_id",
            name="uq_trip_transaction_override_trip_txn",
        ),
        Index("ix_trip_transaction_overrides_trip_id", "trip_id"),
        Index("ix_trip_transaction_overrides_transaction_id", "transaction_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"))
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    include: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    trip: Mapped["Trip"] = relationship(back_populates="overrides")


class TripMembershipSuggestion(Base):
    __tablename__ = "trip_membership_suggestions"
    __table_args__ = (
        UniqueConstraint(
            "trip_id",
            "transaction_id",
            name="uq_trip_membership_suggestion_trip_txn",
        ),
        Index("ix_trip_membership_suggestions_trip_id", "trip_id"),
        Index("ix_trip_membership_suggestions_transaction_id", "transaction_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"))
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    suggested_membership: Mapped[str] = mapped_column(String(10))  # include|exclude|review
    score: Mapped[float] = mapped_column(Float, default=0.0)
    reasons_json: Mapped[str] = mapped_column(Text, default="[]")
    is_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    trip: Mapped["Trip"] = relationship(back_populates="suggestions")

