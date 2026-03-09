def test_parsing_rules_crud_and_ingestion_apply(client):
    create = client.post(
        "/api/parsing-rules/",
        json={
            "name": "paypal merchant extract",
            "enabled": True,
            "priority": 10,
            "operator_token": "PAYPAL",
            "match_regex": r"paypal\s*\*\s*([^0-9/|]+)",
            "merchant_group": 1,
        },
    )
    assert create.status_code == 201

    rules = client.get("/api/parsing-rules/").json()
    assert any(r["name"] == "paypal merchant extract" for r in rules)

    sample = "\n".join(
        [
            "Some Bank Export",
            "Generated: 01.01.2026",
            "Datum;Betrag;Beschreibung;Auftraggeber/Empfänger",
            "02.01.2026;-10,00;PAYPAL *ACME STORE 12345;PAYPAL",
            "",
        ]
    )
    files = {"file": ("export.csv", sample.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200

    txns = client.get("/api/transactions/?page_size=50").json()["items"]
    assert len(txns) == 1
    assert "acme store" in txns[0]["merchant"].lower()

