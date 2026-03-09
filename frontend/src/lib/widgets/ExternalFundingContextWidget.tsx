import { useEffect, useState } from "react";
import { api, type Dashboard, type ExternalFundingSummary } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

interface ExternalContextData {
  dashboard: Dashboard;
  funding: ExternalFundingSummary;
  latestExternalValue: number;
  estimatedExternalGrowth: number;
}

function ExternalFundingContextWidget({ filters }: WidgetProps) {
  const [data, setData] = useState<ExternalContextData | null>(null);

  useEffect(() => {
    Promise.all([
      api.getDashboard({
        month: filters.month ?? undefined,
        personId: filters.personId ?? undefined,
        accountId: filters.accountId ?? undefined,
      }),
      api.getExternalFundingSummary({
        month: filters.month ?? undefined,
        startDate: filters.dateRange.start ?? undefined,
        endDate: filters.dateRange.end ?? undefined,
        personId: filters.personId ?? undefined,
        accountId: filters.accountId ?? undefined,
      }),
      api.getNetWorth(filters.personId ?? undefined),
    ])
      .then(([dashboard, funding, netWorth]) => {
        const latestExternalValue = netWorth.external_reconciliation_summary?.latest_value_total ?? 0;
        const estimatedExternalGrowth = netWorth.external_reconciliation_summary?.unlinked_total ?? 0;
        setData({ dashboard, funding, latestExternalValue, estimatedExternalGrowth });
      })
      .catch(() => setData(null));
  }, [
    filters.accountId,
    filters.dateRange.end,
    filters.dateRange.start,
    filters.month,
    filters.personId,
  ]);

  if (!data) return <div className="text-sm text-muted-foreground">Loading external funding context...</div>;

  const adjustedNet = data.dashboard.net + data.funding.net_external_flow;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Reported net cash flow</div>
          <div className={`text-lg font-semibold ${data.dashboard.net >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(data.dashboard.net)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">To external accounts</div>
          <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
            {formatCurrency(data.funding.funding_in_total)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">From external accounts</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(data.funding.funding_out_total)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Investment-adjusted net</div>
          <div className={`text-lg font-semibold ${adjustedNet >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(adjustedNet)}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
        <div className="text-muted-foreground">
          External latest value: <span className="font-medium text-foreground">{formatCurrency(data.latestExternalValue)}</span> · Estimated
          growth vs linked funding:{" "}
          <span className={`font-medium ${data.estimatedExternalGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {formatCurrency(data.estimatedExternalGrowth)}
          </span>
        </div>
      </div>
    </div>
  );
}

registerWidget({
  id: "external-funding-context",
  name: "External Funding Context",
  description: "Shows transfer-adjusted net and external value context.",
  category: "overview",
  defaultSize: "full",
  component: ExternalFundingContextWidget,
});
