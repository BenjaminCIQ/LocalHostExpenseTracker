def _upload_and_classify_one_expense(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200

    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    txns = client.get("/api/transactions/").json()["items"]
    expense_txn = next(t for t in txns if t["amount"] < 0)
    res2 = client.post(
        f"/api/transactions/{expense_txn['id']}/classify",
        json={"category_id": cat_id},
    )
    assert res2.status_code == 200


def test_dashboard_empty_returns_zeros(client):
    res = client.get("/api/dashboard/")
    assert res.status_code == 200
    data = res.json()
    assert data["total_income"] == 0.0
    assert data["total_expenses"] == 0.0
    assert data["classification_stats"]["total_transactions"] == 0


def test_dashboard_after_upload_and_classification(client, sample_csv: str):
    _upload_and_classify_one_expense(client, sample_csv)
    res = client.get("/api/dashboard/")
    assert res.status_code == 200
    data = res.json()

    assert data["classification_stats"]["total_transactions"] == 3
    assert data["classification_stats"]["classified"] == 1
    assert data["classification_stats"]["unclassified"] == 2

    # Income and expenses totals are computed from amounts (classification not required).
    assert data["total_income"] > 0
    assert data["total_expenses"] > 0

    # Spending by category should include the classified expense.
    assert len(data["spending_by_category"]) >= 1

