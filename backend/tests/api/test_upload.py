def test_upload_csv_imports_transactions(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["transactions_imported"] == 3
    assert data["duplicates_skipped"] == 0
    assert data["account_id"] == 1
    assert "potential_duplicates" in data


def test_upload_same_file_skips_duplicates(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res1 = client.post("/api/upload/?account_id=1", files=files)
    assert res1.status_code == 200

    res2 = client.post("/api/upload/?account_id=1", files=files)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["transactions_imported"] == 0
    assert data2["duplicates_skipped"] == 3


def test_upload_potential_duplicate_review_and_override(client):
    first = "\n".join(
        [
            "Some Bank Export",
            "Generated: 01.01.2026",
            "Datum;Betrag;Beschreibung;Auftraggeber/Empfänger",
            "05.01.2026;-10,00;SUPERMARKET MAIN ST;LOCAL",
            "",
        ]
    )
    second = "\n".join(
        [
            "Some Bank Export",
            "Generated: 01.01.2026",
            "Datum;Betrag;Beschreibung;Auftraggeber/Empfänger",
            "05.01.2026;-10,00;SUPERMARKET MAIN STREET;LOCAL",
            "",
        ]
    )
    res1 = client.post("/api/upload/?account_id=1", files={"file": ("a.csv", first.encode("utf-8"), "text/csv")})
    assert res1.status_code == 200
    assert res1.json()["transactions_imported"] == 1

    res2 = client.post("/api/upload/?account_id=1", files={"file": ("b.csv", second.encode("utf-8"), "text/csv")})
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["transactions_imported"] == 0
    assert body2["duplicates_skipped"] >= 1
    assert len(body2["potential_duplicates"]) >= 1
    key = body2["potential_duplicates"][0]["duplicate_key"]

    res3 = client.post(
        "/api/upload/?account_id=1",
        files={
            "file": ("b.csv", second.encode("utf-8"), "text/csv"),
            "duplicate_override_keys_json": (None, f'["{key}"]'),
        },
    )
    assert res3.status_code == 200
    body3 = res3.json()
    assert body3["duplicate_overrides_applied"] >= 1
    assert body3["transactions_imported"] == 1


def test_upload_invalid_account_returns_404(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=999999", files=files)
    assert res.status_code == 404


def test_upload_unsupported_format_returns_400(client):
    files = {"file": ("export.txt", b"not supported", "text/plain")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 400

