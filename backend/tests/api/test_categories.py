def test_list_categories_seeded(client):
    res = client.get("/api/categories/")
    assert res.status_code == 200
    cats = res.json()
    assert len(cats) == 54


def test_category_tree_has_children(client):
    res = client.get("/api/categories/tree")
    assert res.status_code == 200
    tree = res.json()
    assert isinstance(tree, list)
    assert len(tree) > 0
    # At least one top-level category has children.
    assert any(len(c.get("children", [])) > 0 for c in tree)


def test_create_update_delete_category(client):
    create = client.post(
        "/api/categories/",
        json={"name": "Test Category", "parent_id": None, "is_income": False, "sort_order": 123},
    )
    assert create.status_code == 201
    cat = create.json()
    cat_id = cat["id"]

    update = client.put(
        f"/api/categories/{cat_id}",
        json={"name": "Test Category Renamed", "parent_id": None, "is_income": False, "sort_order": 124},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Test Category Renamed"

    delete = client.delete(f"/api/categories/{cat_id}")
    assert delete.status_code == 204

