import { useEffect, useState } from "react";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { api, type OutlierItem } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function OutlierWidget({ filters, globalControls, widgetState, setWidgetState }: WidgetProps) {
  const [rows, setRows] = useState<OutlierItem[]>([]);
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [sensitivity, setSensitivity] = useState<number>(
    Number(widgetState?.sensitivity ?? 50)
  );
  const [minAmount, setMinAmount] = useState<number>(
    Number(widgetState?.minAmount ?? 0)
  );
  const [method, setMethod] = useState<string>(String(widgetState?.method ?? "IQR"));
  const [includeTransfers, setIncludeTransfers] = useState<boolean>(
    Boolean(widgetState?.includeTransfers ?? false)
  );

  const limit = sensitivity < 34 ? 8 : sensitivity < 67 ? 15 : 30;
  useEffect(() => {
    api
      .getOutliers({ ...toAnalyticsParams(filters, globalControls), limit, includeTransfers })
      .then((res) => setRows(res.items))
      .catch(() => setRows([]));
  }, [filters, globalControls, limit, includeTransfers]);

  useEffect(() => {
    setWidgetState?.({
      showControls,
      showAdvanced,
      sensitivity,
      minAmount,
      method,
      includeTransfers,
    });
  }, [
    includeTransfers,
    method,
    minAmount,
    sensitivity,
    setWidgetState,
    showAdvanced,
    showControls,
  ]);

  const filtered = rows.filter((row) => Math.abs(row.amount) >= minAmount);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No outliers detected.</div>;
  return (
    <div className="space-y-2">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((prev) => !prev)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
        advanced={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Method</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="IQR">IQR</option>
              <option value="MAD">MAD</option>
              <option value="zscore">z-score</option>
            </select>
          </div>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ThresholdSlider
            label="Sensitivity"
            min={0}
            max={100}
            step={1}
            value={sensitivity}
            onChange={setSensitivity}
          />
          <ThresholdSlider
            label="Minimum amount"
            min={0}
            max={500}
            step={10}
            value={minAmount}
            onChange={setMinAmount}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeTransfers}
            onChange={(e) => setIncludeTransfers(e.target.checked)}
          />
          Include transfers
        </label>
      </ControlsSection>
      {filtered.slice(0, 8).map((row) => (
        <div key={row.transaction_id} className="rounded-md border border-border p-2 text-sm">
          <div className="font-medium">{row.merchant || "Unknown merchant"}</div>
          <div>{formatCurrency(row.amount)} - {row.category_name ?? "Uncategorized"}</div>
          <div className="text-xs text-muted-foreground">{row.reason}</div>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  id: "outlier-panel",
  name: "Outlier Expenses",
  description: "Flags unusual transactions and explains why they stand out.",
  category: "advanced",
  defaultSize: "lg",
  component: OutlierWidget,
});
