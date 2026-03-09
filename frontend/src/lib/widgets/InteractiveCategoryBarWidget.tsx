import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AnalyticsCategoryAmount, type AnalyticsTimeseriesPoint } from "@/lib/api";
import CategoryMultiDropdown from "@/components/category/CategoryMultiDropdown";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

type SavedCategoryCombo = {
  name: string;
  categoryIds: number[];
};

const SAVED_COMBOS_KEY = "interactive_category_bar_saved_combos";

function InteractiveCategoryBarWidget({
  filters,
  globalControls,
  widgetState,
  setWidgetState,
}: WidgetProps) {
  const [granularity, setGranularity] = useState<
    "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  >(
    globalControls?.granularity && globalControls.granularity !== "auto"
      ? globalControls.granularity
      : "monthly"
  );
  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<AnalyticsCategoryAmount[]>([]);
  const [allCategories, setAllCategories] = useState<
    Array<{
      id: number;
      name: string;
      parent_id: number | null;
      is_income: boolean;
      sort_order: number;
    }>
  >([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"combined" | "individual">(
    (widgetState?.mode as "combined" | "individual") ?? "combined"
  );
  const [search, setSearch] = useState(String(widgetState?.search ?? ""));
  const [savedCombos, setSavedCombos] = useState<SavedCategoryCombo[]>([]);
  const [comboName, setComboName] = useState("");
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [topN, setTopN] = useState<number>(Number(widgetState?.topN ?? 8));
  const [minContributionPct, setMinContributionPct] = useState<number>(
    Number(widgetState?.minContributionPct ?? 0)
  );
  const [includeTransfers, setIncludeTransfers] = useState<boolean>(
    Boolean(widgetState?.includeTransfers ?? false)
  );
  const [chartType, setChartType] = useState<"bar" | "line">(
    (widgetState?.chartType as "bar" | "line") ?? "bar"
  );
  const [showTotalExpenses, setShowTotalExpenses] = useState<boolean>(
    Boolean(widgetState?.showTotalExpenses ?? false)
  );

  const colorPalette = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#4f46e5", "#c026d3"];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_COMBOS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedCategoryCombo[];
      if (Array.isArray(parsed)) setSavedCombos(parsed);
    } catch {
      // ignore malformed local data
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SAVED_COMBOS_KEY, JSON.stringify(savedCombos));
  }, [savedCombos]);

  useEffect(() => {
    api.getCategories().then(setAllCategories).catch(() => setAllCategories([]));
  }, []);

  useEffect(() => {
    api
      .getCategoryBreakdown(toAnalyticsParams(filters))
      .then((res) => {
        const expensesOnly = res.items.filter((c) => c.total < 0).map((c) => ({ ...c, total: Math.abs(c.total) }));
        setCategoryOptions(expensesOnly);
        setSelectedCategoryIds((prev) => (prev.length ? prev : expensesOnly.slice(0, 4).map((c) => c.category_id)));
      })
      .catch(() => {
        setCategoryOptions([]);
      });
  }, [filters]);

  useEffect(() => {
    api
      .getAnalyticsTimeseries({
        ...toAnalyticsParams(filters),
        granularity,
        categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        includeTransfers,
      })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters, granularity, selectedCategoryIds, includeTransfers]);

  useEffect(() => {
    setWidgetState?.({
      mode,
      search,
      showControls,
      showAdvanced,
      topN,
      minContributionPct,
      includeTransfers,
      chartType,
      showTotalExpenses,
    });
  }, [
    chartType,
    includeTransfers,
    minContributionPct,
    mode,
    search,
    setWidgetState,
    showAdvanced,
    showControls,
    showTotalExpenses,
    topN,
  ]);

  const preparedRows = useMemo(() => {
    if (!rows.length) return [];
    return rows.map((row) => {
      const entry: Record<string, string | number> = {
        period: row.period,
        income: row.income,
        expenses: row.expenses,
      };
      let combined = 0;
      for (const cat of row.categories) {
        const key = `cat_${cat.category_id}`;
        const value = Math.abs(cat.total);
        if (selectedCategoryIds.includes(cat.category_id)) {
          entry[key] = value;
          combined += value;
        }
      }
      entry.selectedCombined = combined;
      return entry;
    });
  }, [rows, selectedCategoryIds]);

  const filteredCategoryOptions = useMemo(() => {
    const base = [...categoryOptions].sort((a, b) => b.total - a.total).slice(0, topN);
    const total = base.reduce((sum, item) => sum + item.total, 0);
    const threshold = (minContributionPct / 100) * total;
    return base.filter((item) => item.total >= threshold);
  }, [categoryOptions, topN, minContributionPct]);

  const categoryById = useMemo(
    () => new Map(categoryOptions.map((cat) => [cat.category_id, cat])),
    [categoryOptions]
  );

  const selectedSeries = useMemo(() => {
    if (mode === "combined") {
      return [
        {
          key: "selectedCombined",
          name: "Selected categories (combined)",
          color: "#2563eb",
        },
      ];
    }
    return selectedCategoryIds.map((categoryId, idx) => ({
      key: `cat_${categoryId}`,
      name: categoryById.get(categoryId)?.category_name ?? `Category ${categoryId}`,
      color: colorPalette[idx % colorPalette.length],
    }));
  }, [mode, selectedCategoryIds, categoryById, colorPalette]);

  const showExpenseComparison = showTotalExpenses && selectedCategoryIds.length > 0;

  const averageReference = useMemo(() => {
    if (!preparedRows.length || !selectedSeries.length) return null;
    const targetKey =
      mode === "combined" || selectedSeries.length === 1
        ? selectedSeries[0].key
        : "selectedCombined";
    const values = preparedRows.map((row) => Number(row[targetKey] ?? row.selectedCombined ?? 0));
    if (!values.length) return null;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    if (!Number.isFinite(mean)) return null;
    return {
      value: mean,
      label: `Avg (${values.length} periods): ${formatCurrency(mean)}`,
    };
  }, [preparedRows, selectedSeries, mode, granularity]);

  useEffect(() => {
    if (!filteredCategoryOptions.length) return;
    setSelectedCategoryIds((prev) => {
      const set = new Set(filteredCategoryOptions.map((c) => c.category_id));
      const kept = prev.filter((id) => set.has(id));
      return kept.length ? kept : filteredCategoryOptions.slice(0, 4).map((c) => c.category_id);
    });
  }, [filteredCategoryOptions]);

  function saveCurrentCombo() {
    const name = comboName.trim();
    if (!name || !selectedCategoryIds.length) return;
    setSavedCombos((prev) => {
      const withoutSameName = prev.filter((combo) => combo.name.toLowerCase() !== name.toLowerCase());
      return [...withoutSameName, { name, categoryIds: [...selectedCategoryIds] }];
    });
    setComboName("");
  }

  function applyQuickPreset(preset: "top3" | "top5" | "clear") {
    if (preset === "clear") {
      setSelectedCategoryIds([]);
      return;
    }
    const size = preset === "top3" ? 3 : 5;
    const ids = categoryOptions
      .slice()
      .sort((a, b) => b.total - a.total)
      .slice(0, size)
      .map((cat) => cat.category_id);
    setSelectedCategoryIds(ids);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((g) => (
          <button
            key={g}
            className={`rounded-md border px-3 py-1 text-sm ${g === granularity ? "bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setGranularity(g)}
          >
            {g}
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <button
          className={`rounded-md border px-3 py-1 text-sm ${mode === "combined" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          onClick={() => setMode("combined")}
        >
          Combined
        </button>
        <button
          className={`rounded-md border px-3 py-1 text-sm ${mode === "individual" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          onClick={() => setMode("individual")}
        >
          Individual
        </button>
        <div className="mx-1 h-6 w-px bg-border" />
        <button
          className={`rounded-md border px-3 py-1 text-sm ${chartType === "bar" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          onClick={() => setChartType("bar")}
        >
          Bar
        </button>
        <button
          className={`rounded-md border px-3 py-1 text-sm ${chartType === "line" ? "bg-primary text-primary-foreground" : "bg-background"}`}
          onClick={() => setChartType("line")}
        >
          Line
        </button>
      </div>
      <div className="space-y-2 rounded-md border border-border p-3">
        <ControlsSection
          showControls={showControls}
          onToggleControls={() => setShowControls((prev) => !prev)}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
          advanced={
            <div className="grid gap-2 md:grid-cols-2">
              <ThresholdSlider
                label="Top categories cap"
                min={3}
                max={20}
                step={1}
                value={topN}
                onChange={setTopN}
              />
              <ThresholdSlider
                label="Min contribution"
                min={0}
                max={20}
                step={1}
                value={minContributionPct}
                suffix="%"
                onChange={setMinContributionPct}
              />
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-md border px-2 py-1 text-xs" onClick={() => applyQuickPreset("top3")}>
              Top 3 spend
            </button>
            <button className="rounded-md border px-2 py-1 text-xs" onClick={() => applyQuickPreset("top5")}>
              Top 5 spend
            </button>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Categories</div>
            <CategoryMultiDropdown
              categories={allCategories}
              selectedIds={selectedCategoryIds}
              search={search}
              onSearchChange={setSearch}
              onChange={setSelectedCategoryIds}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeTransfers}
              onChange={(e) => setIncludeTransfers(e.target.checked)}
            />
            Include transfers
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showTotalExpenses}
              onChange={(e) => setShowTotalExpenses(e.target.checked)}
            />
            Show total expenses (compare)
          </label>
        </ControlsSection>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/70 p-2">
          <input
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            placeholder="Save current selection as..."
            value={comboName}
            onChange={(e) => setComboName(e.target.value)}
          />
          <button className="rounded-md border px-2 py-1 text-xs" onClick={saveCurrentCombo}>
            Save combination
          </button>
          {savedCombos.map((combo) => (
            <span key={combo.name} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
              <button
                className="text-left"
                onClick={() => setSelectedCategoryIds(combo.categoryIds)}
                title={`Apply ${combo.name}`}
              >
                {combo.name}
              </button>
              <button
                className="text-destructive"
                onClick={() =>
                  setSavedCombos((prev) => prev.filter((entry) => entry.name !== combo.name))
                }
                title="Delete saved combination"
              >
                x
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={preparedRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {showExpenseComparison && (
                <Bar dataKey="expenses" fill="#ef4444" name="Total expenses" />
              )}
              {selectedSeries.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.name}
                  fill={series.color}
                  stackId={mode === "individual" ? "selected-cats" : undefined}
                />
              ))}
              {averageReference && (
                <ReferenceLine
                  y={averageReference.value}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: averageReference.label,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />
              )}
            </BarChart>
          ) : (
            <LineChart data={preparedRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {showExpenseComparison && (
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Total expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {selectedSeries.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.name}
                  stroke={series.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
              {averageReference && (
                <ReferenceLine
                  y={averageReference.value}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: averageReference.label,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

registerWidget({
  id: "interactive-category-bar",
  name: "Interactive Category Bar",
  description: "Time-series bars with changeable granularity.",
  category: "trends",
  defaultSize: "full",
  component: InteractiveCategoryBarWidget,
});
