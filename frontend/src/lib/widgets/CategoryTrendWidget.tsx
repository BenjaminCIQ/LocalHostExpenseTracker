import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AnalyticsTimeseriesPoint } from "@/lib/api";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function CategoryTrendWidget({
  filters,
  globalControls,
  widgetState,
  setWidgetState,
}: WidgetProps) {
  const { chartColors } = useTheme();
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [granularity, setGranularity] = useState<
    "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  >(
    (widgetState?.granularity as
      | "daily"
      | "weekly"
      | "monthly"
      | "quarterly"
      | "yearly") ??
      (globalControls?.granularity && globalControls.granularity !== "auto"
        ? globalControls.granularity
        : "monthly")
  );
  const [showIncome, setShowIncome] = useState<boolean>(
    Boolean(widgetState?.showIncome ?? true)
  );
  const [showExpenses, setShowExpenses] = useState<boolean>(
    Boolean(widgetState?.showExpenses ?? true)
  );
  const [showNet, setShowNet] = useState<boolean>(Boolean(widgetState?.showNet ?? true));
  const [includeTransfers, setIncludeTransfers] = useState<boolean>(
    Boolean(widgetState?.includeTransfers ?? false)
  );

  useEffect(() => {
    api
      .getAnalyticsTimeseries({
        ...toAnalyticsParams(filters),
        granularity,
        includeTransfers,
      })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters, granularity, includeTransfers]);

  useEffect(() => {
    setWidgetState?.({
      showControls,
      showAdvanced,
      granularity,
      showIncome,
      showExpenses,
      showNet,
      includeTransfers,
    });
  }, [
    granularity,
    includeTransfers,
    setWidgetState,
    showAdvanced,
    showControls,
    showExpenses,
    showIncome,
    showNet,
  ]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No trend data yet.</div>;
  return (
    <div className="space-y-2">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((prev) => !prev)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Time</span>
          {(["daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((g) => (
            <button
              key={g}
              className={`rounded-md border px-2 py-1 text-xs ${
                granularity === g ? "border-primary bg-primary/10" : "border-border"
              }`}
              onClick={() => setGranularity(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showIncome}
              onChange={(e) => setShowIncome(e.target.checked)}
            />
            income
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showExpenses}
              onChange={(e) => setShowExpenses(e.target.checked)}
            />
            expenses
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={showNet}
              onChange={(e) => setShowNet(e.target.checked)}
            />
            net
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={includeTransfers}
              onChange={(e) => setIncludeTransfers(e.target.checked)}
            />
            include transfers
          </label>
        </div>
      </ControlsSection>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Legend />
            {showIncome ? <Line type="monotone" dataKey="income" stroke={chartColors.income} /> : null}
            {showExpenses ? (
              <Line type="monotone" dataKey="expenses" stroke={chartColors.expenses} />
            ) : null}
            {showNet ? <Line type="monotone" dataKey="net" stroke={chartColors.net} /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

registerWidget({
  id: "category-trend",
  name: "Category Trend Lines",
  description: "Monthly trend lines for income, expenses, and net.",
  category: "trends",
  defaultSize: "full",
  component: CategoryTrendWidget,
});
