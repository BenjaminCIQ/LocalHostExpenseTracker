def test_upload_csv_imports_transactions(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["transactions_imported"] == 3
    assert data["duplicates_skipped"] == 0
    assert data["account_id"] == 1


def test_upload_same_file_skips_duplicates(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res1 = client.post("/api/upload/?account_id=1", files=files)
    assert res1.status_code == 200

    res2 = client.post("/api/upload/?account_id=1", files=files)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["transactions_imported"] == 0
    assert data2["duplicates_skipped"] == 3


def test_upload_invalid_account_returns_404(client, sample_csv: str):
    files = {"file": ("export.csv", sample_csv.encode("utf-8"), "text/csv")}
    res = client.post("/api/upload/?account_id=999999", files=files)
    assert res.status_code == 404


def test_upload_unsupported_format_returns_400(client):
    files = {"file": ("export.txt", b"not supported", "text/plain")}
    res = client.post("/api/upload/?account_id=1", files=files)
    assert res.status_code == 400

