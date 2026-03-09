import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartPie,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type Dashboard, type MonthlyTotals, type Person } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useSelectedPersonId } from "@/lib/personFilter";

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#4f46e5", "#c026d3", "#d97706", "#059669",
  "#6366f1", "#e11d48",
];

function formatMonthLabel(month: string, variant: "short" | "long" = "short") {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;

  return new Intl.DateTimeFormat("de-DE", {
    month: variant === "short" ? "short" : "long",
    year: "2-digit",
  }).format(date);
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function truncateLabel(value: string, maxLength = 16) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [monthly, setMonthly] = useState<MonthlyTotals[]>([]);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const selectedPersonId = useSelectedPersonId();
  const [people, setPeople] = useState<Person[]>([]);
  const [compareA, setCompareA] = useState<number | "">("");
  const [compareB, setCompareB] = useState<number | "">("");
  const [compareData, setCompareData] = useState<{ a: Dashboard; b: Dashboard } | null>(null);

  useEffect(() => {
    api
      .getMonthlyDashboard(12, undefined, selectedPersonId ?? undefined)
      .then((r) => setMonthly(r.months))
      .catch(() => {});
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, [selectedPersonId]);

  useEffect(() => {
    const month = selectedMonth === "all" ? undefined : selectedMonth;
    api
      .getDashboard({ month, personId: selectedPersonId ?? undefined })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [selectedMonth, selectedPersonId]);

  useEffect(() => {
    const month = selectedMonth === "all" ? undefined : selectedMonth;
    if (!compareA || !compareB || compareA === compareB) {
      setCompareData(null);
      return;
    }
    Promise.all([
      api.getDashboard({ month, personId: Number(compareA) }),
      api.getDashboard({ month, personId: Number(compareB) }),
    ])
      .then(([a, b]) => setCompareData({ a, b }))
      .catch(() => setCompareData(null));
  }, [compareA, compareB, selectedMonth]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading...</p>;

  const { classification_stats: stats } = data;

  const expenseCategories = data.spending_by_category
    .filter((c) => c.total < 0)
    .map((c) => ({ ...c, total: Math.abs(c.total) }))
    .sort((a, b) => b.total - a.total)
    .map((category, index, categories) => {
      const total = categories.reduce((sum, current) => sum + current.total, 0);
      return {
        ...category,
        color: COLORS[index % COLORS.length],
        share: total > 0 ? category.total / total : 0,
      };
    });

  const classifiedExpenseTotal = expenseCategories.reduce(
    (sum, category) => sum + category.total,
    0
  );
  const topCategory = expenseCategories[0];
  const topThreeShare = expenseCategories
    .slice(0, 3)
    .reduce((sum, category) => sum + category.share, 0);
  const classificationRate = stats.total_transactions
    ? (stats.classified / stats.total_transactions) * 100
    : 0;
  const latestMonth = monthly[monthly.length - 1];
  const biggestExpenseMonth = monthly.reduce<MonthlyTotals | null>((highest, month) => {
    if (!highest || month.expenses > highest.expenses) return month;
    return highest;
  }, null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            Finance overview
          </Badge>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              A clearer view of spending trends, category concentration, and
              classification coverage.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm text-muted-foreground">View</span>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm shadow-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            <option value="all">All time</option>
            {monthly.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Comparison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">A</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select person</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">B</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select person</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground">
              Uses the same month/all-time window as the main view.
            </div>
          </div>

          {compareData ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">
                  {people.find((p) => p.id === Number(compareA))?.name ?? "A"}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Income</div>
                    <div className="font-semibold text-success">{formatCompactCurrency(compareData.a.total_income)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expenses</div>
                    <div className="font-semibold text-destructive">{formatCompactCurrency(compareData.a.total_expenses)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net</div>
                    <div className="font-semibold">{formatCompactCurrency(compareData.a.net)}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">
                  {people.find((p) => p.id === Number(compareB))?.name ?? "B"}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Income</div>
                    <div className="font-semibold text-success">{formatCompactCurrency(compareData.b.total_income)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Expenses</div>
                    <div className="font-semibold text-destructive">{formatCompactCurrency(compareData.b.total_expenses)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Net</div>
                    <div className="font-semibold">{formatCompactCurrency(compareData.b.net)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Choose two different people to compare.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-white via-white to-blue-50 shadow-md">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Snapshot for {selectedMonth === "all" ? "all recorded months" : formatMonthLabel(selectedMonth, "long")}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Net position</p>
              <p
                className={`text-4xl font-bold tracking-tight ${
                  data.net >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatCurrency(data.net)}
              </p>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {topCategory
                  ? `${topCategory.category_name} is your biggest expense category at ${formatCurrency(topCategory.total)}, representing ${(topCategory.share * 100).toFixed(0)}% of classified spending.`
                  : "Upload and classify more transactions to unlock category insights."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Latest month
              </p>
              <p className="mt-2 text-lg font-semibold">
                {latestMonth ? formatMonthLabel(latestMonth.month, "long") : "No data"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestMonth
                  ? `${formatCurrency(latestMonth.expenses)} spent`
                  : "Monthly trends will appear here."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Spending concentration
              </p>
              <p className="mt-2 text-lg font-semibold">
                {(topThreeShare * 100).toFixed(0)}% in top 3
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {expenseCategories.length > 0
                  ? "Useful for spotting over-reliance on a few categories."
                  : "Waiting for expense category data."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Biggest expense month
              </p>
              <p className="mt-2 text-lg font-semibold">
                {biggestExpenseMonth
                  ? formatMonthLabel(biggestExpenseMonth.month, "long")
                  : "No data"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {biggestExpenseMonth
                  ? `${formatCurrency(biggestExpenseMonth.expenses)} total expenses`
                  : "No monthly totals yet."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm text-muted-foreground">
              Total Income
              </CardTitle>
              <p className="mt-2 text-2xl font-bold text-success">
                {formatCurrency(data.total_income)}
              </p>
            </div>
            <div className="rounded-xl bg-success/10 p-2 text-success">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Money coming in during the selected time window.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm text-muted-foreground">
              Total Expenses
              </CardTitle>
              <p className="mt-2 text-2xl font-bold text-destructive">
                {formatCurrency(data.total_expenses)}
              </p>
            </div>
            <div className="rounded-xl bg-destructive/10 p-2 text-destructive">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Total outflow, including all classified and unclassified expenses.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
              <p
                className={`mt-2 text-2xl font-bold ${
                  data.net >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {formatCurrency(data.net)}
              </p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data.net >= 0
                ? "Income is currently outpacing expenses."
                : "Expenses are currently outpacing income."}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm text-muted-foreground">
              Classification
              </CardTitle>
              <p className="mt-2 text-2xl font-bold">
                {classificationRate.toFixed(0)}%
              </p>
            </div>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
              <ChartPie className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {stats.classified} / {stats.total_transactions}
                {" "}transactions categorized
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.unclassified > 0 && (
                  <Badge variant="warning">{stats.unclassified} pending</Badge>
                )}
                {stats.auto_classified > 0 && (
                  <Badge variant="success">{stats.auto_classified} auto</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Monthly Income vs Expenses (last 12 months)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Compare inflow and outflow trends without crowded axis labels.
            </p>
          </CardHeader>
          <CardContent>
            {monthly.length === 0 ? (
              <p className="text-muted-foreground text-sm">No monthly data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={monthly}
                  margin={{ top: 8, right: 16, left: 6, bottom: 20 }}
                  barGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => formatMonthLabel(value)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompactCurrency(value)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) =>
                      typeof label === "string" ? formatMonthLabel(label, "long") : label
                    }
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={10} />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <p className="text-sm text-muted-foreground">
              Category mix with a readable legend instead of clipped outer labels.
            </p>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No classified expenses yet. Upload transactions and classify
                them to see your spending breakdown.
              </p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
                <div className="relative h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseCategories}
                        dataKey="total"
                        nameKey="category_name"
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={112}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {expenseCategories.map((category) => (
                          <Cell
                            key={category.category_id}
                            fill={category.color}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, item) => [
                          formatCurrency(Number(value)),
                          item.payload.category_name,
                        ]}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Classified spend
                    </p>
                    <p className="mt-2 text-2xl font-bold">
                      {formatCurrency(classifiedExpenseTotal)}
                    </p>
                    <p className="mt-1 max-w-[10rem] text-xs text-muted-foreground">
                      {topCategory
                        ? `${topCategory.category_name} leads`
                        : "No category data"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {expenseCategories.slice(0, 6).map((category) => (
                    <div
                      key={category.category_id}
                      className="rounded-2xl border border-border/70 bg-muted/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <p className="truncate font-medium">
                              {category.category_name}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {category.count} transactions
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(category.total)}</p>
                          <p className="text-sm text-muted-foreground">
                            {(category.share * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ranking view with wider spacing so category names stay readable.
            </p>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No data available yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={expenseCategories.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 8, right: 18, left: 18, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatCompactCurrency(value)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="category_name"
                    width={130}
                    tickFormatter={(value) => truncateLabel(value, 18)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
                    }}
                  />
                  <Bar dataKey="total" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Expense Highlights</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick patterns to make the raw numbers easier to act on.
            </p>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Highlights will appear after expenses are categorized.
              </p>
            ) : (
              <div className="space-y-5">
                {expenseCategories.slice(0, 5).map((category) => (
                  <div key={category.category_id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {category.category_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {category.count} transactions
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(category.total)}</p>
                        <p className="text-sm text-muted-foreground">
                          {(category.share * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(category.share * 100, 6)}%`,
                          backgroundColor: category.color,
                        }}
                      />
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl border border-border/70 bg-muted/40 p-4">
                  <p className="text-sm font-medium">Coverage summary</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {stats.unclassified > 0
                      ? `${stats.unclassified} transactions are still uncategorized, so the expense mix may shift as you classify more data.`
                      : "All current transactions are categorized, so the spending breakdown should closely reflect your real mix."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
