import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

interface RecurringItem {
  merchant: string;
  occurrences: number;
  avg_interval_days: number;
  avg_amount: number;
  last_seen: string;
  transaction_ids: number[];
}

function RecurringWidget({ filters, globalControls }: WidgetProps) {
  const [rows, setRows] = useState<RecurringItem[]>([]);
  useEffect(() => {
    api.getRecurring({ ...toAnalyticsParams(filters, globalControls), minOccurrences: 3 })
      .then((res) => setRows(res.items))
      .catch(() => setRows([]));
  }, [filters, globalControls]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No recurring patterns detected.</div>;
  return (
    <div className="space-y-2">
      {rows.slice(0, 8).map((row) => (
        <div key={row.merchant} className="rounded-md border border-border p-2 text-sm">
          <div className="font-medium">{row.merchant}</div>
          <div className="text-muted-foreground">
            {row.occurrences} payments · every {row.avg_interval_days.toFixed(1)} days · avg {formatCurrency(row.avg_amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  id: "recurring",
  name: "Recurring Transactions",
  description: "Detect likely subscriptions and recurring payments.",
  category: "advanced",
  defaultSize: "lg",
  component: RecurringWidget,
});
