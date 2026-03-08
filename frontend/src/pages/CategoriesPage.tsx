import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api, type Category, type CategoryCreate } from "@/lib/api";

function bySort(a: Category, b: Category) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

function catLabel(categories: Category[], id: number | null) {
  if (id === null) return "(none)";
  return categories.find((c) => c.id === id)?.name ?? `#${id}`;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");

  const [newCat, setNewCat] = useState<CategoryCreate>({
    name: "",
    parent_id: null,
    is_income: false,
    sort_order: 0,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCat, setEditCat] = useState<CategoryCreate | null>(null);

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

  const sorted = useMemo(() => {
    return [...categories].sort(bySort);
  }, [categories]);

  const handleCreate = async () => {
    if (!newCat.name.trim()) return;
    try {
      await api.createCategory({ ...newCat, name: newCat.name.trim() });
      setNewCat({ name: "", parent_id: null, is_income: false, sort_order: 0 });
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
      sort_order: c.sort_order,
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
              <Select
                className="mt-1"
                value={newCat.parent_id ?? ""}
                onChange={(e) =>
                  setNewCat((s) => ({
                    ...s,
                    parent_id: Number(e.target.value) || null,
                  }))
                }
              >
                <option value="">(none)</option>
                {sorted.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? "  " : ""}
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Sort order</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="number"
                value={newCat.sort_order}
                onChange={(e) =>
                  setNewCat((s) => ({ ...s, sort_order: Number(e.target.value) }))
                }
              />
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
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Parent</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-right p-3 font-medium">Sort</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const isEditing = editingId === c.id && editCat;
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        {isEditing ? (
                          <input
                            className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                            value={editCat!.name}
                            onChange={(e) =>
                              setEditCat((s) => (s ? { ...s, name: e.target.value } : s))
                            }
                          />
                        ) : (
                          <span>{c.name}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {isEditing ? (
                          <Select
                            value={editCat!.parent_id ?? ""}
                            onChange={(e) =>
                              setEditCat((s) =>
                                s
                                  ? {
                                      ...s,
                                      parent_id: Number(e.target.value) || null,
                                    }
                                  : s
                              )
                            }
                          >
                            <option value="">(none)</option>
                            {sorted
                              .filter((x) => x.id !== c.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.parent_id ? "  " : ""}
                                  {p.name}
                                </option>
                              ))}
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">{catLabel(sorted, c.parent_id)}</span>
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
                        ) : (
                          <span>{c.is_income ? "Income" : "Expense"}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {isEditing ? (
                          <input
                            className="w-24 h-9 rounded-md border border-border bg-background px-3 text-sm text-right"
                            type="number"
                            value={editCat!.sort_order}
                            onChange={(e) =>
                              setEditCat((s) =>
                                s ? { ...s, sort_order: Number(e.target.value) } : s
                              )
                            }
                          />
                        ) : (
                          c.sort_order
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
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
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

