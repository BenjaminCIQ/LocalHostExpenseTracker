import { useEffect, useState } from "react";
import { api, type Dashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function SnapshotWidget({ filters }: WidgetProps) {
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

  if (!data) return <div className="text-sm text-muted-foreground">Loading snapshot...</div>;
  const top = [...data.spending_by_category]
    .filter((c) => c.total < 0)
    .sort((a, b) => a.total - b.total)[0];

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">Net position</div>
      <div className={`text-3xl font-bold ${data.net >= 0 ? "text-success" : "text-destructive"}`}>
        {formatCurrency(data.net)}
      </div>
      <div className="text-sm text-muted-foreground">
        {top
          ? `${top.category_name} is your top expense at ${formatCurrency(Math.abs(top.total))}.`
          : "Classify more transactions to unlock category insights."}
      </div>
    </div>
  );
}

registerWidget({
  id: "snapshot",
  name: "Snapshot",
  description: "Headline net position and top expense driver.",
  category: "overview",
  defaultSize: "full",
  component: SnapshotWidget,
  defaultEnabled: true,
});
