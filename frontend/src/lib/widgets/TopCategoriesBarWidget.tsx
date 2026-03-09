import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type Dashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function TopCategoriesBarWidget({ filters }: WidgetProps) {
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
        .map((c) => ({ ...c, total: Math.abs(c.total) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [data]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No category data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" />
          <YAxis dataKey="category_name" type="category" width={140} />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          <Bar dataKey="total" fill="#2563eb" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "top-categories",
  name: "Top Categories",
  description: "Highest expense categories as a ranked bar chart.",
  category: "spending",
  defaultSize: "lg",
  component: TopCategoriesBarWidget,
  defaultEnabled: true,
});
