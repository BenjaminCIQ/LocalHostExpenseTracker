from dataclasses import dataclass

from app.pipeline.base import (
    ClassificationResult,
    PipelineStage,
    TransactionContext,
)
from app.pipeline.pipeline import ClassificationPipeline


@dataclass
class DummyStage(PipelineStage):
    _name: str
    _enabled: bool = True
    result: ClassificationResult | None = None
    raises: bool = False

    @property
    def name(self) -> str:
        return self._name

    @property
    def enabled(self) -> bool:
        return self._enabled

    def classify(self, _ctx: TransactionContext) -> ClassificationResult | None:
        if self.raises:
            raise RuntimeError("stage failed")
        return self.result


def _ctx() -> TransactionContext:
    return TransactionContext(
        transaction_id=1,
        description="test",
        raw_description="test",
        merchant="",
        amount=-1.0,
        date="2026-01-01",
    )


def test_pipeline_returns_first_classified_result():
    s1 = DummyStage(
        _name="s1",
        result=ClassificationResult(category_id=1, confidence=0.9, source="a"),
    )
    s2 = DummyStage(
        _name="s2",
        result=ClassificationResult(category_id=2, confidence=0.9, source="b"),
    )
    pipe = ClassificationPipeline([s1, s2])
    res = pipe.classify(_ctx())
    assert res.category_id == 1
    assert res.stage_name == "s1"


def test_pipeline_skips_disabled_stage():
    s1 = DummyStage(
        _name="disabled",
        _enabled=False,
        result=ClassificationResult(category_id=1, confidence=0.9, source="a"),
    )
    s2 = DummyStage(
        _name="enabled",
        result=ClassificationResult(category_id=2, confidence=0.9, source="b"),
    )
    pipe = ClassificationPipeline([s1, s2])
    res = pipe.classify(_ctx())
    assert res.category_id == 2
    assert res.stage_name == "enabled"


def test_pipeline_falls_back_to_unclassified():
    s1 = DummyStage(_name="s1", result=None)
    pipe = ClassificationPipeline([s1])
    res = pipe.classify(_ctx())
    assert res.category_id is None
    assert res.source == "unclassified"
    assert res.stage_name == "none"


def test_pipeline_stage_exception_does_not_crash():
    s1 = DummyStage(_name="bad", raises=True)
    s2 = DummyStage(
        _name="good",
        result=ClassificationResult(category_id=7, confidence=0.8, source="ok"),
    )
    pipe = ClassificationPipeline([s1, s2])
    res = pipe.classify(_ctx())
    assert res.category_id == 7

