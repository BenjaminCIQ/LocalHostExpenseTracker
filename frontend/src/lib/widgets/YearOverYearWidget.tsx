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
import { api, type AnalyticsTimeseriesPoint } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function YearOverYearWidget({ filters }: WidgetProps) {
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api.getAnalyticsTimeseries({ ...toAnalyticsParams(filters), granularity: "monthly" })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters]);

  const data = useMemo(() => {
    return rows.map((row) => {
      const [year, month] = row.period.split("-");
      return { month, [year]: row.expenses };
    });
  }, [rows]);

  if (!data.length) return <div className="text-sm text-muted-foreground">No YoY data yet.</div>;
  const yearKeys = Array.from(new Set(rows.map((r) => r.period.split("-")[0]))).slice(-2);
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          {yearKeys.map((year, idx) => (
            <Bar key={year} dataKey={year} fill={idx === 0 ? "#93c5fd" : "#2563eb"} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "year-over-year",
  name: "Year over Year",
  description: "Compare monthly expenses between recent years.",
  category: "trends",
  defaultSize: "lg",
  component: YearOverYearWidget,
});
