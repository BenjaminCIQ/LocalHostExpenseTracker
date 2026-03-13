import { useEffect, useState } from "react";
import { api, type Dashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function KpiCardsWidget({ filters }: WidgetProps) {
  const [data, setData] = useState<Dashboard | null>(null);
  useEffect(() => {
    api
      .getDashboard({
        month: filters.month ?? undefined,
        personId: filters.personId ?? undefined,
        accountId: filters.accountId ?? undefined,
      })
      .then(setData)
      .catch(() => setData(null));
  }, [filters.accountId, filters.month, filters.personId]);

  if (!data) return <div className="text-sm text-muted-foreground">Loading KPIs...</div>;

  const rate = data.classification_stats.total_transactions
    ? (data.classification_stats.classified / data.classification_stats.total_transactions) * 100
    : 0;

  const cellClass = "min-h-0 min-w-0 overflow-hidden flex flex-col justify-center";
  const labelClass = "shrink-0 text-xs text-muted-foreground truncate leading-tight";
  const valueClass = "text-lg font-semibold truncate leading-tight mt-0.5";

  return (
    <div className="@container min-h-0 overflow-hidden py-1">
      <div className="grid w-full grid-cols-2 grid-rows-2 gap-x-4 gap-y-2 @min-[380px]:grid-cols-4 @min-[380px]:grid-rows-1 content-start">
        <div className={cellClass}>
          <div className={labelClass}>Income</div>
          <div className={`${valueClass} text-success`}>{formatCurrency(data.total_income)}</div>
        </div>
        <div className={cellClass}>
          <div className={labelClass}>Expenses</div>
          <div className={`${valueClass} text-destructive`}>{formatCurrency(data.total_expenses)}</div>
        </div>
        <div className={cellClass}>
          <div className={labelClass}>Net</div>
          <div className={valueClass}>{formatCurrency(data.net)}</div>
        </div>
        <div className={cellClass}>
          <div className={labelClass}>Classification</div>
          <div className={valueClass}>{rate.toFixed(0)}%</div>
        </div>
      </div>
    </div>
  );
}

registerWidget({
  id: "kpi-cards",
  name: "KPI Cards",
  description: "Income, expense, net, and classification rate.",
  category: "overview",
  defaultSize: "full",
  component: KpiCardsWidget,
  defaultEnabled: true,
});
