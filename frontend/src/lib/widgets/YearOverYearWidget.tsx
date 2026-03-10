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
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";
import { applyZoomWindow, clearWidgetZoom, readWidgetZoom } from "@/lib/widgets/zoomState";

function YearOverYearWidget({ filters, globalControls, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const zoom = readWidgetZoom(widgetState);
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api.getAnalyticsTimeseries({ ...toAnalyticsParams(filters, globalControls), granularity: "monthly" })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters, globalControls]);

  const data = useMemo(() => {
    return rows.map((row) => {
      const [year, month] = row.period.split("-");
      return { period: row.period, month, [year]: row.expenses };
    });
  }, [rows]);
  const chartRows = useMemo(
    () => applyZoomWindow(data, zoom, (row) => row.period),
    [data, zoom]
  );

  if (!data.length) return <div className="text-sm text-muted-foreground">No YoY data yet.</div>;
  const yearKeys = Array.from(new Set(rows.map((r) => r.period.split("-")[0]))).slice(-2);
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
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          {yearKeys.map((year, idx) => (
            <Bar
              key={year}
              dataKey={year}
              fill={idx === 0 ? chartColors.palette[1] : chartColors.net}
              fillOpacity={idx === 0 ? 0.65 : 1}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      </div>
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
