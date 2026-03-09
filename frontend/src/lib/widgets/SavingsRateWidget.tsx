import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AnalyticsTimeseriesPoint } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function SavingsRateWidget({ filters }: WidgetProps) {
  const { chartColors } = useTheme();
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api
      .getAnalyticsTimeseries({ ...toAnalyticsParams(filters), granularity: "monthly" })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters]);

  const data = useMemo(
    () =>
      rows.map((row) => ({
        period: row.period,
        rate: row.income > 0 ? ((row.income - row.expenses) / row.income) * 100 : 0,
      })),
    [rows]
  );

  if (!data.length) return <div className="text-sm text-muted-foreground">No savings-rate data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} />
          <Line type="monotone" dataKey="rate" stroke={chartColors.income} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "savings-rate",
  name: "Savings Rate",
  description: "Tracks (income - expenses) / income over time.",
  category: "budgets",
  defaultSize: "lg",
  component: SavingsRateWidget,
});
