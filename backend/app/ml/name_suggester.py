import json
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel
from sqlalchemy.orm import Session

from app.config import settings
from app.ml.preprocessor import build_features
from app.models.canonical_name_example import CanonicalNameExample
from app.models.transaction import Transaction


class CanonicalNameSuggester:
    """Suggest canonical merchant/description values from user-confirmed edits."""

    def __init__(self) -> None:
        self._vectorizer: TfidfVectorizer | None = None
        self._feature_matrix = None
        self._targets_merchant: list[str] = []
        self._targets_description: list[str] = []
        self._is_trained = False
        self._num_examples = 0
        self._last_trained_at: str | None = None
        self._model_path = settings.ml_model_dir / "name_suggester.joblib"
        self._metadata_path = settings.ml_model_dir / "name_suggester_metadata.json"
        self._load_if_exists()

    @property
    def is_trained(self) -> bool:
        return self._is_trained

    @property
    def num_examples(self) -> int:
        return self._num_examples

    @property
    def last_trained_at(self) -> str | None:
        return self._last_trained_at

    def record_example(
        self,
        db: Session,
        *,
        input_description: str,
        input_merchant: str,
        target_merchant: str,
        target_description: str,
    ) -> None:
        feature = build_features(input_description, input_merchant)
        if not feature:
            return
        existing = (
            db.query(CanonicalNameExample)
            .filter(
                CanonicalNameExample.input_text == feature,
                CanonicalNameExample.input_merchant == (input_merchant or ""),
                CanonicalNameExample.target_merchant == (target_merchant or ""),
                CanonicalNameExample.target_description == (target_description or ""),
            )
            .first()
        )
        if existing:
            existing.count += 1
            db.add(existing)
            return
        db.add(
            CanonicalNameExample(
                input_text=feature,
                input_merchant=(input_merchant or "")[:200],
                target_merchant=(target_merchant or "")[:200],
                target_description=target_description or "",
                count=1,
            )
        )

    def retrain(self, db: Session) -> dict:
        rows = db.query(CanonicalNameExample).all()
        if len(rows) < 10:
            bootstrapped = self.bootstrap_from_existing_transactions(db)
            if bootstrapped > 0:
                db.commit()
                rows = db.query(CanonicalNameExample).all()

        expanded: list[CanonicalNameExample] = []
        for row in rows:
            repeats = max(1, int(row.count))
            expanded.extend([row] * repeats)
        if len(expanded) < 10:
            self._is_trained = False
            self._num_examples = len(expanded)
            return {"status": "insufficient_data", "num_examples": len(expanded)}

        features = [r.input_text for r in expanded]
        self._targets_merchant = [r.target_merchant for r in expanded]
        self._targets_description = [r.target_description for r in expanded]
        self._vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        self._feature_matrix = self._vectorizer.fit_transform(features)
        self._is_trained = True
        self._num_examples = len(expanded)
        self._last_trained_at = datetime.now(timezone.utc).isoformat()
        self._save()
        return {
            "status": "trained",
            "num_examples": self._num_examples,
            "last_trained_at": self._last_trained_at,
        }

    def bootstrap_from_existing_transactions(self, db: Session, limit: int = 25000) -> int:
        """Seed canonical-name examples from existing classified transactions."""
        existing_count = db.query(CanonicalNameExample).count()
        if existing_count > 0:
            return 0

        txns = (
            db.query(Transaction)
            .filter(
                Transaction.final_category_id.isnot(None),
                Transaction.merchant.isnot(None),
                Transaction.description.isnot(None),
            )
            .order_by(Transaction.id.asc())
            .limit(limit)
            .all()
        )
        added = 0
        for txn in txns:
            merchant = (txn.merchant or "").strip()
            description = (txn.description or "").strip()
            source_desc = (txn.raw_description or txn.description or "").strip()
            if not source_desc:
                continue
            if not merchant and not description:
                continue
            self.record_example(
                db,
                input_description=source_desc,
                input_merchant=merchant,
                target_merchant=merchant,
                target_description=description,
            )
            added += 1
        return added

    def suggest(self, description: str, merchant: str) -> dict[str, float | str | None]:
        if (
            not self._is_trained
            or self._vectorizer is None
            or self._feature_matrix is None
            or not self._targets_merchant
        ):
            return {
                "suggested_merchant": None,
                "merchant_confidence": 0.0,
                "suggested_description": None,
                "description_confidence": 0.0,
            }

        feature = build_features(description, merchant)
        if not feature:
            return {
                "suggested_merchant": None,
                "merchant_confidence": 0.0,
                "suggested_description": None,
                "description_confidence": 0.0,
            }

        vec = self._vectorizer.transform([feature])
        sims = linear_kernel(vec, self._feature_matrix).ravel()
        if sims.size == 0:
            return {
                "suggested_merchant": None,
                "merchant_confidence": 0.0,
                "suggested_description": None,
                "description_confidence": 0.0,
            }

        top_n = min(15, sims.shape[0])
        top_idx = np.argsort(sims)[::-1][:top_n]
        top_scores = np.clip(sims[top_idx], 0.0, 1.0)
        score_sum = float(np.sum(top_scores))
        if score_sum <= 0.0:
            return {
                "suggested_merchant": None,
                "merchant_confidence": 0.0,
                "suggested_description": None,
                "description_confidence": 0.0,
            }

        merchant_weights: dict[str, float] = {}
        desc_weights: dict[str, float] = {}
        for idx, sim in zip(top_idx, top_scores):
            merchant_value = (self._targets_merchant[idx] or "").strip()
            if merchant_value:
                merchant_weights[merchant_value] = merchant_weights.get(merchant_value, 0.0) + float(sim)
            desc_value = (self._targets_description[idx] or "").strip()
            if desc_value:
                desc_weights[desc_value] = desc_weights.get(desc_value, 0.0) + float(sim)

        best_merchant = max(merchant_weights.items(), key=lambda x: x[1], default=("", 0.0))
        best_desc = max(desc_weights.items(), key=lambda x: x[1], default=("", 0.0))

        merchant_conf = best_merchant[1] / score_sum if best_merchant[0] else 0.0
        desc_conf = best_desc[1] / score_sum if best_desc[0] else 0.0

        return {
            "suggested_merchant": best_merchant[0] or None,
            "merchant_confidence": round(float(merchant_conf), 4),
            "suggested_description": best_desc[0] or None,
            "description_confidence": round(float(desc_conf), 4),
        }

    def _save(self) -> None:
        if not self._is_trained:
            return
        settings.ml_model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "vectorizer": self._vectorizer,
                "feature_matrix": self._feature_matrix,
                "targets_merchant": self._targets_merchant,
                "targets_description": self._targets_description,
            },
            self._model_path,
        )
        meta = {
            "last_trained_at": self._last_trained_at,
            "num_examples": self._num_examples,
        }
        self._metadata_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    def _load_if_exists(self) -> None:
        if not self._model_path.exists():
            return
        try:
            payload = joblib.load(self._model_path)
            self._vectorizer = payload.get("vectorizer")
            self._feature_matrix = payload.get("feature_matrix")
            self._targets_merchant = list(payload.get("targets_merchant", []))
            self._targets_description = list(payload.get("targets_description", []))
            self._is_trained = bool(self._targets_merchant)
            if self._metadata_path.exists():
                meta = json.loads(self._metadata_path.read_text(encoding="utf-8"))
                self._last_trained_at = meta.get("last_trained_at")
                self._num_examples = int(meta.get("num_examples", len(self._targets_merchant)))
            else:
                self._num_examples = len(self._targets_merchant)
        except Exception:
            self._is_trained = False
            self._vectorizer = None
            self._feature_matrix = None
            self._targets_merchant = []
            self._targets_description = []
