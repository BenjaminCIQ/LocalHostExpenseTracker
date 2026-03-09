"""Singleton dependencies shared across the application."""

from app.ml.classifier import MLClassifier
from app.ml.name_suggester import CanonicalNameSuggester
from app.pipeline.ml_stage import MLClassifierStage
from app.pipeline.override_stage import UserOverrideStage
from app.pipeline.pipeline import ClassificationPipeline
from app.pipeline.rule_stage import RuleEngineStage

_classifier: MLClassifier | None = None
_name_suggester: CanonicalNameSuggester | None = None
_pipeline: ClassificationPipeline | None = None


def get_classifier() -> MLClassifier:
    global _classifier
    if _classifier is None:
        _classifier = MLClassifier()
    return _classifier


def get_name_suggester() -> CanonicalNameSuggester:
    global _name_suggester
    if _name_suggester is None:
        _name_suggester = CanonicalNameSuggester()
    return _name_suggester


def get_pipeline() -> ClassificationPipeline:
    global _pipeline
    if _pipeline is None:
        classifier = get_classifier()
        _pipeline = ClassificationPipeline(
            stages=[
                UserOverrideStage(),
                RuleEngineStage(),
                MLClassifierStage(classifier),
            ]
        )
    return _pipeline
