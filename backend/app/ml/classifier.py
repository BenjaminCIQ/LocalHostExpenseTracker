import logging
import json
from pathlib import Path
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

from app.ml.preprocessor import build_features
from app.config import settings

logger = logging.getLogger(__name__)


class MLClassifier:
    """TF-IDF + Logistic Regression multi-class classifier.

    This is intentionally a simple, interpretable pipeline:
    - TF-IDF converts transaction text into weighted term-frequency vectors
    - Logistic Regression learns a linear decision boundary per category
    - predict_proba gives calibrated confidence scores

    The simplicity makes it a good starting point for learning ML fundamentals
    before graduating to embeddings in Phase 5.
    """

    def __init__(self) -> None:
        self._vectorizer: TfidfVectorizer | None = None
        self._model: LogisticRegression | None = None
        self._is_trained: bool = False
        self._model_path = settings.ml_model_dir / "classifier.joblib"
        self._vectorizer_path = settings.ml_model_dir / "vectorizer.joblib"
        self._metadata_path = settings.ml_model_dir / "metadata.json"
        self._last_trained_at: str | None = None
        self._cross_val_accuracy: float | None = None
        self._trained_num_samples: int | None = None
        self._trained_num_classes: int | None = None
        self._load_if_exists()

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    @property
    def last_trained_at(self) -> str | None:
        return self._last_trained_at

    @property
    def cross_val_accuracy(self) -> float | None:
        return self._cross_val_accuracy

    @property
    def trained_num_samples(self) -> int | None:
        return self._trained_num_samples

    @property
    def trained_num_classes(self) -> int | None:
        return self._trained_num_classes

    def train(
        self,
        texts: list[str],
        merchants: list[str],
        labels: list[int],
    ) -> dict:
        """Train the classifier on labeled transaction data.

        Returns a dict with training metrics (accuracy, num_samples, num_classes).
        """
        if len(texts) < settings.ml_min_samples_to_train:
            logger.info(
                "Not enough samples to train (%d < %d)",
                len(texts),
                settings.ml_min_samples_to_train,
            )
            return {"status": "insufficient_data", "num_samples": len(texts)}

        features = [build_features(t, m) for t, m in zip(texts, merchants)]

        self._vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        X = self._vectorizer.fit_transform(features)

        self._model = LogisticRegression(
            max_iter=1000,
            solver="lbfgs",
            C=1.0,
            class_weight="balanced",
        )
        self._model.fit(X, labels)

        accuracy = float(np.mean(
            cross_val_score(self._model, X, labels, cv=min(5, len(set(labels))))
        )) if len(set(labels)) >= 2 else 1.0

        self._is_trained = True
        self._last_trained_at = datetime.now(timezone.utc).isoformat()
        self._cross_val_accuracy = round(accuracy, 4)
        self._trained_num_samples = len(texts)
        self._trained_num_classes = len(set(labels))
        self._save()

        metrics = {
            "status": "trained",
            "num_samples": len(texts),
            "num_classes": len(set(labels)),
            "cross_val_accuracy": round(accuracy, 4),
            "last_trained_at": self._last_trained_at,
        }
        logger.info("ML classifier trained: %s", metrics)
        return metrics

    def predict(
        self, description: str, merchant: str
    ) -> tuple[int, float] | None:
        """Predict category for a transaction.

        Returns (category_id, confidence) or None if not trained.
        confidence is the raw predicted probability of the winning class.
        """
        if not self._is_trained or self._model is None or self._vectorizer is None:
            return None

        feature = build_features(description, merchant)
        X = self._vectorizer.transform([feature])
        proba = self._model.predict_proba(X)[0]
        best_idx = int(np.argmax(proba))
        confidence = float(proba[best_idx])
        category_id = int(self._model.classes_[best_idx])
        return category_id, confidence

    def predict_top_n(
        self, description: str, merchant: str, n: int = 3
    ) -> list[tuple[int, float]]:
        """Return top N predictions with confidence scores (raw probabilities)."""
        if not self._is_trained or self._model is None or self._vectorizer is None:
            return []

        feature = build_features(description, merchant)
        X = self._vectorizer.transform([feature])
        proba = self._model.predict_proba(X)[0]
        top_indices = np.argsort(proba)[::-1][:n]

        return [
            (int(self._model.classes_[i]), float(proba[i]))
            for i in top_indices
        ]

    def _save(self) -> None:
        settings.ml_model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(self._vectorizer, self._vectorizer_path)
        joblib.dump(self._model, self._model_path)
        metadata = {
            "last_trained_at": self._last_trained_at,
            "cross_val_accuracy": self._cross_val_accuracy,
            "num_samples": self._trained_num_samples,
            "num_classes": self._trained_num_classes,
        }
        self._metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        logger.info("ML model saved to %s", self._model_path)

    def _load_if_exists(self) -> None:
        if self._model_path.exists() and self._vectorizer_path.exists():
            try:
                self._vectorizer = joblib.load(self._vectorizer_path)
                self._model = joblib.load(self._model_path)
                self._is_trained = True
                if self._metadata_path.exists():
                    meta = json.loads(self._metadata_path.read_text(encoding="utf-8"))
                    self._last_trained_at = meta.get("last_trained_at")
                    self._cross_val_accuracy = meta.get("cross_val_accuracy")
                    self._trained_num_samples = meta.get("num_samples")
                    self._trained_num_classes = meta.get("num_classes")
                else:
                    self._last_trained_at = datetime.fromtimestamp(
                        self._model_path.stat().st_mtime, tz=timezone.utc
                    ).isoformat()
                logger.info("ML model loaded from %s", self._model_path)
            except Exception:
                logger.exception("Failed to load ML model")
                self._is_trained = False
