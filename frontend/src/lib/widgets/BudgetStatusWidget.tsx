import { useEffect, useState } from "react";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { api, type BudgetStatus } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function BudgetStatusWidget({ widgetState, setWidgetState }: WidgetProps) {
  const [rows, setRows] = useState<BudgetStatus[]>([]);
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [horizon, setHorizon] = useState<"weekly" | "monthly" | "quarterly" | "yearly">(
    (widgetState?.horizon as "weekly" | "monthly" | "quarterly" | "yearly") ??
      "monthly"
  );
  const [alertThreshold, setAlertThreshold] = useState<number>(
    Number(widgetState?.alertThreshold ?? 80)
  );
  const [showForecast, setShowForecast] = useState<boolean>(
    Boolean(widgetState?.showForecast ?? true)
  );

  useEffect(() => {
    api.getBudgetStatus().then(setRows).catch(() => setRows([]));
  }, []);

  useEffect(() => {
    setWidgetState?.({
      showControls,
      showAdvanced,
      horizon,
      alertThreshold,
      showForecast,
    });
  }, [
    alertThreshold,
    horizon,
    setWidgetState,
    showAdvanced,
    showControls,
    showForecast,
  ]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No active budgets.</div>;
  return (
    <div className="space-y-3">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((prev) => !prev)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Horizon</span>
          {(["weekly", "monthly", "quarterly", "yearly"] as const).map((value) => (
            <button
              key={value}
              className={`rounded-md border px-2 py-1 text-xs ${
                horizon === value ? "border-primary bg-primary/10" : "border-border"
              }`}
              onClick={() => setHorizon(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <ThresholdSlider
          label="Alert threshold"
          min={60}
          max={95}
          step={1}
          value={alertThreshold}
          suffix="%"
          onChange={setAlertThreshold}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showForecast}
            onChange={(e) => setShowForecast(e.target.checked)}
          />
          Show projected overrun marker
        </label>
      </ControlsSection>
      {rows.map((row) => {
        const ratio = Math.max(0, Math.min(row.ratio, 1.5));
        const color =
          ratio < alertThreshold / 100
            ? "bg-success"
            : ratio < 1
              ? "bg-amber-500"
              : "bg-destructive";
        return (
          <div key={row.budget_id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{row.name}</span>
              <span>
                {formatCurrency(row.spent)} / {formatCurrency(row.amount_limit)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            {showForecast && ratio >= 1 ? (
              <div className="text-[11px] text-destructive">
                Projected to exceed target for {horizon}.
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

registerWidget({
  id: "budget-status",
  name: "Budget Status",
  description: "Progress bars for active spending limits.",
  category: "budgets",
  defaultSize: "full",
  component: BudgetStatusWidget,
});
