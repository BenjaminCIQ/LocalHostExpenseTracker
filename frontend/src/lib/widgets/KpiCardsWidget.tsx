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

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div>
        <div className="text-xs text-muted-foreground">Income</div>
        <div className="text-lg font-semibold text-success">{formatCurrency(data.total_income)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Expenses</div>
        <div className="text-lg font-semibold text-destructive">{formatCurrency(data.total_expenses)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Net</div>
        <div className="text-lg font-semibold">{formatCurrency(data.net)}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Classification</div>
        <div className="text-lg font-semibold">{rate.toFixed(0)}%</div>
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
