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


def test_bulk_update_fields_updates_unclassified_and_skips_classified(client, sample_csv: str):
    _upload(client, sample_csv)
    txns = client.get("/api/transactions/").json()["items"]
    assert len(txns) >= 3

    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    classified_id = txns[0]["id"]
    res = client.post(
        f"/api/transactions/{classified_id}/classify",
        json={"category_id": cat_id, "merchant": "REWE"},
    )
    assert res.status_code == 200

    all_ids = [t["id"] for t in txns]
    bulk = client.post(
        "/api/transactions/bulk-update-fields",
        json={"transaction_ids": all_ids, "merchant": "UPDATED", "re_predict": False},
    )
    assert bulk.status_code == 200
    body = bulk.json()
    assert body["updated"] == len(all_ids) - 1
    assert body["skipped"] == 1

    after = client.get("/api/transactions/").json()["items"]
    updated = {t["id"]: t for t in after}
    assert updated[classified_id]["merchant"] != "UPDATED"
    for tid in all_ids[1:]:
        assert updated[tid]["merchant"] == "UPDATED"


def test_bulk_update_fields_can_update_classified_with_flag(client, sample_csv: str):
    _upload(client, sample_csv)
    txns = client.get("/api/transactions/").json()["items"]
    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)
    classified_id = txns[0]["id"]

    res = client.post(
        f"/api/transactions/{classified_id}/classify",
        json={"category_id": cat_id, "merchant": "REWE"},
    )
    assert res.status_code == 200

    bulk = client.post(
        "/api/transactions/bulk-update-fields",
        json={
            "transaction_ids": [classified_id],
            "merchant": "UPDATED-CLASSIFIED",
            "allow_classified": True,
            "re_predict": False,
        },
    )
    assert bulk.status_code == 200
    body = bulk.json()
    assert body["updated"] == 1
    assert body["updated_classified"] == 1
    assert body["skipped"] == 0

    after = client.get(f"/api/transactions/{classified_id}").json()
    assert after["merchant"] == "UPDATED-CLASSIFIED"


def test_suggest_field_updates_returns_operator_candidates(client):
    sample = "\n".join(
        [
            "Some Bank Export",
            "Generated: 01.01.2026",
            "Datum;Betrag;Beschreibung;Auftraggeber/Empfänger",
            "02.01.2026;-10,00;PAYPAL *ACME STORE 12345;PAYPAL",
            "03.01.2026;-9,50;PAYPAL *ACME STORE 67890;SOMETHING ELSE",
            "04.01.2026;-12,00;PAYPAL *OTHER MERCHANT 11111;PAYPAL",
            "",
        ]
    )
    _upload(client, sample)
    txns = client.get("/api/transactions/?page_size=50").json()["items"]
    seed = next(t for t in txns if "PAYPAL" in t["raw_description"])

    res = client.get(f"/api/transactions/{seed['id']}/suggest-field-updates?limit=10&min_score=50&only_unclassified=true")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 1
    # Ensure we don't suggest the seed txn itself
    assert all(i["transaction_id"] != seed["id"] for i in items)
    # Extended metadata should be present for UI review.
    assert all(
        "reasons" in i
        and "matched_fields" in i
        and "score_components" in i
        and "is_classified" in i
        and "ml_suggested_merchant" in i
        and "ml_merchant_confidence" in i
        and "ml_suggested_description" in i
        and "ml_description_confidence" in i
        for i in items
    )


def test_transfer_link_and_filter_behavior(client):
    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-10",
            "amount": -100.0,
            "description": "Move to savings",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    assert t1.status_code == 201

    # Create another account for counterpart transfer leg.
    a2 = client.post("/api/accounts/", json={"name": "Savings", "currency": "EUR"})
    assert a2.status_code == 201
    account_2_id = a2.json()["id"]

    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": account_2_id,
            "date": "2026-01-10",
            "amount": 100.0,
            "description": "Transfer from checking",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    assert t2.status_code == 201

    id1 = t1.json()["id"]
    id2 = t2.json()["id"]
    link = client.post(
        "/api/transactions/transfers/link",
        json={"transaction_id": id1, "candidate_id": id2, "confidence": 0.97},
    )
    assert link.status_code == 200
    assert link.json()["linked"] is True

    only_transfers = client.get("/api/transactions/?transaction_kind=transfer").json()
    assert only_transfers["total"] >= 2

    no_transfers = client.get("/api/transactions/?include_transfers=false").json()
    assert all(item["is_internal_transfer"] is False for item in no_transfers["items"])


def test_transfer_candidates_and_auto_link(client):
    a2 = client.post("/api/accounts/", json={"name": "Brokerage", "currency": "EUR"})
    assert a2.status_code == 201
    account_2_id = a2.json()["id"]

    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-11",
            "amount": -250.0,
            "description": "internal move",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": account_2_id,
            "date": "2026-01-11",
            "amount": 250.0,
            "description": "internal move",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    assert t1.status_code == 201
    assert t2.status_code == 201

    cand = client.get("/api/transactions/transfer-candidates?limit=50")
    assert cand.status_code == 200
    assert any(
        {row["transaction_id"], row["candidate_id"]} == {t1.json()["id"], t2.json()["id"]}
        for row in cand.json()
    )

    linked = client.post("/api/transactions/transfers/auto-link?limit=50")
    assert linked.status_code == 200
    body = linked.json()
    assert body["reviewed"] >= 1


def test_analytics_excludes_transfers_by_default_household_and_includes_for_account(client):
    a2 = client.post("/api/accounts/", json={"name": "Wallet", "currency": "EUR"})
    assert a2.status_code == 201
    account_2_id = a2.json()["id"]

    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-15",
            "amount": -120.0,
            "description": "to wallet",
            "merchant": "Internal",
            "currency": "EUR",
        },
    ).json()
    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": account_2_id,
            "date": "2026-01-15",
            "amount": 120.0,
            "description": "from checking",
            "merchant": "Internal",
            "currency": "EUR",
        },
    ).json()

    client.post(
        "/api/transactions/transfers/link",
        json={"transaction_id": t1["id"], "candidate_id": t2["id"], "confidence": 1.0},
    )

    household = client.get("/api/analytics/timeseries?granularity=monthly")
    assert household.status_code == 200
    points = household.json()["points"]
    # Household view excludes linked internal transfers by default.
    assert all(abs(p["income"]) < 0.001 and abs(p["expenses"]) < 0.001 for p in points)

    account_view = client.get("/api/analytics/timeseries?granularity=monthly&account_id=1")
    assert account_view.status_code == 200
    account_points = account_view.json()["points"]
    assert any(abs(p["expenses"]) > 0.001 for p in account_points)

