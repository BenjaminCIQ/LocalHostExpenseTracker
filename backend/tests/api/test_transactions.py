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
    assert "income_min" in data
    assert "income_max" in data
    assert "expense_min_abs" in data
    assert "expense_max_abs" in data


def test_transactions_support_separate_income_expense_ranges(client):
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-01",
            "amount": 2000.0,
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
            "amount": -120.0,
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
            "amount": -800.0,
            "description": "Rent",
            "merchant": "Landlord",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-04",
            "amount": 150.0,
            "description": "Refund",
            "merchant": "Shop",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-05",
            "amount": 0.0,
            "description": "Zero adjustment",
            "merchant": "System",
            "currency": "EUR",
        },
    )

    res = client.get(
        "/api/transactions/?income_min=1000&income_max=2500&expense_min_abs=100&expense_max_abs=200"
    )
    assert res.status_code == 200
    amounts = [item["amount"] for item in res.json()["items"]]
    assert 2000.0 in amounts
    assert -120.0 in amounts
    assert -800.0 not in amounts
    assert 150.0 not in amounts
    assert 0.0 not in amounts


def test_search_and_merchant_filter(client, sample_csv: str):
    _upload(client, sample_csv)
    res = client.get("/api/transactions/?merchant=spotify")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1

    res2 = client.get("/api/transactions/?q=gehalt")
    assert res2.status_code == 200
    assert res2.json()["total"] >= 1


def test_search_multimatch_and_or_grouping(client):
    """Test multi-match search: + AND, | OR, () grouping."""
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-01",
            "amount": -50.0,
            "description": "REWE Groceries",
            "merchant": "REWE",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-02",
            "amount": -30.0,
            "description": "Lidl Groceries",
            "merchant": "Lidl",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-03",
            "amount": -20.0,
            "description": "REWE Snacks",
            "merchant": "REWE",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-04",
            "amount": -10.0,
            "description": "Lidl Drinks",
            "merchant": "Lidl",
            "currency": "EUR",
        },
    )

    # OR: REWE|Lidl -> any merchant REWE or Lidl
    or_res = client.get("/api/transactions/", params={"q": "REWE|Lidl"})
    assert or_res.status_code == 200
    or_items = or_res.json()["items"]
    assert len(or_items) >= 4
    merchants = {i["merchant"] for i in or_items}
    assert "REWE" in merchants
    assert "Lidl" in merchants

    # AND: REWE+Groceries -> REWE and Groceries (+ must be %2B in URL)
    and_res = client.get("/api/transactions/", params={"q": "REWE+Groceries"})
    assert and_res.status_code == 200
    and_items = and_res.json()["items"]
    assert len(and_items) >= 1
    assert all("REWE" in (i.get("merchant") or "") or "REWE" in (i.get("description") or "") for i in and_items)
    assert all("Groceries" in (i.get("description") or "") for i in and_items)

    # Grouping: (REWE|Lidl)+Groceries -> (REWE or Lidl) and Groceries
    group_res = client.get("/api/transactions/", params={"q": "(REWE|Lidl)+Groceries"})
    assert group_res.status_code == 200
    group_items = group_res.json()["items"]
    assert len(group_items) >= 2


def test_filter_by_multiple_accounts(client):
    a2 = client.post("/api/accounts/", json={"name": "Savings", "currency": "EUR"})
    assert a2.status_code == 201
    account_2_id = a2.json()["id"]

    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-02-01",
            "amount": -10.0,
            "description": "Coffee A",
            "merchant": "Cafe",
            "currency": "EUR",
        },
    )
    assert t1.status_code == 201
    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": account_2_id,
            "date": "2026-02-01",
            "amount": -20.0,
            "description": "Coffee B",
            "merchant": "Cafe",
            "currency": "EUR",
        },
    )
    assert t2.status_code == 201

    only_a1 = client.get("/api/transactions/?account_ids=1").json()
    assert all(item["account_id"] == 1 for item in only_a1["items"])

    both = client.get(f"/api/transactions/?account_ids=1,{account_2_id}").json()
    account_ids = {item["account_id"] for item in both["items"]}
    assert 1 in account_ids
    assert account_2_id in account_ids


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

    cand = client.get(
        "/api/transactions/transfer-candidates?limit=50&seed_limit=100&max_results=10&min_confidence=0.4&amount_tolerance=0.0&date_window_days=3"
    )
    assert cand.status_code == 200
    rows = cand.json()
    assert any(
        {row["transaction_id"], row["candidate_id"]} == {t1.json()["id"], t2.json()["id"]}
        for row in rows
    )
    first = rows[0]
    assert "reasons" in first
    assert "transaction_description" in first
    assert "candidate_description" in first
    assert "transaction_merchant" in first
    assert "candidate_merchant" in first

    linked = client.post("/api/transactions/transfers/auto-link?limit=50")
    assert linked.status_code == 200
    body = linked.json()
    assert body["reviewed"] >= 1


