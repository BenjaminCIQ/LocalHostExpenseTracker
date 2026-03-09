import { useEffect, useMemo, useState } from "react";
import { api, type Dashboard } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function ExpenseHighlightsWidget({ filters }: WidgetProps) {
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

  const rows = useMemo(() => {
    const sorted = (data?.spending_by_category ?? [])
      .filter((c) => c.total < 0)
      .map((c) => ({ ...c, total: Math.abs(c.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const total = sorted.reduce((sum, c) => sum + c.total, 0);
    return sorted.map((row) => ({ ...row, share: total > 0 ? row.total / total : 0 }));
  }, [data]);

  if (!rows.length) return <div className="text-sm text-muted-foreground">No highlights yet.</div>;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.category_id} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{row.category_name}</span>
            <span>{formatCurrency(row.total)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.max(6, row.share * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

registerWidget({
  id: "expense-highlights",
  name: "Expense Highlights",
  description: "Top categories with share progress bars.",
  category: "spending",
  defaultSize: "lg",
  component: ExpenseHighlightsWidget,
  defaultEnabled: true,
});
