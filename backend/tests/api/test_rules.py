def test_rules_crud_toggle_and_test(client):
    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    create = client.post(
        "/api/rules/",
        json={
            "name": "Netflix OR Spotify",
            "category_id": cat_id,
            "logic": "OR",
            "priority": 10,
            "enabled": True,
            "conditions": [
                {"field": "merchant", "operator": "equals", "value": "spotify"},
                {"field": "description", "operator": "contains", "value": "netflix"},
            ],
        },
    )
    assert create.status_code == 201
    rule = create.json()
    assert len(rule["conditions"]) == 2

    lst = client.get("/api/rules/").json()
    assert any(r["id"] == rule["id"] for r in lst)

    test = client.post(
        f"/api/rules/{rule['id']}/test",
        json={"description": "something", "merchant": "Spotify", "amount": -9.99},
    )
    assert test.status_code == 200
    assert test.json()["matches"] is True

    toggle = client.patch(f"/api/rules/{rule['id']}/toggle", json={"enabled": False})
    assert toggle.status_code == 200
    assert toggle.json()["enabled"] is False

    update = client.put(
        f"/api/rules/{rule['id']}",
        json={
            "logic": "AND",
            "conditions": [
                {"field": "description", "operator": "contains", "value": "netflix"},
                {"field": "amount", "operator": "lt", "value": "0"},
            ],
        },
    )
    assert update.status_code == 200
    updated = update.json()
    assert updated["logic"] == "AND"
    assert len(updated["conditions"]) == 2

    delete = client.delete(f"/api/rules/{rule['id']}")
    assert delete.status_code == 204

