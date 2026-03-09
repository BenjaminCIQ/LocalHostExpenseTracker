import { useEffect, useMemo, useState } from "react";
import { api, type AnalyticsTimeseriesPoint } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function SpendingHeatmapWidget({ filters }: WidgetProps) {
  const { chartColors } = useTheme();
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  useEffect(() => {
    api.getAnalyticsTimeseries({ ...toAnalyticsParams(filters), granularity: "daily" })
      .then((res) => setRows(res.points.slice(-35)))
      .catch(() => setRows([]));
  }, [filters]);

  const maxExpense = useMemo(
    () => Math.max(1, ...rows.map((r) => r.expenses)),
    [rows]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No daily data yet.</div>;
  return (
    <div className="grid grid-cols-7 gap-1">
      {rows.map((row) => {
        const intensity = row.expenses / maxExpense;
        return (
          <div
            key={row.period}
            className="rounded p-2 text-[10px]"
            style={{ backgroundColor: `rgba(${chartColors.heatmapBase}, ${Math.max(0.12, intensity)})` }}
            title={`${row.period}: ${formatCurrency(row.expenses)}`}
          >
            {row.period.slice(-2)}
          </div>
        );
      })}
    </div>
  );
}

registerWidget({
  id: "spending-heatmap",
  name: "Spending Heatmap",
  description: "Calendar-style daily expense intensity.",
  category: "advanced",
  defaultSize: "lg",
  component: SpendingHeatmapWidget,
});
