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
import { api, type MonthlyTotals } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";
import { applyZoomWindow, clearWidgetZoom, readWidgetZoom } from "@/lib/widgets/zoomState";

function MonthlyBarWidget({ filters, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const zoom = readWidgetZoom(widgetState);
  const [rows, setRows] = useState<MonthlyTotals[]>([]);
  useEffect(() => {
    api
      .getMonthlyDashboard(12, filters.accountId ?? undefined, filters.personId ?? undefined)
      .then((res) => setRows(res.months))
      .catch(() => setRows([]));
  }, [filters.accountId, filters.personId]);

  const chartRows = useMemo(
    () => applyZoomWindow(rows, zoom, (row) => row.month),
    [rows, zoom]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No monthly data yet.</div>;
  return (
    <div className="space-y-2">
      <div>
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={() => setWidgetState?.(clearWidgetZoom(widgetState))}
        >
          Reset zoom
        </button>
      </div>
      <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
          <Bar dataKey="income" fill={chartColors.income} />
          <Bar dataKey="expenses" fill={chartColors.expenses} />
        </BarChart>
      </ResponsiveContainer>
      </div>
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
