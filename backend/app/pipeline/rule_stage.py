from collections.abc import Callable

from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal
from app.models.rule import Rule, RuleCondition
from app.pipeline.base import ClassificationResult, PipelineStage, TransactionContext


class RuleEngineStage(PipelineStage):
    name = "rule_engine"

    def __init__(self, session_factory: Callable[[], Session] = SessionLocal) -> None:
        self._session_factory = session_factory

    @property
    def enabled(self) -> bool:
        return True

    def classify(self, ctx: TransactionContext) -> ClassificationResult | None:
        db = self._session_factory()
        try:
            rules: list[Rule] = (
                db.query(Rule)
                .options(joinedload(Rule.conditions))
                .filter(Rule.enabled.is_(True))
                .order_by(Rule.priority.desc(), Rule.id.desc())
                .all()
            )
        finally:
            db.close()

        for rule in rules:
            if not rule.conditions:
                continue
            matches = self.evaluate_rule(rule, ctx)
            if matches:
                return ClassificationResult(
                    category_id=rule.category_id,
                    confidence=1.0,
                    source="rule_engine",
                )
        return None

    def evaluate_rule(self, rule: Rule, ctx: TransactionContext) -> bool:
        results = [self._evaluate_condition(c, ctx) for c in rule.conditions]
        logic = (rule.logic or "AND").upper()
        if logic == "OR":
            return any(results)
        return all(results)

    def _evaluate_condition(self, cond: RuleCondition, ctx: TransactionContext) -> bool:
        field = (cond.field or "").lower()
        op = (cond.operator or "").lower()
        value = cond.value or ""

        if field in ("description", "merchant"):
            haystack = getattr(ctx, field, "") or ""
            hay = haystack.lower()
            needle = value.lower()

            if op == "contains":
                return needle in hay
            if op == "not_contains":
                return needle not in hay
            if op == "equals":
                return hay.strip() == needle.strip()
            if op == "starts_with":
                return hay.strip().startswith(needle.strip())
            return False

        if field == "amount":
            try:
                target = float(value)
            except ValueError:
                return False
            amt = float(ctx.amount)
            if op == "gt":
                return amt > target
            if op == "gte":
                return amt >= target
            if op == "lt":
                return amt < target
            if op == "lte":
                return amt <= target
            if op == "equals":
                return amt == target
            return False

        return False

