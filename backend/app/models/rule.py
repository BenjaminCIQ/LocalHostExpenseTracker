from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))

    # "AND" or "OR"
    logic: Mapped[str] = mapped_column(String(3), default="AND")

    priority: Mapped[int] = mapped_column(Integer, default=0, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    conditions: Mapped[list["RuleCondition"]] = relationship(
        back_populates="rule",
        cascade="all, delete-orphan",
        order_by="RuleCondition.id",
    )


class RuleCondition(Base):
    __tablename__ = "rule_conditions"
    __table_args__ = (
        UniqueConstraint("rule_id", "id", name="uq_rule_condition"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("rules.id", ondelete="CASCADE"))

    # "description" | "merchant" | "amount"
    field: Mapped[str] = mapped_column(String(50))
    # "contains" | "not_contains" | "equals" | "starts_with" | "gt" | "lt" | "gte" | "lte"
    operator: Mapped[str] = mapped_column(String(50))
    value: Mapped[str] = mapped_column(String(500))

    rule: Mapped["Rule"] = relationship(back_populates="conditions")

