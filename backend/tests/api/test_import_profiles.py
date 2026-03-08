def test_import_profiles_crud(client):
    payload = {
        "name": "My Bank CSV",
        "format": "csv",
        "delimiter": ";",
        "date_column": "Buchungstag",
        "amount_column": "Betrag",
        "currency_column": "Waehrung",
        "merchant_columns": ["Verwendungszweck", "Beguenstigter/Zahlungspflichtiger"],
        "description_columns": ["Buchungstext", "Verwendungszweck", "Info"],
        "enabled": True,
    }
    created = client.post("/api/import-profiles/", json=payload)
    assert created.status_code == 200
    p = created.json()
    assert p["id"] > 0
    assert p["name"] == payload["name"]

    listed = client.get("/api/import-profiles/")
    assert listed.status_code == 200
    assert any(x["id"] == p["id"] for x in listed.json())

    updated = client.put(
        f"/api/import-profiles/{p['id']}",
        json={"enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["enabled"] is False

    deleted = client.delete(f"/api/import-profiles/{p['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True

