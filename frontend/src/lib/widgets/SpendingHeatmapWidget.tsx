import { useEffect, useMemo, useState } from "react";
import { CategoryMultiSelect } from "@/components/widget-controls/CategoryMultiSelect";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { MerchantMultiSelect } from "@/components/widget-controls/MerchantMultiSelect";
import AccountIcon from "@/components/icons/AccountIcon";
import PersonIcon from "@/components/icons/PersonIcon";
import { api, type Account, type AnalyticsCategoryAmount, type AnalyticsTimeseriesPoint, type MerchantRankingItem, type Person, type Transaction, type Trip } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { formatCurrency } from "@/lib/utils";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import { registerWidget } from "@/lib/widgets/registry";
import type { WidgetProps } from "@/lib/widgets/types";

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((v) => Number(v));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function endOfWeekSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const offset = day === 0 ? 0 : 7 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function isWithin(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function safeNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function SpendingHeatmapWidget({ filters, globalControls, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const [showControls, setShowControls] = useState<boolean>(Boolean(widgetState?.showControls ?? false));
  const [showAdvanced, setShowAdvanced] = useState<boolean>(Boolean(widgetState?.showAdvanced ?? false));
  const [categorySearch, setCategorySearch] = useState<string>(
    typeof widgetState?.categorySearch === "string" ? widgetState.categorySearch : ""
  );
  const [merchantSearch, setMerchantSearch] = useState<string>(
    typeof widgetState?.merchantSearch === "string" ? widgetState.merchantSearch : ""
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    () => safeNumberArray(widgetState?.selectedCategoryIds)
  );
  const [selectedMerchantNames, setSelectedMerchantNames] = useState<string[]>(
    () => safeStringArray(widgetState?.selectedMerchantNames)
  );

  const [rows, setRows] = useState<AnalyticsTimeseriesPoint[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<AnalyticsCategoryAmount[]>([]);
  const [merchantOptions, setMerchantOptions] = useState<string[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDayTransactions, setSelectedDayTransactions] = useState<Transaction[]>([]);

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
    api.getTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

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
      .getAnalyticsTimeseries({
        ...toAnalyticsParams(filters, globalControls, {
          categoryIds: selectedCategoryIds.length ? selectedCategoryIds : undefined,
          merchantNames: selectedMerchantNames.length ? selectedMerchantNames : undefined,
        }),
        granularity: "daily",
      })
      .then((res) => setRows(res.points))
      .catch(() => setRows([]));
  }, [filters, globalControls, selectedCategoryIds, selectedMerchantNames]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!selectedDay) return;
    api
      .getTransactions({
        page: 1,
        page_size: 200,
        start_date: selectedDay,
        end_date: selectedDay,
        account_id: filters.accountId ?? undefined,
        person_id: filters.personId ?? undefined,
        category_ids: selectedCategoryIds.length ? selectedCategoryIds : undefined,
        include_transfers: false,
      })
      .then((res) => {
        const nonTransfers = res.items.filter(
          (t) => !t.is_internal_transfer && !(t.has_external_funding_links ?? false)
        );
        const filtered = selectedMerchantNames.length
          ? nonTransfers.filter((item) => selectedMerchantNames.includes(item.merchant ?? ""))
          : nonTransfers;
        setSelectedDayTransactions(filtered);
      })
      .catch(() => setSelectedDayTransactions([]));
  }, [selectedDay, filters.accountId, filters.personId, selectedCategoryIds, selectedMerchantNames]);

  const dayMap = useMemo(() => {
    const out = new Map<string, AnalyticsTimeseriesPoint>();
    for (const row of rows) out.set(row.period, row);
    return out;
  }, [rows]);

  const dateSpan = useMemo(() => {
    if (filters.dateRange.start && filters.dateRange.end) {
      return {
        start: parseDate(filters.dateRange.start),
        end: parseDate(filters.dateRange.end),
      };
    }
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.period.localeCompare(b.period));
    return {
      start: parseDate(sorted[0].period),
      end: parseDate(sorted[sorted.length - 1].period),
    };
  }, [filters.dateRange.end, filters.dateRange.start, rows]);

  const grid = useMemo(() => {
    if (!dateSpan) return { weeks: [] as Date[][], monthHeaders: [] as { label: string; col: number }[] };
    const start = startOfWeekMonday(dateSpan.start);
    const end = endOfWeekSunday(dateSpan.end);
    const weeks: Date[][] = [];
    const monthHeaders: { label: string; col: number }[] = [];

    const cursor = new Date(start);
    let col = 0;
    while (cursor <= end) {
      const weekStart = new Date(cursor);
      const weekDays = Array.from({ length: 7 }, (_, idx) => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() + idx);
        return d;
      });
      if (weekStart.getUTCDate() <= 7) {
        monthHeaders.push({
          label: weekStart.toLocaleString(undefined, { month: "short", timeZone: "UTC" }),
          col,
        });
      }
      weeks.push(weekDays);
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      col += 1;
    }

    return { weeks, monthHeaders };
  }, [dateSpan]);

  const maxExpense = useMemo(() => Math.max(1, ...rows.map((r) => r.expenses)), [rows]);

  const summary = useMemo(() => {
    if (!rows.length) return { total: 0, avg: 0, busiest: null as AnalyticsTimeseriesPoint | null, quietest: null as AnalyticsTimeseriesPoint | null };
    const total = rows.reduce((sum, row) => sum + row.expenses, 0);
    const sorted = [...rows].sort((a, b) => a.expenses - b.expenses);
    return {
      total,
      avg: total / rows.length,
      quietest: sorted[0],
      busiest: sorted[sorted.length - 1],
    };
  }, [rows]);

  const categoryOptionRows = useMemo(
    () => categoryOptions.map((item) => ({ id: item.category_id, name: item.category_name })),
    [categoryOptions]
  );

  if (!rows.length) return <div className="text-sm text-muted-foreground">No daily data yet.</div>;

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

      <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
        <div className="rounded-md border border-border p-2"><div className="text-muted-foreground">Days shown</div><div className="font-semibold">{rows.length}</div></div>
        <div className="rounded-md border border-border p-2"><div className="text-muted-foreground">Total spend</div><div className="font-semibold">{formatCurrency(summary.total)}</div></div>
        <div className="rounded-md border border-border p-2"><div className="text-muted-foreground">Avg / day</div><div className="font-semibold">{formatCurrency(summary.avg)}</div></div>
        <div className="rounded-md border border-border p-2"><div className="text-muted-foreground">Busiest</div><div className="font-semibold">{summary.busiest ? `${summary.busiest.period} (${formatCurrency(summary.busiest.expenses)})` : "--"}</div></div>
        <div className="rounded-md border border-border p-2"><div className="text-muted-foreground">Quietest</div><div className="font-semibold">{summary.quietest ? `${summary.quietest.period} (${formatCurrency(summary.quietest.expenses)})` : "--"}</div></div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border p-2">
        <div className="grid" style={{ gridTemplateColumns: `64px repeat(${grid.weeks.length}, minmax(10px, 1fr))`, gap: "4px" }}>
          <div />
          {Array.from({ length: grid.weeks.length }).map((_, col) => {
            const month = grid.monthHeaders.find((m) => m.col === col);
            return (
              <div key={`month-${col}`} className="text-[10px] text-muted-foreground">
                {month ? month.label : ""}
              </div>
            );
          })}

          {WEEKDAY_LABELS.map((label, rowIdx) => (
            <>
              <div key={`label-${label}`} className="text-[10px] text-muted-foreground">
                {rowIdx % 2 === 0 ? label : ""}
              </div>
              {grid.weeks.map((week, colIdx) => {
                const day = week[rowIdx];
                const iso = toIsoDate(day);
                const row = dayMap.get(iso);
                const intensity = row ? Math.max(0.1, row.expenses / maxExpense) : 0.04;
                const dayTrips = trips.filter((trip) => isWithin(iso, trip.start_date, trip.end_date));
                const tripLabel = dayTrips.map((trip) => trip.name).join(", ");
                return (
                  <button
                    type="button"
                    key={`${iso}-${colIdx}-${rowIdx}`}
                    onClick={() => setSelectedDay(iso)}
                    className={`h-3 w-3 rounded-sm ${dayTrips.length ? "ring-1 ring-accent" : ""}`}
                    style={{ backgroundColor: `rgba(${chartColors.heatmapBase}, ${intensity})` }}
                    title={`${iso} ${row ? formatCurrency(row.expenses) : formatCurrency(0)}${tripLabel ? ` | Trips: ${tripLabel}` : ""}`}
                  />
                );
              })}
            </>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>Less</span>
          {[0.1, 0.25, 0.45, 0.65, 0.9].map((a) => (
            <span
              key={String(a)}
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: `rgba(${chartColors.heatmapBase}, ${a})` }}
            />
          ))}
          <span>More</span>
          <span className="ml-2">{formatCurrency(0)} - {formatCurrency(maxExpense)}</span>
        </div>
      </div>

      {selectedDay ? (
        <div className="rounded-md border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">
              {selectedDay}
              {(() => {
                const dayTrips = trips.filter((trip) => isWithin(selectedDay, trip.start_date, trip.end_date));
                return dayTrips.length ? <span className="ml-2 text-xs text-muted-foreground">({dayTrips.map((trip) => trip.name).join(", ")})</span> : null;
              })()}
            </div>
            <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => setSelectedDay(null)}>
              Close
            </button>
          </div>
          <div className="space-y-1 text-xs">
            {selectedDayTransactions.length ? (
              selectedDayTransactions.map((txn) => {
                const acc = accounts.find((a) => a.id === txn.account_id);
                const person = acc?.person_id ? people.find((p) => p.id === acc.person_id) : null;
                return (
                  <div key={txn.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex shrink-0 items-center gap-1">
                        <PersonIcon iconId={person?.icon_id} title={person?.name ?? "Unassigned"} className="text-sm" />
                        <AccountIcon iconId={acc?.icon_id} title={acc?.name ?? "Unknown"} className="text-sm" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{txn.merchant || "Unknown"}</div>
                        <div className="truncate text-muted-foreground">{txn.description}</div>
                      </div>
                    </div>
                    <div
                      className={`whitespace-nowrap font-medium ${
                        txn.amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {txn.amount >= 0 ? "+" : ""}{formatCurrency(txn.amount)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-muted-foreground">No transactions for this day and filter selection.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

registerWidget({
  id: "spending-heatmap",
  name: "Spending Heatmap",
  description: "Calendar-style daily expense intensity with trip overlays and day drill-down.",
  category: "advanced",
  defaultSize: "lg",
  component: SpendingHeatmapWidget,
});


