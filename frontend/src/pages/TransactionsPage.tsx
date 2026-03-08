import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import {
  api,
  type Transaction,
  type TransactionListResponse,
  type Category,
  type SimilarTransactionCandidate,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categoryIcons";

type FilterMode = "all" | "unclassified" | "classified";

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  if (confidence >= 0.85)
    return <Badge variant="success">{(confidence * 100).toFixed(0)}%</Badge>;
  if (confidence >= 0.5)
    return <Badge variant="warning">{(confidence * 100).toFixed(0)}%</Badge>;
  return <Badge variant="secondary">{(confidence * 100).toFixed(0)}%</Badge>;
}

function ClassifyCell({
  transaction,
  categories,
  onClassify,
  onCategoryCreated,
  onError,
}: {
  transaction: Transaction;
  categories: Category[];
  onClassify: (txnId: number, categoryId: number, merchant?: string) => void;
  onCategoryCreated: (newCategoryId: number) => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<number | "">(
    transaction.predicted_category_id ?? ""
  );
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<number | "">("");
  const [newIsIncome, setNewIsIncome] = useState(false);
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [creating, setCreating] = useState(false);

  if (transaction.final_category_id) {
    const Icon = getCategoryIcon(transaction.final_category_name);
    return (
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Badge variant="default">{transaction.final_category_name}</Badge>
        <span className="text-xs text-muted-foreground">
          ({transaction.classification_source})
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {transaction.predicted_category_name && (
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" />
          {(() => {
            const Icon = getCategoryIcon(transaction.predicted_category_name);
            return <Icon className="h-4 w-4 text-muted-foreground" />;
          })()}
          <span className="text-xs text-muted-foreground">
            Suggestion: {transaction.predicted_category_name}
          </span>
          <ConfidenceBadge confidence={transaction.confidence} />
        </div>
      )}
      <Select
        value={selectedCat}
        onChange={(e) => setSelectedCat(Number(e.target.value) || "")}
        className="w-40"
      >
        <option value="">Select...</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.parent_id ? "\u00A0\u00A0" : ""}
            {c.name}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowNewCategory((s) => !s)}
      >
        New
      </Button>
      <Button
        size="sm"
        disabled={!selectedCat}
        onClick={() => {
          if (selectedCat) onClassify(transaction.id, selectedCat);
        }}
      >
        Assign
      </Button>
      {transaction.predicted_category_id && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onClassify(transaction.id, transaction.predicted_category_id!)
          }
        >
          Accept
        </Button>
      )}

      {showNewCategory && (
        <div className="w-full mt-2 p-3 rounded-md border border-border bg-background">
          <div className="grid gap-2 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Pets"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Parent</label>
              <Select
                className="mt-1"
                value={newParentId}
                onChange={(e) => setNewParentId(Number(e.target.value) || "")}
              >
                <option value="">(none)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? "  " : ""}
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sort</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={newIsIncome}
                  onChange={(e) => setNewIsIncome(e.target.checked)}
                />
                Income
              </label>
              <Button
                size="sm"
                disabled={!newName.trim() || creating}
                onClick={async () => {
                  setCreating(true);
                  try {
                    const created = await api.createCategory({
                      name: newName.trim(),
                      parent_id: newParentId ? Number(newParentId) : null,
                      is_income: newIsIncome,
                      sort_order: newSortOrder,
                    });
                    await onCategoryCreated(created.id);
                    setSelectedCat(created.id);
                    setShowNewCategory(false);
                    setNewName("");
                    setNewParentId("");
                    setNewIsIncome(false);
                    setNewSortOrder(0);
                  } catch (e) {
                    onError(e instanceof Error ? e.message : "Failed to create category");
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState<{
    min_date: string | null;
    max_date: string | null;
    min_amount: number | null;
    max_amount: number | null;
  } | null>(null);

  const [searchText, setSearchText] = useState("");
  const [merchantText, setMerchantText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState<number | null>(null);
  const [maxAmount, setMaxAmount] = useState<number | null>(null);
  const hasAmountBounds =
    bounds !== null && bounds.min_amount !== null && bounds.max_amount !== null;

  const [similarOpen, setSimilarOpen] = useState(false);
  const [similarSeedId, setSimilarSeedId] = useState<number | null>(null);
  const [similarCategoryId, setSimilarCategoryId] = useState<number | null>(null);
  const [similarCandidates, setSimilarCandidates] = useState<
    SimilarTransactionCandidate[]
  >([]);
  const [similarSelected, setSimilarSelected] = useState<Set<number>>(
    new Set()
  );
  const [similarLoading, setSimilarLoading] = useState(false);

  const load = useCallback(() => {
    const params: {
      page: number;
      page_size: number;
      classified?: boolean;
      q?: string;
      merchant?: string;
      category_id?: number;
      start_date?: string;
      end_date?: string;
      min_amount?: number;
      max_amount?: number;
    } = {
      page,
      page_size: 50,
    };
    if (filter === "classified") params.classified = true;
    if (filter === "unclassified") params.classified = false;
    if (searchText.trim()) params.q = searchText.trim();
    if (merchantText.trim()) params.merchant = merchantText.trim();
    if (categoryFilter) params.category_id = Number(categoryFilter);
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (minAmount !== null) params.min_amount = minAmount;
    if (maxAmount !== null) params.max_amount = maxAmount;
    api.getTransactions(params).then(setData).catch((e) => setError(e.message));
  }, [
    page,
    filter,
    searchText,
    merchantText,
    categoryFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    const classified =
      filter === "classified" ? true : filter === "unclassified" ? false : undefined;
    api
      .getTransactionBounds({ classified })
      .then((b) => {
        setBounds(b);
        if (!startDate && b.min_date) setStartDate(b.min_date);
        if (!endDate && b.max_date) setEndDate(b.max_date);
        if (minAmount === null && b.min_amount !== null) setMinAmount(b.min_amount);
        if (maxAmount === null && b.max_amount !== null) setMaxAmount(b.max_amount);
      })
      .catch(() => setBounds(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const refreshCategories = async () => {
    const cats = await api.getCategories();
    setCategories(cats);
  };

  const handleClassify = async (
    txnId: number,
    categoryId: number,
    merchant?: string
  ) => {
    try {
      await api.classifyTransaction(txnId, {
        category_id: categoryId,
        merchant,
      });
      load();

      setSimilarLoading(true);
      try {
        const candidates = await api.getSimilarTransactions(txnId, {
          limit: 25,
          min_score: 80,
        });
        setSimilarSeedId(txnId);
        setSimilarCategoryId(categoryId);
        setSimilarCandidates(candidates);
        setSimilarSelected(new Set(candidates.map((c) => c.transaction_id)));
        setSimilarOpen(candidates.length > 0);
      } finally {
        setSimilarLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classification failed");
    }
  };

  const handleClassifyAll = async () => {
    try {
      const result = await api.classifyAll();
      setError("");
      alert(`Pipeline ran on ${result.processed} transactions`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Classify all failed");
    }
  };

  if (error) return <p className="text-destructive">{error}</p>;

  const selectedCount = similarSelected.size;
  const selectedTotal = similarCandidates
    .filter((c) => similarSelected.has(c.transaction_id))
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClassifyAll}>
            <Sparkles className="h-4 w-4" />
            Run ML on Unclassified
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(["all", "unclassified", "classified"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        {data && (
          <span className="text-sm text-muted-foreground self-center ml-2">
            {data.total} transactions
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Search</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPage(1);
                }}
                placeholder="merchant/description…"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Store (merchant)</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={merchantText}
                onChange={(e) => {
                  setMerchantText(e.target.value);
                  setPage(1);
                }}
                placeholder="REWE, Spotify…"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Category</label>
              <Select
                className="mt-1"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(Number(e.target.value) || "");
                  setPage(1);
                }}
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? "  " : ""}
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Start date</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">End date</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="md:col-span-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Amount range</label>
                <span className="text-xs text-muted-foreground font-mono">
                  {minAmount ?? "-"} → {maxAmount ?? "-"}
                </span>
              </div>
              {hasAmountBounds ? (
                <div className="grid gap-2 md:grid-cols-2 mt-2">
                  <div>
                    <input
                      type="range"
                      min={bounds!.min_amount!}
                      max={bounds!.max_amount!}
                      step={0.01}
                      value={minAmount ?? bounds!.min_amount!}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMinAmount(v);
                        if (maxAmount !== null && v > maxAmount) setMaxAmount(v);
                        setPage(1);
                      }}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground mt-1">Min</div>
                  </div>
                  <div>
                    <input
                      type="range"
                      min={bounds!.min_amount!}
                      max={bounds!.max_amount!}
                      step={0.01}
                      value={maxAmount ?? bounds!.max_amount!}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMaxAmount(v);
                        if (minAmount !== null && v < minAmount) setMinAmount(v);
                        setPage(1);
                      }}
                      className="w-full"
                    />
                    <div className="text-xs text-muted-foreground mt-1">Max</div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Upload transactions to enable amount sliders.
                </p>
              )}
            </div>

            <div className="md:col-span-6 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchText("");
                  setMerchantText("");
                  setCategoryFilter("");
                  setStartDate(bounds?.min_date ?? "");
                  setEndDate(bounds?.max_date ?? "");
                  setMinAmount(bounds?.min_amount ?? null);
                  setMaxAmount(bounds?.max_amount ?? null);
                  setPage(1);
                }}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={load}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Merchant</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-left p-3 font-medium">Category</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(txn.date)}
                    </td>
                    <td className="p-3 max-w-xs truncate" title={txn.raw_description}>
                      {txn.description}
                    </td>
                    <td className="p-3 whitespace-nowrap">{txn.merchant}</td>
                    <td
                      className={`p-3 text-right whitespace-nowrap font-mono ${
                        txn.amount >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="p-3">
                      <ClassifyCell
                        transaction={txn}
                        categories={categories}
                        onClassify={handleClassify}
                        onCategoryCreated={async (_newId) => {
                          await refreshCategories();
                        }}
                        onError={(msg) => setError(msg)}
                      />
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-muted-foreground"
                    >
                      No transactions found. Upload a bank statement to get
                      started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {data.total_pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {similarOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl mx-4">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Similar transactions</div>
                <div className="text-sm text-muted-foreground">
                  Suggested based on merchant + text similarity. Select transactions to bulk-apply the same category.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSimilarOpen(false);
                  setSimilarCandidates([]);
                  setSimilarSelected(new Set());
                }}
              >
                Close
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Selected: <span className="font-mono">{selectedCount}</span> · Total amount:{" "}
                  <span className="font-mono">{formatCurrency(selectedTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSimilarSelected(
                        new Set(similarCandidates.map((c) => c.transaction_id))
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSimilarSelected(new Set())}
                  >
                    Select none
                  </Button>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-auto border border-border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Apply</th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Merchant</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {similarCandidates.map((c) => (
                      <tr key={c.transaction_id} className="border-b">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={similarSelected.has(c.transaction_id)}
                            onChange={(e) => {
                              setSimilarSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.transaction_id);
                                else next.delete(c.transaction_id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{formatDate(c.date)}</td>
                        <td className="p-2 whitespace-nowrap">{c.merchant}</td>
                        <td className="p-2 max-w-xs truncate" title={c.description}>
                          {c.description}
                        </td>
                        <td
                          className={`p-2 text-right whitespace-nowrap font-mono ${
                            c.amount >= 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(c.amount)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {c.score.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                    {similarCandidates.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No similar transactions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={similarLoading}
                  onClick={async () => {
                    if (!similarSeedId || !similarCategoryId) return;
                    setSimilarLoading(true);
                    try {
                      await api.getSimilarTransactions(similarSeedId, {
                        limit: 25,
                        min_score: 80,
                      }).then((cands) => {
                        setSimilarCandidates(cands);
                        setSimilarSelected(
                          new Set(cands.map((c) => c.transaction_id))
                        );
                      });
                    } finally {
                      setSimilarLoading(false);
                    }
                  }}
                >
                  Refresh
                </Button>
                <Button
                  disabled={selectedCount === 0 || similarLoading || !similarCategoryId}
                  onClick={async () => {
                    if (!similarCategoryId) return;
                    setSimilarLoading(true);
                    try {
                      await api.bulkClassify({
                        transaction_ids: Array.from(similarSelected),
                        category_id: similarCategoryId,
                      });
                      setSimilarOpen(false);
                      setSimilarCandidates([]);
                      setSimilarSelected(new Set());
                      load();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Bulk classify failed"
                      );
                    } finally {
                      setSimilarLoading(false);
                    }
                  }}
                >
                  Apply to selected
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
