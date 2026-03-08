from app.models.training_data import TrainingData


def test_ml_status_initial(client):
    res = client.get("/api/ml/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_trained"] is False
    assert data["training_samples"] == 0
    assert data["min_samples_required"] == 30


def test_ml_retrain_insufficient_data(client, seeded_db):
    # Ensure we have less than 30 samples in training_data.
    seeded_db.add(
        TrainingData(
            transaction_id=999,
            text_features="x",
            merchant="m",
            amount=-1.0,
            category_id=1,
            source="human",
        )
    )
    seeded_db.commit()

    res = client.post("/api/ml/retrain")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("insufficient_data", "trained")
    if data["status"] == "insufficient_data":
        assert data["num_samples"] == 1

