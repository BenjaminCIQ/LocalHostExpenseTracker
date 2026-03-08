import pytest

from app.ml.classifier import MLClassifier


def test_predict_returns_none_when_untrained(classifier: MLClassifier):
    assert classifier.is_trained is False
    assert classifier.predict("some transaction", "merchant") is None


def test_train_and_predict_with_sufficient_samples(classifier: MLClassifier):
    texts = []
    merchants = []
    labels = []

    # Two classes with enough samples for the default training threshold (30).
    for _ in range(15):
        texts.append("Bought groceries at REWE")
        merchants.append("REWE")
        labels.append(1)

    for _ in range(15):
        texts.append("Monthly rent payment")
        merchants.append("Landlord")
        labels.append(2)

    metrics = classifier.train(texts, merchants, labels)
    assert metrics["status"] == "trained"
    assert metrics["num_samples"] == 30
    assert metrics["num_classes"] == 2
    assert classifier.is_trained is True

    pred = classifier.predict("REWE purchase", "REWE")
    assert pred is not None
    category_id, confidence = pred
    assert category_id in (1, 2)
    assert 0.0 <= confidence <= 1.0

    top = classifier.predict_top_n("REWE purchase", "REWE", n=2)
    assert len(top) == 2
    assert all(0.0 <= c <= 1.0 for _cat, c in top)


def test_train_insufficient_data_returns_status(tmp_path):
    from app.config import settings

    settings.ml_model_dir = tmp_path / "ml_models"
    small = MLClassifier()

    metrics = small.train(
        ["x"] * (settings.ml_min_samples_to_train - 1),
        ["m"] * (settings.ml_min_samples_to_train - 1),
        [1] * (settings.ml_min_samples_to_train - 1),
    )
    assert metrics["status"] == "insufficient_data"

