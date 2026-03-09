import { useEffect, useState } from "react";
import { api, type Dashboard, type Person } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function PersonComparisonWidget({ filters }: WidgetProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [a, setA] = useState<number | "">("");
  const [b, setB] = useState<number | "">("");
  const [data, setData] = useState<{ a: Dashboard; b: Dashboard } | null>(null);

  useEffect(() => {
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!a || !b || a === b) {
      setData(null);
      return;
    }
    Promise.all([
      api.getDashboard({ personId: Number(a), month: filters.month ?? undefined }),
      api.getDashboard({ personId: Number(b), month: filters.month ?? undefined }),
    ])
      .then(([aData, bData]) => setData({ a: aData, b: bData }))
      .catch(() => setData(null));
  }, [a, b, filters.month]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={a}
          onChange={(e) => setA(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select A</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={b}
          onChange={(e) => setB(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select B</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {data ? (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="font-semibold">A net: {formatCurrency(data.a.net)}</div>
            <div className="text-muted-foreground">Expenses: {formatCurrency(data.a.total_expenses)}</div>
          </div>
          <div className="rounded-md border border-border p-3 text-sm">
            <div className="font-semibold">B net: {formatCurrency(data.b.net)}</div>
            <div className="text-muted-foreground">Expenses: {formatCurrency(data.b.total_expenses)}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Choose two people to compare.</div>
      )}
    </div>
  );
}

registerWidget({
  id: "person-comparison",
  name: "Person Comparison",
  description: "Compare income, expense and net across two people.",
  category: "overview",
  defaultSize: "full",
  component: PersonComparisonWidget,
  defaultEnabled: true,
});
