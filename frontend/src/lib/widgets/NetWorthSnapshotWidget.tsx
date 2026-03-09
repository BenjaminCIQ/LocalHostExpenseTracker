import { useEffect, useMemo, useState } from "react";
import { api, type Account, type ExternalAccount, type ExternalNetWorthItem, type NetWorthItem } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

type DisplayRow = {
  id: string;
  name: string;
  balance: number;
  owner: string;
  source: "internal" | "external";
  accountGroup: string;
};

function DonutStat({
  value,
  label,
  ratio,
  ring,
}: {
  value: number;
  label: string;
  ratio: number;
  ring: string;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const size = 96;
  const stroke = 10;
  const center = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * clamped;
  const gap = Math.max(circumference - filled, 0);
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="relative h-24 w-24 shrink-0">
        <svg className="h-24 w-24" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>
        <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-background">
          <div className="text-sm font-semibold">{formatCurrency(value)}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Share: {(clamped * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function NetWorthSnapshotWidget({ filters }: WidgetProps) {
  const [internalItems, setInternalItems] = useState<NetWorthItem[]>([]);
  const [externalItems, setExternalItems] = useState<ExternalNetWorthItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [externalAccounts, setExternalAccounts] = useState<ExternalAccount[]>([]);

  useEffect(() => {
    Promise.all([
      api.getNetWorth(filters.personId ?? undefined),
      api.getAccounts(),
      api.getExternalAccounts(filters.personId ?? undefined),
    ])
      .then(([netWorth, allAccounts, allExternal]) => {
        setInternalItems(netWorth.items ?? []);
        setExternalItems(netWorth.external_items ?? []);
        setAccounts(allAccounts ?? []);
        setExternalAccounts(allExternal ?? []);
      })
      .catch(() => {
        setInternalItems([]);
        setExternalItems([]);
        setAccounts([]);
        setExternalAccounts([]);
      });
  }, [filters.personId]);

  const rows = useMemo<DisplayRow[]>(() => {
    const ownerByAccountId = new Map<number, string>(accounts.map((a) => [a.id, a.owner || "Unknown"]));
    const ownerByExternalId = new Map<number, string>(externalAccounts.map((a) => [a.id, a.owner || "Unknown"]));
    const internalRows: DisplayRow[] = internalItems.map((item) => ({
      id: `i-${item.account_id}`,
      name: item.account_name,
      balance: item.balance,
      owner: ownerByAccountId.get(item.account_id) ?? "Unknown",
      source: "internal",
      accountGroup: item.account_group,
    }));
    const extRows: DisplayRow[] = externalItems.map((item) => {
      const signedBalance = item.account_group === "liability" ? -Math.abs(item.latest_value) : item.latest_value;
      return {
        id: `e-${item.external_account_id}`,
        name: item.account_name,
        balance: signedBalance,
        owner: ownerByExternalId.get(item.external_account_id) ?? "Unknown",
        source: "external",
        accountGroup: item.account_group,
      };
    });
    return [...internalRows, ...extRows];
  }, [accounts, externalAccounts, externalItems, internalItems]);

  const stats = useMemo(() => {
    const assets = rows.filter((r) => r.balance >= 0).reduce((sum, r) => sum + r.balance, 0);
    const liabilitiesAbs = rows.filter((r) => r.balance < 0).reduce((sum, r) => sum + Math.abs(r.balance), 0);
    const netWorth = assets - liabilitiesAbs;
    const base = Math.max(assets + liabilitiesAbs, 1);
    const netBase = Math.max(assets, 1);
    return {
      assets,
      liabilitiesAbs,
      netWorth,
      netWorthRatio: netWorth / netBase,
      assetRatio: assets / base,
      liabilityRatio: liabilitiesAbs / base,
    };
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.accountGroup || "other";
      map.set(key, (map.get(key) ?? 0) + row.balance);
    }
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
      .slice(0, 5);
  }, [rows]);

  const topAccounts = useMemo(
    () =>
      rows
        .filter((r) => r.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 4),
    [rows]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No net-worth data yet.</div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <DonutStat value={stats.netWorth} label="Net Worth" ratio={stats.netWorthRatio} ring="#2dd4bf" />
        <DonutStat value={stats.assets} label="Assets" ratio={stats.assetRatio} ring="#60a5fa" />
        <DonutStat value={stats.liabilitiesAbs} label="Liabilities" ratio={stats.liabilityRatio} ring="#94a3b8" />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {grouped.map((g) => (
          <div key={g.name} className="rounded-md border border-border p-2 text-center">
            <div className="text-xs text-muted-foreground">{g.name}</div>
            <div className={`text-sm font-semibold ${g.total >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(g.total)}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {topAccounts.map((row) => (
          <div key={row.id} className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3">
            <div>
              <div className="font-medium">{row.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{row.accountGroup || "other"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="font-semibold">{formatCurrency(row.balance)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Owner</div>
              <div className="font-medium">
                {row.owner} <span className="ml-2 text-xs text-muted-foreground">({row.source})</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

registerWidget({
  id: "net-worth-snapshot",
  name: "Net Worth Snapshot",
  description: "Visual net worth, assets/liabilities, and top account balances.",
  category: "overview",
  defaultSize: "full",
  component: NetWorthSnapshotWidget,
});
