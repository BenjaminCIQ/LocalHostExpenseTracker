def test_delete_external_account(client):
    create = client.post(
        "/api/external-accounts/",
        json={
            "name": "To Delete",
            "account_type": "investment",
            "account_group": "asset",
            "currency": "EUR",
        },
    )
    assert create.status_code == 201
    external_id = create.json()["id"]

    del_res = client.delete(f"/api/external-accounts/{external_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/external-accounts/{external_id}/snapshots")
    assert get_res.status_code == 404


def test_external_account_snapshot_and_reconciliation(client):
    create = client.post(
        "/api/external-accounts/",
        json={
            "name": "Crypto Wallet",
            "account_type": "crypto",
            "account_group": "asset",
            "currency": "EUR",
        },
    )
    assert create.status_code == 201
    external_id = create.json()["id"]

    snap = client.post(
        f"/api/external-accounts/{external_id}/snapshots",
        json={
            "snapshot_date": "2026-01-20T00:00:00",
            "value": 1250.0,
            "source": "manual",
        },
    )
    assert snap.status_code == 201

    rec = client.get(f"/api/external-accounts/{external_id}/reconciliation")
    assert rec.status_code == 200
    assert rec.json()["latest_value"] == 1250.0
    assert rec.json()["linked_funding_total"] == 0.0


def test_external_funding_link_validation_and_override(client):
    ext = client.post(
        "/api/external-accounts/",
        json={"name": "Brokerage", "account_type": "investment", "account_group": "asset"},
    )
    assert ext.status_code == 201
    external_id = ext.json()["id"]

    txn = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-12",
            "amount": -300.0,
            "description": "Wire out",
            "merchant": "Bank",
            "currency": "EUR",
        },
    )
    assert txn.status_code == 201
    txn_id = txn.json()["id"]

    # funding_in = into external = outflow from bank (negative amount) -> allowed
    ok_in = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={"transaction_id": txn_id, "linked_amount": 300.0, "link_type": "funding_in"},
    )
    assert ok_in.status_code == 201

    # funding_out with negative-amount txn rejected (expects inflow to bank = positive)
    bad_out = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={"transaction_id": txn_id, "linked_amount": 300.0, "link_type": "funding_out"},
    )
    assert bad_out.status_code == 400

    # Override allows wrong direction if needed.
    txn2 = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-13",
            "amount": 100.0,
            "description": "Wire in",
            "merchant": "Bank",
            "currency": "EUR",
        },
    )
    assert txn2.status_code == 201
    ok_override = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={
            "transaction_id": txn2.json()["id"],
            "linked_amount": 100.0,
            "link_type": "funding_in",
            "override_validation": True,
        },
    )
    assert ok_override.status_code == 201


def test_net_worth_includes_external_items(client):
    ext = client.post(
        "/api/external-accounts/",
        json={"name": "Used Car", "account_type": "vehicle", "account_group": "asset"},
    )
    assert ext.status_code == 201
    external_id = ext.json()["id"]
    client.post(
        f"/api/external-accounts/{external_id}/snapshots",
        json={"snapshot_date": "2026-01-21T00:00:00", "value": 9000.0, "source": "manual"},
    )
    res = client.get("/api/analytics/net-worth")
    assert res.status_code == 200
    body = res.json()
    assert "external_items" in body
    assert any(item["external_account_id"] == external_id for item in body["external_items"])


def test_external_funding_summary_with_filters(client):
    ext = client.post(
        "/api/external-accounts/",
        json={"name": "Brokerage 2", "account_type": "investment", "account_group": "asset"},
    )
    assert ext.status_code == 201
    external_id = ext.json()["id"]

    out_txn = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-12",
            "amount": -450.0,
            "description": "Transfer to brokerage",
            "merchant": "Bank",
            "currency": "EUR",
        },
    )
    assert out_txn.status_code == 201
    out_txn_id = out_txn.json()["id"]

    in_txn = client.post(
        "/api/transactions/manual",
        json={
            "account_id": 1,
            "date": "2026-01-20",
            "amount": 120.0,
            "description": "Transfer back from brokerage",
            "merchant": "Bank",
            "currency": "EUR",
        },
    )
    assert in_txn.status_code == 201
    in_txn_id = in_txn.json()["id"]

    link_out = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={
            "transaction_id": out_txn_id,
            "linked_amount": 450.0,
            "link_type": "funding_in",
            "override_validation": True,
        },
    )
    assert link_out.status_code == 201

    link_in = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={
            "transaction_id": in_txn_id,
            "linked_amount": 120.0,
            "link_type": "funding_out",
            "override_validation": True,
        },
    )
    assert link_in.status_code == 201

    summary = client.get("/api/external-accounts/funding-summary?month=2026-01")
    assert summary.status_code == 200
    payload = summary.json()
    assert payload["funding_in_total"] == 450.0
    assert payload["funding_out_total"] == 120.0
    assert payload["net_external_flow"] == 330.0
    assert payload["links_count"] >= 2
