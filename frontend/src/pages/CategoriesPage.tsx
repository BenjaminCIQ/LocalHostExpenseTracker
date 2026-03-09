import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import CategorySelect from "@/components/category/CategorySelect";
import { api, type Category, type CategoryCreate } from "@/lib/api";
import { buildCategoryTree, flattenCategoryTree } from "@/lib/categoryHierarchy";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  const [newCat, setNewCat] = useState<CategoryCreate>({
    name: "",
    parent_id: null,
    is_income: false,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCat, setEditCat] = useState<CategoryCreate | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const load = async () => {
    try {
      const cats = await api.getCategories();
      setCategories(cats);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const allRows = useMemo(() => {
    return flattenCategoryTree(tree, {
      includePath: true,
      expandedIds: new Set(categories.map((c) => c.id)),
    });
  }, [tree, categories]);
  const visibleRows = useMemo(() => {
    return flattenCategoryTree(tree, { includePath: true, expandedIds });
  }, [tree, expandedIds]);
  const pathById = useMemo(() => {
    return new Map(allRows.map((row) => [row.id, row.path.join(" / ")]));
  }, [allRows]);
  const descendantsById = useMemo(() => {
    const byParent = new Map<number, number[]>();
    for (const category of categories) {
      if (!category.parent_id) continue;
      const list = byParent.get(category.parent_id) ?? [];
      list.push(category.id);
      byParent.set(category.parent_id, list);
    }

    const collect = (id: number): number[] => {
      const direct = byParent.get(id) ?? [];
      const all: number[] = [];
      for (const childId of direct) {
        all.push(childId, ...collect(childId));
      }
      return all;
    };

    const map = new Map<number, number[]>();
    for (const category of categories) {
      map.set(category.id, collect(category.id));
    }
    return map;
  }, [categories]);

  useEffect(() => {
    const withChildren = new Set(allRows.filter((row) => row.hasChildren).map((row) => row.id));
    setExpandedIds(withChildren);
  }, [allRows]);

  const handleCreate = async () => {
    if (!newCat.name.trim()) return;
    try {
      await api.createCategory({ ...newCat, name: newCat.name.trim() });
      setNewCat({ name: "", parent_id: null, is_income: false });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditCat({
      name: c.name,
      parent_id: c.parent_id,
      is_income: c.is_income,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCat(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editCat) return;
    if (!editCat.name.trim()) return;
    try {
      await api.updateCategory(editingId, { ...editCat, name: editCat.name.trim() });
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    try {
      await api.deleteCategory(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categories</h2>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={newCat.name}
                onChange={(e) => setNewCat((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Pets"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Parent</label>
              <CategorySelect
                className="mt-1"
                categories={categories}
                value={newCat.parent_id ?? ""}
                placeholder="(none)"
                mode="path"
                onChange={(value) =>
                  setNewCat((s) => ({
                    ...s,
                    parent_id: typeof value === "number" ? value : null,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Order</label>
              <div className="mt-2 text-xs text-muted-foreground">
                Automatic (tree order)
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newCat.is_income}
                  onChange={(e) =>
                    setNewCat((s) => ({ ...s, is_income: e.target.checked }))
                  }
                />
                Income
              </label>
              <Button onClick={handleCreate} disabled={!newCat.name.trim()}>
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>All Categories</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setExpandedIds(
                    new Set(allRows.filter((row) => row.hasChildren).map((row) => row.id))
                  )
                }
              >
                Expand all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setExpandedIds(new Set())}>
                Collapse all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Parent</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const c = categories.find((cat) => cat.id === row.id)!;
                  const isEditing = editingId === c.id && editCat;
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span style={{ marginLeft: `${row.depth * 18}px` }}>
                            {row.hasChildren ? (
                              <button
                                type="button"
                                className="rounded p-0.5 hover:bg-muted"
                                onClick={() =>
                                  setExpandedIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id);
                                    else next.add(c.id);
                                    return next;
                                  })
                                }
                              >
                                {expandedIds.has(c.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block w-5" />
                            )}
                          </span>
                          {isEditing ? (
                            <input
                              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                              value={editCat!.name}
                              onChange={(e) =>
                                setEditCat((s) => (s ? { ...s, name: e.target.value } : s))
                              }
                            />
                          ) : (
                            <span className="font-medium">{c.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <CategorySelect
                            categories={categories}
                            value={editCat!.parent_id ?? ""}
                            placeholder="(none)"
                            mode="path"
                            excludeIds={[c.id, ...(descendantsById.get(c.id) ?? [])]}
                            onChange={(value) =>
                              setEditCat((s) =>
                                s
                                  ? {
                                      ...s,
                                      parent_id:
                                        typeof value === "number" ? value : null,
                                    }
                                  : s
                              )
                            }
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {c.parent_id ? pathById.get(c.parent_id) ?? `#${c.parent_id}` : "(none)"}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={editCat!.is_income}
                              onChange={(e) =>
                                setEditCat((s) =>
                                  s ? { ...s, is_income: e.target.checked } : s
                                )
                              }
                            />
                            Income
                          </label>
                        ) : c.is_income ? (
                          <Badge variant="success">Income</Badge>
                        ) : (
                          <Badge variant="secondary">Expense</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={saveEdit}>
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEdit(c)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(c.id)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No categories found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

