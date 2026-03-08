def _upload(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200


def test_list_transactions_and_pagination(client, sample_csv: str):
    _upload(client, sample_csv)
    res = client.get("/api/transactions/?page=1&page_size=2")
    assert res.status_code == 200
    data = res.json()
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total"] == 3
    assert len(data["items"]) == 2


def test_filter_classified_unclassified(client, sample_csv: str):
    _upload(client, sample_csv)
    unclassified = client.get("/api/transactions/?classified=false")
    assert unclassified.status_code == 200
    assert unclassified.json()["total"] == 3


def test_transaction_bounds_endpoint(client, sample_csv: str):
    _upload(client, sample_csv)
    res = client.get("/api/transactions/bounds")
    assert res.status_code == 200
    data = res.json()
    assert data["min_date"] is not None
    assert data["max_date"] is not None
    assert data["min_amount"] is not None
    assert data["max_amount"] is not None


def test_search_and_merchant_filter(client, sample_csv: str):
    _upload(client, sample_csv)
    res = client.get("/api/transactions/?merchant=spotify")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1

    res2 = client.get("/api/transactions/?q=gehalt")
    assert res2.status_code == 200
    assert res2.json()["total"] >= 1


def test_classify_transaction_and_filters(client, sample_csv: str):
    _upload(client, sample_csv)

    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    txns = client.get("/api/transactions/").json()
    txn_id = txns["items"][0]["id"]

    classify = client.post(
        f"/api/transactions/{txn_id}/classify",
        json={"category_id": cat_id, "merchant": "REWE"},
    )
    assert classify.status_code == 200
    updated = classify.json()
    assert updated["final_category_id"] == cat_id
    assert updated["classification_source"] == "human"
    assert updated["confidence"] == 1.0

    classified = client.get("/api/transactions/?classified=true").json()
    assert classified["total"] == 1

    unclassified = client.get("/api/transactions/?classified=false").json()
    assert unclassified["total"] == 2


def test_classify_invalid_category_404(client, sample_csv: str):
    _upload(client, sample_csv)
    txn_id = client.get("/api/transactions/").json()["items"][0]["id"]
    res = client.post(
        f"/api/transactions/{txn_id}/classify",
        json={"category_id": 999999},
    )
    assert res.status_code == 404


def test_classify_invalid_transaction_404(client):
    res = client.post(
        "/api/transactions/999999/classify",
        json={"category_id": 1},
    )
    assert res.status_code == 404

