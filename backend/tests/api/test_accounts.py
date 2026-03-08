def test_list_accounts_returns_seeded_default(client):
    res = client.get("/api/accounts/")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "Main Account"


def test_create_and_get_account(client):
    create = client.post(
        "/api/accounts/",
        json={
            "name": "Savings",
            "bank_name": "TestBank",
            "account_type": "savings",
            "currency": "EUR",
            "owner": "Ben",
        },
    )
    assert create.status_code == 201
    created = create.json()
    assert created["id"] is not None
    assert created["name"] == "Savings"

    get_res = client.get(f"/api/accounts/{created['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Savings"


def test_get_account_404(client):
    res = client.get("/api/accounts/999999")
    assert res.status_code == 404

