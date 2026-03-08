from sqlalchemy.orm import sessionmaker

from app.models.category import Category
from app.models.user_override import UserOverride
from app.pipeline.base import TransactionContext
from app.pipeline.override_stage import UserOverrideStage


def test_override_stage_substring_match(seeded_db):
    child_cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert child_cat is not None

    seeded_db.add(
        UserOverride(pattern="rewe", category_id=child_cat.id, is_regex=False, priority=10)
    )
    seeded_db.commit()

    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = UserOverrideStage(session_factory=factory)
    res = stage.classify(
        TransactionContext(
            transaction_id=1,
            description="",
            raw_description="POS 1234 REWE SAGT DANKE",
            merchant="",
            amount=-1.0,
            date="2026-01-01",
        )
    )
    assert res is not None
    assert res.category_id == child_cat.id
    assert res.source == "override"
    assert res.confidence == 1.0


def test_override_stage_regex_match_and_priority(seeded_db):
    child_cat = seeded_db.query(Category).filter(Category.parent_id.isnot(None)).first()
    assert child_cat is not None

    seeded_db.add_all(
        [
            UserOverride(pattern="rewe", category_id=111111, is_regex=False, priority=1),
            UserOverride(pattern=r"rewe\s+sagt", category_id=child_cat.id, is_regex=True, priority=100),
        ]
    )
    seeded_db.commit()

    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = UserOverrideStage(session_factory=factory)
    res = stage.classify(
        TransactionContext(
            transaction_id=1,
            description="",
            raw_description="REWE SAGT DANKE",
            merchant="",
            amount=-1.0,
            date="2026-01-01",
        )
    )
    assert res is not None
    assert res.category_id == child_cat.id


def test_override_stage_no_match_returns_none(seeded_db):
    factory = sessionmaker(bind=seeded_db.get_bind())
    stage = UserOverrideStage(session_factory=factory)
    res = stage.classify(
        TransactionContext(
            transaction_id=1,
            description="",
            raw_description="Something else",
            merchant="",
            amount=-1.0,
            date="2026-01-01",
        )
    )
    assert res is None

