import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import CategorySelect from "@/components/category/CategorySelect";
import { api, type Category, type UserOverride } from "@/lib/api";

function categoryName(categories: Category[], id: number): string {
  return categories.find((c) => c.id === id)?.name ?? `Category ${id}`;
}

export default function OverridesPage({ embedded = false }: { embedded?: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [error, setError] = useState("");

  const [newPattern, setNewPattern] = useState("");
  const [newCategoryId, setNewCategoryId] = useState<number | "">("");
  const [newIsRegex, setNewIsRegex] = useState(false);
  const [newPriority, setNewPriority] = useState(0);

  const [testOverrideId, setTestOverrideId] = useState<number | null>(null);
  const [testDescription, setTestDescription] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const sortedOverrides = useMemo(() => {
    return [...overrides].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.id - a.id;
    });
  }, [overrides]);

  const load = async () => {
    try {
      const [cats, ovs] = await Promise.all([api.getCategories(), api.getOverrides()]);
      setCategories(cats);
      setOverrides(ovs);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load overrides");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!newPattern.trim() || !newCategoryId) return;
    try {
      await api.createOverride({
        pattern: newPattern.trim(),
        category_id: Number(newCategoryId),
        is_regex: newIsRegex,
        priority: newPriority,
      });
      setNewPattern("");
      setNewCategoryId("");
      setNewIsRegex(false);
      setNewPriority(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this override?")) return;
    try {
      await api.deleteOverride(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleMove = async (id: number, dir: "up" | "down") => {
    const idx = sortedOverrides.findIndex((o) => o.id === id);
    const swapWith = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= sortedOverrides.length) return;

    const a = sortedOverrides[idx];
    const b = sortedOverrides[swapWith];
    try {
      await api.updateOverride(a.id, { priority: b.priority });
      await api.updateOverride(b.id, { priority: a.priority });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reorder failed");
    }
  };

  const runTest = async () => {
    if (!testOverrideId) return;
    try {
      const res = await api.testOverride(testOverrideId, testDescription);
      setTestResult(res.matches);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!embedded && <h2 className="text-2xl font-bold">User Overrides</h2>}
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Add Override</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Pattern</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={newPattern}
                onChange={(e) => setNewPattern(e.target.value)}
                placeholder="e.g. rewe, netflix, salary"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Category</label>
              <CategorySelect
                className="mt-1"
                categories={categories}
                value={newCategoryId}
                placeholder="Select..."
                mode="path"
                onChange={(value) =>
                  setNewCategoryId(typeof value === "number" ? value : "")
                }
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Priority</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="number"
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsRegex}
                  onChange={(e) => setNewIsRegex(e.target.checked)}
                />
                Regex
              </label>
              <Button onClick={handleCreate} disabled={!newPattern.trim() || !newCategoryId}>
                Create
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overrides</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Pattern</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-right p-3 font-medium">Priority</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOverrides.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono">{o.pattern}</td>
                    <td className="p-3">{o.is_regex ? "regex" : "text"}</td>
                    <td className="p-3">{categoryName(categories, o.category_id)}</td>
                    <td className="p-3 text-right font-mono">{o.priority}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTestOverrideId(o.id);
                            setTestResult(null);
                          }}
                        >
                          Test
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleMove(o.id, "up")}>
                          Up
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleMove(o.id, "down")}>
                          Down
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(o.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedOverrides.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No overrides yet. Add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Override</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm text-muted-foreground">Override</label>
              <Select
                className="mt-1"
                value={testOverrideId ?? ""}
                onChange={(e) => setTestOverrideId(Number(e.target.value) || null)}
              >
                <option value="">Select...</option>
                {sortedOverrides.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id} ({o.is_regex ? "regex" : "text"}) {o.pattern}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Description to test</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                placeholder="e.g. POS 1234 REWE SAGT DANKE"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={runTest} disabled={!testOverrideId}>
              Run Test
            </Button>
            {testResult !== null && (
              <span className={testResult ? "text-success" : "text-muted-foreground"}>
                {testResult ? "Matches" : "No match"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

