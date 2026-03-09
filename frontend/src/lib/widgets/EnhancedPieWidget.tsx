import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api, type ExternalNetWorthItem, type NetWorthItem } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

const COLORS = ["#3b82f6", "#a855f7", "#f97316", "#10b981", "#f43f5e", "#14b8a6"];

function EnhancedPieWidget({ filters }: WidgetProps) {
  const [items, setItems] = useState<NetWorthItem[]>([]);
  const [externalItems, setExternalItems] = useState<ExternalNetWorthItem[]>([]);
  useEffect(() => {
    api
      .getNetWorth(filters.personId ?? undefined)
      .then((res) => {
        setItems(res.items);
        setExternalItems(res.external_items ?? []);
      })
      .catch(() => {
        setItems([]);
        setExternalItems([]);
      });
  }, [filters.personId]);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.account_group, (map.get(item.account_group) ?? 0) + item.balance);
    }
    for (const item of externalItems) {
      const key = `external-${item.account_group}`;
      const signedValue = item.account_group === "liability" ? -Math.abs(item.latest_value) : item.latest_value;
      map.set(key, (map.get(key) ?? 0) + signedValue);
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [items, externalItems]);

  if (!grouped.length) return <div className="text-sm text-muted-foreground">No net-worth data yet.</div>;
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={grouped} dataKey="total" nameKey="name" innerRadius={55} outerRadius={95}>
            {grouped.map((row, idx) => (
              <Cell key={row.name} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

registerWidget({
  id: "enhanced-pie",
  name: "Net Worth Composition",
  description: "Assets/liabilities/investments grouped by account type.",
  category: "advanced",
  defaultSize: "lg",
  component: EnhancedPieWidget,
});
