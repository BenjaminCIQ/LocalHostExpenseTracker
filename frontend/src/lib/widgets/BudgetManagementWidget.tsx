import { useEffect, useState } from "react";
import { api, type Budget, type Category } from "@/lib/api";
import { Button } from "@/components/ui/button";
import CategorySelect from "@/components/category/CategorySelect";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function BudgetManagementWidget(_props: WidgetProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [amountLimit, setAmountLimit] = useState<number>(0);
  const [period, setPeriod] = useState<"monthly" | "weekly" | "yearly">("monthly");

  function refresh() {
    api.getBudgets().then(setBudgets).catch(() => setBudgets([]));
  }

  useEffect(() => {
    refresh();
    api.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  async function createBudget() {
    if (!name.trim() || amountLimit <= 0) return;
    await api.createBudget({
      name: name.trim(),
      category_id: categoryId === "" ? null : categoryId,
      amount_limit: amountLimit,
      period,
      is_active: true,
    });
    setName("");
    setCategoryId("");
    setAmountLimit(0);
    setPeriod("monthly");
    refresh();
  }

  async function removeBudget(id: number) {
    await api.deleteBudget(id);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-5">
        <input
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          placeholder="Budget name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={(value) =>
            setCategoryId(typeof value === "number" ? value : "")
          }
          placeholder="All categories"
          mode="path"
        />
        <input
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          type="number"
          min={0}
          placeholder="Limit"
          value={amountLimit || ""}
          onChange={(e) => setAmountLimit(Number(e.target.value))}
        />
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "monthly" | "weekly" | "yearly")}
        >
          <option value="monthly">monthly</option>
          <option value="weekly">weekly</option>
          <option value="yearly">yearly</option>
        </select>
        <Button onClick={createBudget}>Create</Button>
      </div>
      <div className="space-y-2">
        {budgets.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
            <div>
              <div className="font-medium">{b.name}</div>
              <div className="text-muted-foreground">
                {b.period} · {b.amount_limit} {b.is_active ? "" : "(inactive)"}
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => removeBudget(b.id)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

registerWidget({
  id: "budget-management",
  name: "Budget Management",
  description: "Create and manage category budgets.",
  category: "budgets",
  defaultSize: "full",
  component: BudgetManagementWidget,
});
