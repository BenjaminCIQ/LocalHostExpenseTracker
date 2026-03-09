from app.events.bus import Event
from app.events.consumers import ml_dataset_updater
from app.models.training_data import TrainingData


def test_ml_dataset_updater_prefers_raw_description(seeded_db, monkeypatch):
    monkeypatch.setattr(ml_dataset_updater, "SessionLocal", lambda: seeded_db)
    ml_dataset_updater.handle_transaction_classified(
        Event(
            name="transaction_classified",
            data={
                "transaction_id": 123,
                "description": "desc fallback",
                "raw_description": "RAW FULL TEXT",
                "merchant": "PAYPAL",
                "amount": -1.23,
                "category_id": 5,
                "source": "human",
            },
        )
    )
    row = seeded_db.query(TrainingData).filter(TrainingData.transaction_id == 123).one()
    assert row.text_features == "RAW FULL TEXT"

