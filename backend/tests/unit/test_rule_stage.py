from sqlalchemy.orm import sessionmaker

from app.models.category import Category
from app.models.rule import Rule, RuleCondition
from app.pipeline.base import TransactionContext
from app.pipeline.rule_stage import RuleEngineStage


def test_rule_stage_and_logic(seeded_db):
    cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert cat is not None

    rule = Rule(name="Netflix rule", category_id=cat.id, logic="AND", priority=10, enabled=True)
    seeded_db.add(rule)
    seeded_db.flush()
    seeded_db.add_all(
        [
            RuleCondition(rule_id=rule.id, field="description", operator="contains", value="netflix"),
            RuleCondition(rule_id=rule.id, field="amount", operator="lt", value="0"),
        ]
    )
    seeded_db.commit()

    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = RuleEngineStage(session_factory=factory)

    ctx = TransactionContext(
        transaction_id=1,
        description="NETFLIX.COM",
        raw_description="NETFLIX.COM",
        merchant="Netflix",
        amount=-12.99,
        date="2026-01-01",
    )
    res = stage.classify(ctx)
    assert res is not None
    assert res.category_id == cat.id
    assert res.source == "rule_engine"


def test_rule_stage_or_logic(seeded_db):
    cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert cat is not None

    rule = Rule(name="OR rule", category_id=cat.id, logic="OR", priority=10, enabled=True)
    seeded_db.add(rule)
    seeded_db.flush()
    seeded_db.add_all(
        [
            RuleCondition(rule_id=rule.id, field="merchant", operator="equals", value="spotify"),
            RuleCondition(rule_id=rule.id, field="description", operator="contains", value="netflix"),
        ]
    )
    seeded_db.commit()

    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = RuleEngineStage(session_factory=factory)

    ctx = TransactionContext(
        transaction_id=1,
        description="something",
        raw_description="something",
        merchant="Spotify",
        amount=-9.99,
        date="2026-01-01",
    )
    res = stage.classify(ctx)
    assert res is not None
    assert res.category_id == cat.id


def test_rule_stage_skips_disabled_rules(seeded_db):
    cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert cat is not None

    rule = Rule(name="Disabled", category_id=cat.id, logic="AND", priority=10, enabled=False)
    seeded_db.add(rule)
    seeded_db.flush()
    seeded_db.add(RuleCondition(rule_id=rule.id, field="description", operator="contains", value="x"))
    seeded_db.commit()

    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = RuleEngineStage(session_factory=factory)
    ctx = TransactionContext(
        transaction_id=1,
        description="x",
        raw_description="x",
        merchant="",
        amount=-1.0,
        date="2026-01-01",
    )
    assert stage.classify(ctx) is None

