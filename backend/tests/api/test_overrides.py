def test_overrides_crud_and_test(client):
    cats = client.get("/api/categories/").json()
    cat_id = next(c["id"] for c in cats if c.get("parent_id") is not None)

    create = client.post(
        "/api/overrides/",
        json={"pattern": "rewe", "category_id": cat_id, "is_regex": False, "priority": 10},
    )
    assert create.status_code == 201
    ov = create.json()

    lst = client.get("/api/overrides/").json()
    assert any(o["id"] == ov["id"] for o in lst)

    test = client.post(f"/api/overrides/{ov['id']}/test", json={"description": "REWE SAGT DANKE"})
    assert test.status_code == 200
    assert test.json()["matches"] is True

    update = client.put(
        f"/api/overrides/{ov['id']}",
        json={"pattern": r"rewe\s+sagt", "is_regex": True},
    )
    assert update.status_code == 200
    assert update.json()["is_regex"] is True

    test2 = client.post(
        f"/api/overrides/{ov['id']}/test",
        json={"description": "REWE SAGT DANKE"},
    )
    assert test2.status_code == 200
    assert test2.json()["matches"] is True

    delete = client.delete(f"/api/overrides/{ov['id']}")
    assert delete.status_code == 204

