import { useEffect, useState } from "react";
import { api, type MerchantRankingItem } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function MerchantInsightsWidget({ filters, globalControls }: WidgetProps) {
  const [rows, setRows] = useState<MerchantRankingItem[]>([]);
  useEffect(() => {
    api.getMerchantRanking({ ...toAnalyticsParams(filters, globalControls), limit: 12 })
      .then((res) => setRows(res.items))
      .catch(() => setRows([]));
  }, [filters, globalControls]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No merchant ranking data yet.</div>;
  return (
    <div className="space-y-2">
      {rows.slice(0, 10).map((row) => (
        <div key={`${row.merchant}-${row.count}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
          <span>{row.merchant}</span>
          <span>{formatCurrency(row.total_spend)}</span>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  id: "merchant-insights",
  name: "Merchant Insights",
  description: "Top merchants by spend with counts.",
  category: "advanced",
  defaultSize: "lg",
  component: MerchantInsightsWidget,
});
