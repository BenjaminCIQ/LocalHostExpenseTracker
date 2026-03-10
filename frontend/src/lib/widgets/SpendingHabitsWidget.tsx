import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CategoryMultiSelect } from "@/components/widget-controls/CategoryMultiSelect";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { MerchantMultiSelect } from "@/components/widget-controls/MerchantMultiSelect";
import {
  api,
  type AnalyticsCategoryAmount,
  type MerchantRankingItem,
  type SpendingHabitsResponse,
} from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function trendColor(direction: SpendingHabitsResponse["trend_direction"]) {
  if (direction === "increasing") return "text-red-500";
  if (direction === "decreasing") return "text-green-500";
  return "text-muted-foreground";
}

function SpendingHabitsWidget({ filters, globalControls, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const [showControls, setShowControls] = useState<boolean>((widgetState?.showControls as boolean) ?? false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>((widgetState?.showAdvanced as boolean) ?? false);
  const [categorySearch, setCategorySearch] = useState<string>((widgetState?.categorySearch as string) ?? "");
  const [merchantSearch, setMerchantSearch] = useState<string>((widgetState?.merchantSearch as string) ?? "");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>((widgetState?.selectedCategoryIds as number[]) ?? []);
  const [selectedMerchantNames, setSelectedMerchantNames] = useState<string[]>((widgetState?.selectedMerchantNames as string[]) ?? []);

  const [categoryOptions, setCategoryOptions] = useState<AnalyticsCategoryAmount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [data, setData] = useState<SpendingHabitsResponse | null>(null);

  useEffect(() => {
    setWidgetState?.({
      showControls,
      showAdvanced,
      categorySearch,
      merchantSearch,
      selectedCategoryIds,
      selectedMerchantNames,
    });
  }, [showControls, showAdvanced, categorySearch, merchantSearch, selectedCategoryIds, selectedMerchantNames, setWidgetState]);

  useEffect(() => {
    api
      .getCategoryBreakdown(
        toAnalyticsParams(filters, globalControls, {
          merchantNames: selectedMerchantNames.length ? selectedMerchantNames : undefined,
        })
      )
      .then((res) => setCategoryOptions(res.items))
      .catch(() => setCategoryOptions([]));
  }, [filters, globalControls, selectedMerchantNames]);

  useEffect(() => {
    api
      .getMerchantRanking({
        ...toAnalyticsParams(filters, globalControls, {
          categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        }),
        limit: 100,
      })
      .then((res) => {
        const names = res.items
          .map((item: MerchantRankingItem) => item.merchant?.trim())
          .filter((name): name is string => Boolean(name));
        setMerchantOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => setMerchantOptions([]));
  }, [filters, globalControls, selectedCategoryIds]);

  useEffect(() => {
    api
      .getSpendingHabits(
        toAnalyticsParams(filters, globalControls, {
          categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
          merchantNames: selectedMerchantNames.length ? selectedMerchantNames : undefined,
        })
      )
      .then(setData)
      .catch(() => setData(null));
  }, [filters, globalControls, selectedCategoryIds, selectedMerchantNames]);

  const avgLine = useMemo(() => {
    if (!data?.monthly_trend.length) return 0;
    const values = data.monthly_trend.map((point) => point.total);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [data]);

  const trendLineData = useMemo(() => {
    if (!data?.monthly_trend.length) return [];
    const start = data.monthly_trend[0]?.total ?? 0;
    return data.monthly_trend.map((point, idx) => ({
      ...point,
      trendline: start + data.trend_slope * idx,
      mom_bar: point.mom_change_pct ?? 0,
      rolling_value: point.rolling_avg_3m,
    }));
  }, [data]);

  const categoryOptionRows = useMemo(
    () => categoryOptions.map((item) => ({ id: item.category_id, name: item.category_name })),
    [categoryOptions]
  );

  if (!data) {
    return <div className="text-sm text-muted-foreground">No spending habits data for the current filters.</div>;
  }

  return (
    <div className="space-y-3">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((v) => !v)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((v) => !v)}
      >
        <CategoryMultiSelect
          options={categoryOptionRows}
          selectedIds={selectedCategoryIds}
          onToggle={(id) =>
            setSelectedCategoryIds((prev) =>
              prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
            )
          }
          onSelectAll={() => setSelectedCategoryIds(categoryOptionRows.map((opt) => opt.id))}
          onClear={() => setSelectedCategoryIds([])}
          search={categorySearch}
          onSearchChange={setCategorySearch}
        />
        <MerchantMultiSelect
          options={merchantOptions}
          selected={selectedMerchantNames}
          onChange={setSelectedMerchantNames}
          search={merchantSearch}
          onSearchChange={setMerchantSearch}
          placeholder="All merchants"
          label="Merchants"
        />
      </ControlsSection>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Total spend</div><div className="font-semibold">{formatCurrency(data.summary.total_spend)}</div></div>
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Avg / transaction</div><div className="font-semibold">{formatCurrency(data.summary.avg_amount)}</div></div>
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Frequency</div><div className="font-semibold">{data.summary.avg_transactions_per_month.toFixed(2)} / month</div></div>
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Trend</div><div className={`font-semibold capitalize ${trendColor(data.trend_direction)}`}>{data.trend_direction}</div></div>
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Proportion of total</div><div className="font-semibold">{data.proportion_of_total.toFixed(1)}%</div></div>
        <div className="rounded-md border border-border p-2 text-xs"><div className="text-muted-foreground">Projection / year</div><div className="font-semibold">{data.projected_annual_spend != null ? formatCurrency(data.projected_annual_spend) : "--"}</div></div>
      </div>

      <div className="h-64 rounded-md border border-border p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trendLineData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, key) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                if (key === "mom_bar") return [`${numeric.toFixed(1)}%`, "MoM change"];
                return [formatCurrency(numeric), key === "rolling_value" ? "Rolling avg (3m)" : String(key)];
              }}
            />
            <Area yAxisId="left" type="monotone" dataKey="rolling_value" stroke={chartColors.net} fill={chartColors.net} fillOpacity={0.2} />
            <Bar yAxisId="right" dataKey="mom_bar" fill={chartColors.expenses} barSize={12} />
            <Line yAxisId="left" type="monotone" dataKey="trendline" stroke={chartColors.reference} strokeDasharray="4 4" dot={false} />
            <ReferenceLine yAxisId="left" y={avgLine} stroke={chartColors.reference} strokeDasharray="2 2" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-56 rounded-md border border-border p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.day_of_week} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="day" width={40} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatCurrency(typeof value === "number" ? value : Number(value ?? 0))} />
              <Bar dataKey="total" fill={chartColors.expenses} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="h-56 rounded-md border border-border p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.amount_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range_label" tick={{ fontSize: 10 }} interval={0} angle={-35} height={55} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => String(typeof value === "number" ? value : Number(value ?? 0))} />
              <Bar dataKey="count" fill={chartColors.net} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <div className="grid grid-cols-4 gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium">
          <span>Merchant</span>
          <span className="text-right">Count</span>
          <span className="text-right">Total</span>
          <span className="text-right">Avg</span>
        </div>
        <div className="divide-y divide-border">
          {data.top_merchants.map((row) => (
            <div key={row.merchant} className="grid grid-cols-4 gap-2 px-3 py-2 text-xs">
              <span className="truncate">{row.merchant}</span>
              <span className="text-right">{row.count}</span>
              <span className="text-right">{formatCurrency(row.total_spend)}</span>
              <span className="text-right">{formatCurrency(row.avg_amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

registerWidget({
  id: "spending-habits",
  name: "Spending Habits",
  description: "Deep-dive into spending frequency, trends, and distribution.",
  category: "spending",
  defaultSize: "full",
  component: SpendingHabitsWidget,
});
