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

    # Non transfer-like by default -> reject
    bad = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={"transaction_id": txn_id, "linked_amount": 300.0, "link_type": "funding_in"},
    )
    assert bad.status_code == 400

    # Override allowed.
    ok = client.post(
        f"/api/external-accounts/{external_id}/funding-links",
        json={
            "transaction_id": txn_id,
            "linked_amount": 300.0,
            "link_type": "funding_in",
            "override_validation": True,
        },
    )
    assert ok.status_code == 201


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
