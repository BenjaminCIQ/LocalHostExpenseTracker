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


def _upload_and_classify_expense_and_income(client, sample_csv: str):
    """Upload sample CSV and classify one expense and the salary (income category)."""
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200

    cats = client.get("/api/categories/").json()
    salary_id = next(c["id"] for c in cats if c["name"] == "Salary")
    groceries_id = next(c["id"] for c in cats if c["name"] == "Groceries")

    txns = client.get("/api/transactions/").json()["items"]
    for t in txns:
        if t["amount"] < 0 and "REWE" in (t.get("merchant") or ""):
            client.post(f"/api/transactions/{t['id']}/classify", json={"category_id": groceries_id})
        elif t["amount"] > 0:
            client.post(f"/api/transactions/{t['id']}/classify", json={"category_id": salary_id})


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

    # Income/expense are category-based: only classified salary counts as income.
    # With only one expense classified, total_income=0, total_expenses=that expense.
    assert data["total_expenses"] > 0

    # Spending by category should include the classified expense.
    assert len(data["spending_by_category"]) >= 1


def test_dashboard_category_based_income_and_expense(client, sample_csv: str):
    """Income comes only from income categories; expense categories use net (refunds offset)."""
    _upload_and_classify_expense_and_income(client, sample_csv)
    res = client.get("/api/dashboard/")
    assert res.status_code == 200
    data = res.json()

    # Salary 2500 is classified to Salary (income category) -> total_income = 2500
    assert data["total_income"] == 2500.0
    # Only REWE expense (-42.50) classified to Groceries
    assert data["total_expenses"] == 42.5
    assert data["net"] == 2500.0 - 42.5


def test_dashboard_refund_offsets_expense_not_income(client):
    """Grocery refund reduces expense for that category; does not count as income."""
    cats = client.get("/api/categories/").json()
    salary_id = next(c["id"] for c in cats if c["name"] == "Salary")
    groceries_id = next(c["id"] for c in cats if c["name"] == "Groceries")

    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-01",
            "amount": 5000.0,
            "description": "Salary",
            "merchant": "Employer",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-02",
            "amount": -200.0,
            "description": "Groceries",
            "merchant": "Store",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-03",
            "amount": 50.0,
            "description": "Grocery refund",
            "merchant": "Store",
            "currency": "EUR",
        },
    )

    txns = client.get("/api/transactions/").json()["items"]
    for t in txns:
        if t["amount"] > 0:
            client.post(f"/api/transactions/{t['id']}/classify", json={"category_id": salary_id})
        else:
            client.post(f"/api/transactions/{t['id']}/classify", json={"category_id": groceries_id})
    # Classify the refund (positive) to Groceries too
    refund_txn = next(t for t in txns if t["amount"] == 50.0)
    client.post(f"/api/transactions/{refund_txn['id']}/classify", json={"category_id": groceries_id})

    res = client.get("/api/dashboard/")
    assert res.status_code == 200
    data = res.json()
    assert data["total_income"] == 5000.0
    # Net groceries: -200 + 50 = -150 -> expense displayed as 150
    assert data["total_expenses"] == 150.0
    assert data["net"] == 4850.0