def test_potential_duplicates_checker_endpoint(client):
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-02-10",
            "amount": -44.0,
            "description": "Market city center",
            "merchant": "Market",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-02-10",
            "amount": -44.0,
            "description": "Market city centre",
            "merchant": "Market",
            "currency": "EUR",
        },
    )
    res = client.get("/api/transactions/potential-duplicates?limit=20")
    assert res.status_code == 200
    items = res.json()
    assert isinstance(items, list)
    assert any(item["rating"] >= 0.72 for item in items)


def test_transfer_auto_link_honors_threshold_override(client):
    a2 = client.post("/api/accounts/", json={"name": "Cash", "currency": "EUR"})
    assert a2.status_code == 201
    account_2_id = a2.json()["id"]

    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-12",
            "amount": -199.0,
            "description": "move to cash",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": account_2_id,
            "date": "2026-01-13",
            "amount": 200.0,
            "description": "move from checking",
            "merchant": "Internal",
            "currency": "EUR",
        },
    )
    assert t1.status_code == 201
    assert t2.status_code == 201
    id1 = t1.json()["id"]
    id2 = t2.json()["id"]

    strict = client.post("/api/transactions/transfers/auto-link?limit=50&min_auto_confidence=0.99")
    assert strict.status_code == 200
    assert strict.json()["linked"] == 0

    relaxed = client.post("/api/transactions/transfers/auto-link?limit=50&min_auto_confidence=0.4")
    assert relaxed.status_code == 200
    assert relaxed.json()["linked"] >= 1

    tx1 = client.get(f"/api/transactions/{id1}").json()
    tx2 = client.get(f"/api/transactions/{id2}").json()
    assert tx1["transfer_group_id"] is not None
    assert tx1["transfer_group_id"] == tx2["transfer_group_id"]


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


def test_analytics_trip_include_exclusion_and_trip_scoping(client, db_session):
    from datetime import date

    from app.models.trip import Trip, TripTransactionOverride

    t1 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-02-01",
            "amount": -100.0,
            "description": "Trip lunch",
            "merchant": "Trip Merchant A",
            "currency": "EUR",
        },
    ).json()
    t2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-02-02",
            "amount": -40.0,
            "description": "Groceries",
            "merchant": "Regular Merchant",
            "currency": "EUR",
        },
    ).json()

    trip_a = Trip(name="City Break", start_date=date(2026, 2, 1), end_date=date(2026, 2, 10))
    trip_b = Trip(name="Weekend", start_date=date(2026, 2, 1), end_date=date(2026, 2, 10))
    db_session.add(trip_a)
    db_session.add(trip_b)
    db_session.flush()
    db_session.add(
        TripTransactionOverride(
            trip_id=trip_a.id,
            transaction_id=t1["id"],
            include=True,
        )
    )
    db_session.add(
        TripTransactionOverride(
            trip_id=trip_b.id,
            transaction_id=t2["id"],
            include=True,
        )
    )
    db_session.commit()

    base = client.get("/api/analytics/timeseries?granularity=monthly")
    assert base.status_code == 200
    base_expenses = sum(point["expenses"] for point in base.json()["points"])
    assert abs(base_expenses - 140.0) < 0.001

    scoped = client.get(
        f"/api/analytics/timeseries?granularity=monthly&exclude_trip_included=true&excluded_trip_ids={trip_a.id}"
    )
    assert scoped.status_code == 200
    scoped_expenses = sum(point["expenses"] for point in scoped.json()["points"])
    assert abs(scoped_expenses - 40.0) < 0.001

    all_trip_excluded = client.get(
        "/api/analytics/timeseries?granularity=monthly&exclude_trip_included=true"
    )
    assert all_trip_excluded.status_code == 200
    excluded_expenses = sum(point["expenses"] for point in all_trip_excluded.json()["points"])
    assert abs(excluded_expenses) < 0.001


def test_analytics_merchant_name_filter(client):
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-01",
            "amount": -30.0,
            "description": "Coffee",
            "merchant": "Cafe Alpha",
            "currency": "EUR",
        },
    )
    client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-03-02",
            "amount": -90.0,
            "description": "Store run",
            "merchant": "Market Beta",
            "currency": "EUR",
        },
    )

    filtered = client.get("/api/analytics/timeseries?granularity=monthly&merchant_names=Cafe Alpha")
    assert filtered.status_code == 200
    filtered_expenses = sum(point["expenses"] for point in filtered.json()["points"])
    assert abs(filtered_expenses - 30.0) < 0.001

