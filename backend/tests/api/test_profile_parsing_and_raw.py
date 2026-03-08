from app.models.transaction import Transaction


def test_upload_with_import_profile_stores_raw_row_and_uses_mapping(client, db_session):
    profile_payload = {
        "name": "Sparkasse Export",
        "format": "csv",
        "delimiter": ";",
        "date_column": "Buchungstag",
        "amount_column": "Betrag",
        "currency_column": "Waehrung",
        "merchant_columns": ["Verwendungszweck", "Beguenstigter/Zahlungspflichtiger"],
        "description_columns": ["Buchungstext", "Verwendungszweck", "Info"],
        "enabled": True,
    }
    p = client.post("/api/import-profiles/", json=profile_payload).json()

    csv_content = "\n".join(
        [
            '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer";"BLZ";"Betrag";"Waehrung";"Info"',
            '"DE123";"02.01.2026";"02.01.2026";"Kartenzahlung";"POS 1234 ACME STORE//BERLIN/DE";"";"";"";"-42,50";"EUR";"extra"',
            "",
        ]
    )
    files = {"file": ("export.csv", csv_content.encode("utf-8"), "text/csv")}
    res = client.post(f"/api/upload/?account_id=1&import_profile_id={p['id']}", files=files)
    assert res.status_code == 200

    txn = db_session.query(Transaction).order_by(Transaction.id.desc()).first()
    assert txn is not None
    assert txn.raw_row_json is not None
    assert txn.raw_row_line is not None
    assert "ACME STORE" in (txn.raw_description or "") or "ACME" in (txn.raw_description or "")

    raw = client.get(f"/api/transactions/{txn.id}/raw")
    assert raw.status_code == 200
    body = raw.json()
    assert body["raw_row_json"] is not None
    assert body["raw_row_line"] is not None

