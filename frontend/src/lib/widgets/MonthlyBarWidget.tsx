import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type MonthlyTotals } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function MonthlyBarWidget({ filters }: WidgetProps) {
  const [rows, setRows] = useState<MonthlyTotals[]>([]);
  useEffect(() => {
    api
      .getMonthlyDashboard(12, filters.accountId ?? undefined, filters.personId ?? undefined)
      .then((res) => setRows(res.months))
      .catch(() => setRows([]));
  }, [filters.accountId, filters.personId]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No monthly data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="income" fill="#22c55e" />
          <Bar dataKey="expenses" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "monthly-bar",
  name: "Monthly Income vs Expenses",
  description: "Grouped monthly inflow and outflow.",
  category: "trends",
  defaultSize: "lg",
  component: MonthlyBarWidget,
  defaultEnabled: true,
});
