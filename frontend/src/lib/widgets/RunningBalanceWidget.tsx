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

function RunningBalanceWidget({ filters }: WidgetProps) {
  const { chartColors } = useTheme();
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api.getAnalyticsTimeseries({ ...toAnalyticsParams(filters), granularity: "monthly" })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters]);

  const data = useMemo(() => {
    let cumulative = 0;
    return rows.map((row) => {
      cumulative += row.net;
      return { period: row.period, cumulative: Number(cumulative.toFixed(2)) };
    });
  }, [rows]);

  if (!data.length) return <div className="text-sm text-muted-foreground">No running balance data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={chartColors.net}
            fill={chartColors.net}
            fillOpacity={0.24}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "running-balance",
  name: "Running Balance",
  description: "Cumulative net cash-flow trajectory.",
  category: "trends",
  defaultSize: "lg",
  component: RunningBalanceWidget,
});
