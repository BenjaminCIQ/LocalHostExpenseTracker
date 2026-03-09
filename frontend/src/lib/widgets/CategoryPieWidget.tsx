import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api, type Dashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];

function CategoryPieWidget({ filters }: WidgetProps) {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    api
      .getDashboard({
        month: filters.month ?? undefined,
        personId: filters.personId ?? undefined,
        accountId: filters.accountId ?? undefined,
      })
      .then(setData)
      .catch(() => setData(null));
  }, [filters.accountId, filters.month, filters.personId]);

  const rows = useMemo(
    () =>
      (data?.spending_by_category ?? [])
        .filter((c) => c.total < 0)
        .map((c) => ({ ...c, total: Math.abs(c.total) })),
    [data]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No category data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="total" nameKey="category_name" innerRadius={60} outerRadius={100}>
            {rows.map((row, idx) => (
              <Cell key={row.category_id} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "category-pie",
  name: "Spending by Category",
  description: "Donut chart of expense category composition.",
  category: "spending",
  defaultSize: "lg",
  component: CategoryPieWidget,
  defaultEnabled: true,
});
