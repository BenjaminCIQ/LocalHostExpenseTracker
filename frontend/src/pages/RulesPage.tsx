import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import CategorySelect from "@/components/category/CategorySelect";
import { api, type Category, type Rule, type RuleCondition } from "@/lib/api";

type Logic = "AND" | "OR";
type Field = RuleCondition["field"];
type Operator = RuleCondition["operator"];

function categoryName(categories: Category[], id: number): string {
  return categories.find((c) => c.id === id)?.name ?? `Category ${id}`;
}

const FIELD_OPTIONS: { value: Field; label: string }[] = [
  { value: "description", label: "Description" },
  { value: "merchant", label: "Merchant" },
  { value: "amount", label: "Amount" },
];

const OP_OPTIONS_TEXT: { value: Operator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
  { value: "equals", label: "equals" },
  { value: "starts_with", label: "starts with" },
];

const OP_OPTIONS_NUM: { value: Operator; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "equals", label: "=" },
];

function defaultCondition(): RuleCondition {
  return { field: "description", operator: "contains", value: "" };
}

export default function RulesPage({ embedded = false }: { embedded?: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  // Create form
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [logic, setLogic] = useState<Logic>("AND");
  const [priority, setPriority] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [conditions, setConditions] = useState<RuleCondition[]>([
    defaultCondition(),
  ]);

  // Test panel
  const [testRuleId, setTestRuleId] = useState<number | null>(null);
  const [testDescription, setTestDescription] = useState("");
  const [testMerchant, setTestMerchant] = useState("");
  const [testAmount, setTestAmount] = useState(-9.99);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.id - a.id;
    });
  }, [rules]);

  const load = async () => {
    try {
      const [cats, r] = await Promise.all([api.getCategories(), api.getRules()]);
      setCategories(cats);
      setRules(r);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rules");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    api
      .getUncategorizedTitles(30)
      .then(setNameSuggestions)
      .catch(() => setNameSuggestions([]));
  }, []);

  const addCondition = () => setConditions((c) => [...c, defaultCondition()]);
  const removeCondition = (idx: number) =>
    setConditions((c) => c.filter((_, i) => i !== idx));

  const updateCondition = (
    idx: number,
    patch: Partial<RuleCondition>
  ) => {
    setConditions((conds) =>
      conds.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const createRule = async () => {
    if (!name.trim() || !categoryId) return;
    const clean = conditions
      .map((c) => ({ ...c, value: c.value.trim() }))
      .filter((c) => c.value.length > 0);
    if (clean.length === 0) {
      setError("Add at least one condition with a value.");
      return;
    }
    try {
      await api.createRule({
        name: name.trim(),
        category_id: Number(categoryId),
        logic,
        priority,
        enabled,
        conditions: clean,
      });
      setName("");
      setCategoryId("");
      setLogic("AND");
      setPriority(0);
      setEnabled(true);
      setConditions([defaultCondition()]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const deleteRule = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await api.deleteRule(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggle = async (id: number, newEnabled: boolean) => {
    try {
      await api.toggleRule(id, newEnabled);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  const runTest = async () => {
    if (!testRuleId) return;
    try {
      const res = await api.testRule(testRuleId, {
        description: testDescription,
        merchant: testMerchant,
        amount: testAmount,
      });
      setTestResult(res.matches);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && <h2 className="text-2xl font-bold">Rules</h2>}
      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Create Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                list="rule-name-suggestions"
                placeholder='e.g. "Netflix subscription"'
              />
              <datalist id="rule-name-suggestions">
                {nameSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Category</label>
              <CategorySelect
                className="mt-1"
                categories={categories}
                value={categoryId}
                placeholder="Select..."
                mode="path"
                onChange={(value) =>
                  setCategoryId(typeof value === "number" ? value : "")
                }
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Logic</label>
              <Select
                className="mt-1"
                value={logic}
                onChange={(e) => setLogic(e.target.value as Logic)}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Enabled
              </label>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 items-end">
            <div>
              <label className="text-sm text-muted-foreground">Priority</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button variant="outline" onClick={addCondition}>
                + Add Condition
              </Button>
              <Button onClick={createRule} disabled={!name.trim() || !categoryId}>
                Create Rule
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Conditions</p>
            <div className="space-y-2">
              {conditions.map((c, idx) => {
                const isAmount = c.field === "amount";
                const ops = isAmount ? OP_OPTIONS_NUM : OP_OPTIONS_TEXT;
                const valueType = isAmount ? "number" : "text";
                return (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-12 items-end"
                  >
                    <div className="md:col-span-3">
                      <label className="text-xs text-muted-foreground">Field</label>
                      <Select
                        className="mt-1"
                        value={c.field}
                        onChange={(e) => {
                          const f = e.target.value as Field;
                          updateCondition(idx, {
                            field: f,
                            operator:
                              f === "amount" ? "lt" : "contains",
                            value: "",
                          });
                        }}
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-xs text-muted-foreground">Operator</label>
                      <Select
                        className="mt-1"
                        value={c.operator}
                        onChange={(e) =>
                          updateCondition(idx, {
                            operator: e.target.value as Operator,
                          })
                        }
                      >
                        {ops.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="md:col-span-5">
                      <label className="text-xs text-muted-foreground">Value</label>
                      <input
                        className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                        type={valueType}
                        value={c.value}
                        onChange={(e) =>
                          updateCondition(idx, { value: e.target.value })
                        }
                        placeholder={isAmount ? "-10" : "netflix"}
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeCondition(idx)}
                        disabled={conditions.length <= 1}
                      >
                        X
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Logic</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-right p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Conditions</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRules.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.logic}</td>
                    <td className="p-3">{categoryName(categories, r.category_id)}</td>
                    <td className="p-3 text-right font-mono">{r.priority}</td>
                    <td className="p-3">
                      <ul className="list-disc pl-4 text-xs text-muted-foreground">
                        {r.conditions.map((c, i) => (
                          <li key={i}>
                            {c.field} {c.operator} {c.value}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTestRuleId(r.id);
                            setTestResult(null);
                          }}
                        >
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggle(r.id, !r.enabled)}
                        >
                          {r.enabled ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRule(r.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sortedRules.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No rules yet. Create one above.
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
          <CardTitle>Test Rule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm text-muted-foreground">Rule</label>
              <Select
                className="mt-1"
                value={testRuleId ?? ""}
                onChange={(e) => setTestRuleId(Number(e.target.value) || null)}
              >
                <option value="">Select...</option>
                {sortedRules.map((r) => (
                  <option key={r.id} value={r.id}>
                    #{r.id} {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Merchant</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={testMerchant}
                onChange={(e) => setTestMerchant(e.target.value)}
                placeholder="Spotify"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Amount</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Description</label>
            <input
              className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              placeholder="NETFLIX.COM"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={runTest} disabled={!testRuleId}>
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

