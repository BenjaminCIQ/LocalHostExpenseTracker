import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AnalyticsTimeseriesPoint } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function CashFlowForecastWidget({ filters }: WidgetProps) {
  const { chartColors } = useTheme();
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api.getAnalyticsTimeseries({ ...toAnalyticsParams(filters), granularity: "monthly" })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters]);

  const data = useMemo(() => {
    if (!rows.length) return [];
    const base: { period: string; actual: number | null; projected: number | null }[] = rows.map((r) => ({
      period: r.period,
      actual: r.net,
      projected: null,
    }));
    const avg = rows.reduce((sum, r) => sum + r.net, 0) / rows.length;
    for (let i = 1; i <= 3; i += 1) {
      base.push({ period: `F+${i}`, actual: null, projected: Number(avg.toFixed(2)) });
    }
    return base;
  }, [rows]);

  if (!data.length) return <div className="text-sm text-muted-foreground">No cash-flow data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(v) => (v === null ? "-" : formatCurrency(Number(v)))} />
          <Area
            type="monotone"
            dataKey="actual"
            stroke={chartColors.net}
            fill={chartColors.net}
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="projected"
            stroke={chartColors.projected}
            fill={chartColors.projected}
            fillOpacity={0.22}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "cashflow-forecast",
  name: "Cash Flow Forecast",
  description: "Actual net cashflow plus a short rolling projection.",
  category: "trends",
  defaultSize: "lg",
  component: CashFlowForecastWidget,
});
