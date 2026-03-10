import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type AnalyticsCategoryAmount, type AnalyticsTimeseriesPoint, type Trip } from "@/lib/api";
import CategoryMultiDropdown from "@/components/category/CategoryMultiDropdown";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { MerchantMultiSelect } from "@/components/widget-controls/MerchantMultiSelect";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";
import { applyZoomWindow, clearWidgetZoom, readWidgetZoom } from "@/lib/widgets/zoomState";

type SavedCategoryCombo = {
  name: string;
  categoryIds: number[];
};

const SAVED_COMBOS_KEY = "interactive_category_bar_saved_combos";

type ChartGranularity = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfPeriod(date: Date, granularity: ChartGranularity): Date {
  const d = new Date(date);
  if (granularity === "daily") return d;
  if (granularity === "weekly") {
    const day = d.getUTCDay(); // 0=Sun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + mondayOffset);
    return d;
  }
  if (granularity === "monthly") {
    d.setUTCDate(1);
    return d;
  }
  if (granularity === "quarterly") {
    const qStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
    d.setUTCMonth(qStartMonth, 1);
    return d;
  }
  d.setUTCMonth(0, 1);
  return d;
}

function addPeriod(date: Date, granularity: ChartGranularity): Date {
  const d = new Date(date);
  if (granularity === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (granularity === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (granularity === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (granularity === "quarterly") d.setUTCMonth(d.getUTCMonth() + 3);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

function weekKey(date: Date): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1WeekdayMon0 = (jan1.getUTCDay() + 6) % 7; // Mon=0
  const daysToFirstMonday = jan1WeekdayMon0 === 0 ? 0 : 7 - jan1WeekdayMon0;
  const firstMonday = new Date(jan1);
  firstMonday.setUTCDate(jan1.getUTCDate() + daysToFirstMonday);
  let week = 0;
  if (d >= firstMonday) {
    week = Math.floor((d.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function periodKey(date: Date, granularity: ChartGranularity): string {
  const d = startOfPeriod(date, granularity);
  if (granularity === "daily") return toIsoDate(d);
  if (granularity === "weekly") return weekKey(d);
  if (granularity === "monthly") return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  if (granularity === "quarterly") return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  return String(d.getUTCFullYear());
}

function parsePeriodStart(period: string, granularity: ChartGranularity): Date | null {
  if (granularity === "daily") return /^\d{4}-\d{2}-\d{2}$/.test(period) ? parseIsoDate(period) : null;
  if (granularity === "weekly") {
    const m = /^(\d{4})-W(\d{2})$/.exec(period);
    if (!m) return null;
    const year = Number(m[1]);
    const week = Number(m[2]);
    const jan1 = new Date(Date.UTC(year, 0, 1));
    if (week === 0) return jan1;
    const jan1WeekdayMon0 = (jan1.getUTCDay() + 6) % 7;
    const daysToFirstMonday = jan1WeekdayMon0 === 0 ? 0 : 7 - jan1WeekdayMon0;
    const firstMonday = new Date(jan1);
    firstMonday.setUTCDate(jan1.getUTCDate() + daysToFirstMonday + (week - 1) * 7);
    return firstMonday;
  }
  if (granularity === "monthly") {
    const m = /^(\d{4})-(\d{2})$/.exec(period);
    return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)) : null;
  }
  if (granularity === "quarterly") {
    const m = /^(\d{4})-Q([1-4])$/.exec(period);
    return m ? new Date(Date.UTC(Number(m[1]), (Number(m[2]) - 1) * 3, 1)) : null;
  }
  if (/^\d{4}$/.test(period)) return new Date(Date.UTC(Number(period), 0, 1));
  return null;
}

function expandCategoryIdsWithDescendants(
  selectedIds: number[],
  categories: Array<{ id: number; parent_id: number | null }>
): number[] {
  if (!selectedIds.length || !categories.length) return selectedIds;
  const childrenByParent = new Map<number, number[]>();
  for (const category of categories) {
    if (category.parent_id == null) continue;
    const list = childrenByParent.get(category.parent_id) ?? [];
    list.push(category.id);
    childrenByParent.set(category.parent_id, list);
  }
  const expanded = new Set<number>(selectedIds);
  const queue = [...selectedIds];
  while (queue.length) {
    const current = queue.shift();
    if (current == null) continue;
    const children = childrenByParent.get(current) ?? [];
    for (const childId of children) {
      if (!expanded.has(childId)) {
        expanded.add(childId);
        queue.push(childId);
      }
    }
  }
  return Array.from(expanded);
}

function InteractiveCategoryBarWidget({
  filters,
  globalControls,
  widgetState,
  setWidgetState,
}: WidgetProps) {
  const { chartColors } = useTheme();
  const zoom = readWidgetZoom(widgetState);
  const [granularity, setGranularity] = useState<
    "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  >(
    (widgetState?.granularity as
      | "daily"
      | "weekly"
      | "monthly"
      | "quarterly"
      | "yearly") ??
      (globalControls?.granularity && globalControls.granularity !== "auto"
        ? globalControls.granularity
        : "monthly")
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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    Array.isArray(widgetState?.selectedCategoryIds)
      ? (widgetState?.selectedCategoryIds as number[]).filter((id) => Number.isFinite(Number(id)))
      : []
  );
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
  const [showEmptyPeriods, setShowEmptyPeriods] = useState<boolean>(
    widgetState?.showEmptyPeriods === undefined ? true : Boolean(widgetState?.showEmptyPeriods)
  );
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [selectedMerchantNames, setSelectedMerchantNames] = useState<string[]>(
    Array.isArray(widgetState?.selectedMerchantNames)
      ? (widgetState?.selectedMerchantNames as string[]).filter(
          (value) => typeof value === "string" && value.trim()
        )
      : []
  );
  const [merchantSearch, setMerchantSearch] = useState<string>(
    String(widgetState?.merchantSearch ?? "")
  );
  const [trips, setTrips] = useState<Trip[]>([]);
  const [windowBounds, setWindowBounds] = useState<{ min_date: string | null; max_date: string | null }>({
    min_date: null,
    max_date: null,
  });

  const colorPalette = chartColors.palette;
  const selectedCategoryIdsExpanded = useMemo(
    () => expandCategoryIdsWithDescendants(selectedCategoryIds, allCategories),
    [selectedCategoryIds, allCategories]
  );

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
    api.getTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

  useEffect(() => {
    api
      .getCategoryBreakdown(toAnalyticsParams(filters, globalControls))
      .then((res) => {
        const expensesOnly = res.items.filter((c) => c.total < 0).map((c) => ({ ...c, total: Math.abs(c.total) }));
        setCategoryOptions(expensesOnly);
        setSelectedCategoryIds((prev) => (prev.length ? prev : expensesOnly.slice(0, 4).map((c) => c.category_id)));
      })
      .catch(() => {
        setCategoryOptions([]);
      });
  }, [filters, globalControls]);

  useEffect(() => {
    api
      .getMerchantRanking({
        ...toAnalyticsParams(filters, globalControls, {
          categoryIds: selectedCategoryIdsExpanded.length ? selectedCategoryIdsExpanded : undefined,
        }),
        includeTransfers,
        limit: 100,
      })
      .then((res) => {
        const names = res.items
          .map((item) => item.merchant?.trim())
          .filter((name): name is string => Boolean(name));
        if (names.length > 0 || selectedCategoryIdsExpanded.length === 0) {
          setMerchantOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
          return;
        }
        // Fallback: if selected categories produced no merchants, show current-scope merchants.
        api
          .getMerchantRanking({
            ...toAnalyticsParams(filters, globalControls),
            includeTransfers,
            limit: 100,
          })
          .then((fallbackRes) => {
            const fallbackNames = fallbackRes.items
              .map((item) => item.merchant?.trim())
              .filter((name): name is string => Boolean(name));
            setMerchantOptions(Array.from(new Set(fallbackNames)).sort((a, b) => a.localeCompare(b)));
          })
          .catch(() => setMerchantOptions([]));
      })
      .catch(() => setMerchantOptions([]));
  }, [filters, globalControls, includeTransfers, selectedCategoryIdsExpanded]);

  useEffect(() => {
    api
      .getTransactionBounds({
        account_id: filters.accountId ?? undefined,
        person_id: filters.personId ?? undefined,
      })
      .then((b) => setWindowBounds({ min_date: b.min_date, max_date: b.max_date }))
      .catch(() => setWindowBounds({ min_date: null, max_date: null }));
  }, [filters.accountId, filters.personId]);

  useEffect(() => {
    api
      .getAnalyticsTimeseries({
        ...toAnalyticsParams(filters, globalControls, {
          categoryIds: selectedCategoryIdsExpanded.length ? selectedCategoryIdsExpanded : undefined,
          merchantNames: selectedMerchantNames.length ? selectedMerchantNames : undefined,
        }),
        granularity,
        includeTransfers,
      })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters, globalControls, granularity, selectedCategoryIdsExpanded, selectedMerchantNames, includeTransfers]);

  useEffect(() => {
    setWidgetState?.({
      granularity,
      selectedCategoryIds,
      mode,
      search,
      showControls,
      showAdvanced,
      topN,
      minContributionPct,
      includeTransfers,
      chartType,
      showTotalExpenses,
      showEmptyPeriods,
      selectedMerchantNames,
      merchantSearch,
    });
  }, [
    chartType,
    granularity,
    includeTransfers,
    selectedCategoryIds,
    minContributionPct,
    mode,
    search,
    setWidgetState,
    showAdvanced,
    showControls,
    showTotalExpenses,
    showEmptyPeriods,
    selectedMerchantNames,
    merchantSearch,
    topN,
  ]);

  useEffect(() => {
    if (!selectedMerchantNames.length) return;
    const optionSet = new Set(merchantOptions);
    const next = selectedMerchantNames.filter((name) => optionSet.has(name));
    if (next.length !== selectedMerchantNames.length) {
      setSelectedMerchantNames(next);
    }
  }, [merchantOptions, selectedMerchantNames]);

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

  const chartRows = useMemo(() => {
    if (!showEmptyPeriods || !preparedRows.length) return preparedRows;

    const startStr =
      filters.dateRange.start ?? windowBounds.min_date ?? null;
    const endStr =
      filters.dateRange.end ?? windowBounds.max_date ?? null;

    let rangeStart = startStr ? parseIsoDate(startStr) : null;
    let rangeEnd = endStr ? parseIsoDate(endStr) : null;

    if (!rangeStart || !rangeEnd) {
      const parsed = preparedRows
        .map((row) => parsePeriodStart(String(row.period), granularity))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      if (!rangeStart) rangeStart = parsed[0] ?? null;
      if (!rangeEnd) rangeEnd = parsed[parsed.length - 1] ?? null;
    }
    if (!rangeStart || !rangeEnd) return preparedRows;

    const byPeriod = new Map(
      preparedRows.map((row) => [String(row.period), row])
    );
    const selectedKeys =
      mode === "combined"
        ? ["selectedCombined"]
        : selectedCategoryIds.map((id) => `cat_${id}`);
    const dense: Array<Record<string, string | number>> = [];

    let cursor = startOfPeriod(rangeStart, granularity);
    const endBoundary = rangeEnd.getTime();
    while (cursor.getTime() <= endBoundary) {
      const key = periodKey(cursor, granularity);
      const existing = byPeriod.get(key);
      if (existing) {
        dense.push(existing);
      } else {
        const emptyRow: Record<string, string | number> = {
          period: key,
          income: 0,
          expenses: 0,
          selectedCombined: 0,
        };
        for (const seriesKey of selectedKeys) emptyRow[seriesKey] = 0;
        dense.push(emptyRow);
      }
      cursor = addPeriod(cursor, granularity);
    }
    return dense;
  }, [
    filters.dateRange.end,
    filters.dateRange.start,
    granularity,
    preparedRows,
    mode,
    selectedCategoryIds,
    showEmptyPeriods,
    windowBounds.max_date,
    windowBounds.min_date,
  ]);

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
          color: chartColors.net,
        },
      ];
    }
    return selectedCategoryIds.map((categoryId, idx) => ({
      key: `cat_${categoryId}`,
      name: categoryById.get(categoryId)?.category_name ?? `Category ${categoryId}`,
      color: colorPalette[idx % colorPalette.length],
    }));
  }, [mode, selectedCategoryIds, categoryById, colorPalette, chartColors.net]);

  const showExpenseComparison = showTotalExpenses && selectedCategoryIds.length > 0;
  const zoomedChartRows = useMemo(
    () => applyZoomWindow(chartRows, zoom, (row) => String(row.period)),
    [chartRows, zoom]
  );

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
  }, [preparedRows, selectedSeries, mode]);

  const tripWindows = useMemo(() => {
    if (globalControls?.excludeTripIncluded || !chartRows.length || !trips.length) return [];
    const periodSet = new Set(chartRows.map((row) => String(row.period)));
    const windows: Array<{ name: string; x1: string; x2: string }> = [];
    for (const trip of trips) {
      const x1 = periodKey(parseIsoDate(trip.start_date), granularity);
      const x2 = periodKey(parseIsoDate(trip.end_date), granularity);
      if (!periodSet.has(x1) && !periodSet.has(x2)) continue;
      windows.push({ name: trip.name, x1, x2 });
    }
    return windows;
  }, [chartRows, globalControls?.excludeTripIncluded, granularity, trips]);

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
          <MerchantMultiSelect
            options={merchantOptions}
            selected={selectedMerchantNames}
            onChange={setSelectedMerchantNames}
            search={merchantSearch}
            onSearchChange={setMerchantSearch}
            label="Merchants"
            placeholder="All merchants"
          />
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
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showEmptyPeriods}
              onChange={(e) => setShowEmptyPeriods(e.target.checked)}
            />
            Show empty periods
          </label>
          <button
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={() => setWidgetState?.(clearWidgetZoom(widgetState))}
          >
            Reset zoom
          </button>
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
            <BarChart data={zoomedChartRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              {tripWindows.map((window) => (
                <ReferenceArea
                  key={`${window.name}-${window.x1}-${window.x2}`}
                  x1={window.x1}
                  x2={window.x2}
                  fill={chartColors.reference}
                  fillOpacity={0.08}
                  stroke={chartColors.reference}
                  strokeDasharray="3 3"
                  label={{
                    value: window.name,
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: chartColors.reference,
                  }}
                />
              ))}
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {showExpenseComparison && (
                <Bar dataKey="expenses" fill={chartColors.expenses} name="Total expenses" />
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
                  stroke={chartColors.reference}
                  strokeDasharray="4 4"
                  label={{
                    value: averageReference.label,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: chartColors.reference,
                  }}
                />
              )}
            </BarChart>
          ) : (
            <LineChart data={zoomedChartRows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              {tripWindows.map((window) => (
                <ReferenceArea
                  key={`${window.name}-${window.x1}-${window.x2}`}
                  x1={window.x1}
                  x2={window.x2}
                  fill={chartColors.reference}
                  fillOpacity={0.08}
                  stroke={chartColors.reference}
                  strokeDasharray="3 3"
                  label={{
                    value: window.name,
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: chartColors.reference,
                  }}
                />
              ))}
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              {showExpenseComparison && (
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Total expenses"
                  stroke={chartColors.expenses}
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
                  stroke={chartColors.reference}
                  strokeDasharray="4 4"
                  label={{
                    value: averageReference.label,
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: chartColors.reference,
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
