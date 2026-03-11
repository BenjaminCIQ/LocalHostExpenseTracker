from datetime import date

from app.models.account import Account
from app.models.category import Category
from app.models.person import Person
from app.models.transaction import Transaction


def test_persons_crud(client):
    res = client.post("/api/persons/", json={"name": "Spouse"})
    assert res.status_code == 201
    pid = res.json()["id"]

    res2 = client.get("/api/persons/")
    assert res2.status_code == 200
    assert any(p["id"] == pid for p in res2.json())

    res3 = client.put(f"/api/persons/{pid}", json={"name": "Partner"})
    assert res3.status_code == 200
    assert res3.json()["name"] == "Partner"

    res4 = client.delete(f"/api/persons/{pid}")
    assert res4.status_code == 204


def test_account_can_be_assigned_to_person(client, seeded_db):
    p = Person(name="Spouse")
    seeded_db.add(p)
    seeded_db.commit()

    res = client.post(
        "/api/accounts/",
        json={"name": "Spouse Account", "person_id": p.id, "currency": "EUR"},
    )
    assert res.status_code == 201
    assert res.json()["person_id"] == p.id

    acc_id = res.json()["id"]
    res2 = client.patch(f"/api/accounts/{acc_id}", json={"person_id": None})
    assert res2.status_code == 200
    assert res2.json()["person_id"] is None


def test_person_filter_on_transactions_and_dashboard(client, seeded_db):
    p1 = Person(name="A")
    p2 = Person(name="B")
    seeded_db.add_all([p1, p2])
    seeded_db.flush()

    a1 = Account(name="A acc", currency="EUR", person_id=p1.id)
    a2 = Account(name="B acc", currency="EUR", person_id=p2.id)
    seeded_db.add_all([a1, a2])
    seeded_db.flush()

    expense_cat = seeded_db.query(Category).filter(Category.name == "Groceries").first()
    assert expense_cat is not None

    seeded_db.add_all(
        [
            Transaction(
                account_id=a1.id,
                import_batch_id=None,
                date=date(2026, 1, 1),
                amount=-10.0,
                raw_description="A spend",
                description="A spend",
                merchant="M",
                currency="EUR",
                dedup_hash="a1",
                final_category_id=expense_cat.id,
            ),
            Transaction(
                account_id=a2.id,
                import_batch_id=None,
                date=date(2026, 1, 2),
                amount=-20.0,
                raw_description="B spend",
                description="B spend",
                merchant="M",
                currency="EUR",
                dedup_hash="b1",
                final_category_id=expense_cat.id,
            ),
        ]
    )
    seeded_db.commit()

    tx_a = client.get(f"/api/transactions/?person_id={p1.id}")
    assert tx_a.status_code == 200
    assert tx_a.json()["total"] == 1

    dash_a = client.get(f"/api/dashboard/?person_id={p1.id}")
    assert dash_a.status_code == 200
    assert dash_a.json()["total_expenses"] == 10.0

