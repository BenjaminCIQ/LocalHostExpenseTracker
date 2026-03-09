import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  api,
  type Account,
  type Transaction,
  type TransactionListResponse,
  type Category,
  type SimilarTransactionCandidate,
  type TransactionRaw,
  type SuggestFieldUpdateCandidate,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useSelectedPersonId } from "@/lib/personFilter";

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
                    });
                    await onCategoryCreated(created.id);
                    setSelectedCat(created.id);
                    setShowNewCategory(false);
                    setNewName("");
                    setNewParentId("");
                    setNewIsIncome(false);
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
  const selectedPersonId = useSelectedPersonId();
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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

  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("expense_tracker_filters_open");
      return v === null ? true : v === "true";
    } catch {
      return true;
    }
  });

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

  const [expandedTxnId, setExpandedTxnId] = useState<number | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<TransactionRaw | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [editOpenTxnId, setEditOpenTxnId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCategoryId, setEditCategoryId] = useState<number | "">("");
  const [editMerchant, setEditMerchant] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editRawDescription, setEditRawDescription] = useState<string>("");
  const [editCurrency, setEditCurrency] = useState<string>("EUR");
  const [editSaving, setEditSaving] = useState(false);

  const [applySimilarOpen, setApplySimilarOpen] = useState(false);
  const [applySimilarSeedId, setApplySimilarSeedId] = useState<number | null>(null);
  const [applySimilarCandidates, setApplySimilarCandidates] = useState<SuggestFieldUpdateCandidate[]>([]);
  const [applySimilarSelected, setApplySimilarSelected] = useState<Set<number>>(
    new Set()
  );
  const [applySimilarLoading, setApplySimilarLoading] = useState(false);
  const [applyFieldMerchant, setApplyFieldMerchant] = useState(true);
  const [applyFieldDescription, setApplyFieldDescription] = useState(false);
  const [applyFieldRawDescription, setApplyFieldRawDescription] = useState(false);

  const [saveRuleName, setSaveRuleName] = useState("");
  const [saveRuleOperator, setSaveRuleOperator] = useState<string | null>(null);
  const [saveRuleRegex, setSaveRuleRegex] = useState("");
  const [saveRuleGroup, setSaveRuleGroup] = useState(1);
  const [saveRuleSaving, setSaveRuleSaving] = useState(false);

  function detectOperatorToken(text: string): string | null {
    const t = text.toLowerCase();
    if (t.includes("paypal")) return "PAYPAL";
    if (t.includes("stripe")) return "STRIPE";
    if (t.includes("sumup")) return "SUMUP";
    if (t.includes("square")) return "SQUARE";
    if (t.includes("adyen")) return "ADYEN";
    if (t.includes("klarna")) return "KLARNA";
    if (t.includes("mollie")) return "MOLLIE";
    if (t.includes("worldline")) return "WORLDLINE";
    if (t.includes("nets")) return "NETS";
    if (t.includes("payone")) return "PAYONE";
    return null;
  }

  const [manualOpen, setManualOpen] = useState(false);
  const [manualAccountId, setManualAccountId] = useState<number | null>(null);
  const [manualDate, setManualDate] = useState<string>("");
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualMerchant, setManualMerchant] = useState<string>("");
  const [manualDescription, setManualDescription] = useState<string>("");
  const [manualCurrency, setManualCurrency] = useState<string>("EUR");
  const [manualSaving, setManualSaving] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("expense_tracker_filters_open", String(filtersOpen));
    } catch {
      // ignore
    }
  }, [filtersOpen]);

  const load = useCallback(() => {
    const params: {
      page: number;
      page_size: number;
      person_id?: number;
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
    if (selectedPersonId) params.person_id = selectedPersonId;
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
    selectedPersonId,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    api.getAccounts().then((accs) => {
      setAccounts(accs);
      if (manualAccountId === null && accs.length > 0) setManualAccountId(accs[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const classified =
      filter === "classified" ? true : filter === "unclassified" ? false : undefined;
    api
      .getTransactionBounds({ classified, person_id: selectedPersonId ?? undefined })
      .then((b) => {
        setBounds(b);
        if (!startDate && b.min_date) setStartDate(b.min_date);
        if (!endDate && b.max_date) setEndDate(b.max_date);
        if (minAmount === null && b.min_amount !== null) setMinAmount(b.min_amount);
        if (maxAmount === null && b.max_amount !== null) setMaxAmount(b.max_amount);
      })
      .catch(() => setBounds(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedPersonId]);

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

  const resetFilters = () => {
    setSearchText("");
    setMerchantText("");
    setCategoryFilter("");
    setStartDate(bounds?.min_date ?? "");
    setEndDate(bounds?.max_date ?? "");
    setMinAmount(bounds?.min_amount ?? null);
    setMaxAmount(bounds?.max_amount ?? null);
    setPage(1);
  };

  const activeFilterCount = (() => {
    let n = 0;
    if (searchText.trim()) n += 1;
    if (merchantText.trim()) n += 1;
    if (categoryFilter) n += 1;

    const defaultStart = bounds?.min_date ?? "";
    const defaultEnd = bounds?.max_date ?? "";
    if (startDate && startDate !== defaultStart) n += 1;
    if (endDate && endDate !== defaultEnd) n += 1;

    const minBound = bounds?.min_amount ?? null;
    const maxBound = bounds?.max_amount ?? null;
    if (minBound !== null && minAmount !== null && minAmount !== minBound) n += 1;
    if (maxBound !== null && maxAmount !== null && maxAmount !== maxBound) n += 1;

    return n;
  })();

  const selectedCount = similarSelected.size;
  const selectedTotal = similarCandidates
    .filter((c) => similarSelected.has(c.transaction_id))
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              if (manualAccountId === null && accounts.length > 0) {
                setManualAccountId(accounts[0].id);
              }
              setManualDate(today);
              setManualAmount(0);
              setManualMerchant("");
              setManualDescription("");
              setManualCurrency("EUR");
              setManualOpen(true);
            }}
          >
            Add transaction
          </Button>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle>Filters</CardTitle>
              {activeFilterCount > 0 && !filtersOpen && (
                <Badge variant="secondary">{activeFilterCount} active</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!filtersOpen && activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filtersOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {filtersOpen && (
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
                onClick={resetFilters}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={load}>
                Apply
              </Button>
            </div>
          </div>
          </CardContent>
        )}
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
                  <>
                    <tr
                      key={txn.id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              if (expandedTxnId === txn.id) {
                                setExpandedTxnId(null);
                                setExpandedRaw(null);
                                return;
                              }
                              setExpandedTxnId(txn.id);
                              setExpandedLoading(true);
                              try {
                                const raw = await api.getTransactionRaw(txn.id);
                                setExpandedRaw(raw);
                              } catch {
                                setExpandedRaw(null);
                              } finally {
                                setExpandedLoading(false);
                              }
                            }}
                          >
                            More
                          </Button>
                          <span>{formatDate(txn.date)}</span>
                        </div>
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
                    {expandedTxnId === txn.id && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={5} className="p-3">
                          {expandedLoading ? (
                            <div className="text-sm text-muted-foreground">
                              Loading raw import data...
                            </div>
                          ) : expandedRaw ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Details</div>
                                <div className="flex gap-2">
                                  {editOpenTxnId === txn.id ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={editSaving}
                                        onClick={() => {
                                          setEditOpenTxnId(null);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={editSaving || applySimilarLoading}
                                        onClick={async () => {
                                          setApplySimilarLoading(true);
                                          try {
                                            // Save current edits first, so suggestions use the corrected seed fields.
                                            await api.updateTransaction(txn.id, {
                                              date: editDate,
                                              amount: editAmount,
                                              merchant: editMerchant,
                                              description: editDescription,
                                              raw_description: editRawDescription,
                                              currency: editCurrency,
                                            });

                                            const candidates = await api.suggestFieldUpdates(txn.id, {
                                              limit: 50,
                                              min_score: 85,
                                              only_unclassified: false,
                                            });

                                            const op = detectOperatorToken(
                                              `${editMerchant} ${editRawDescription} ${editDescription}`
                                            );
                                            setSaveRuleOperator(op);
                                            setSaveRuleName(
                                              op ? `${op} merchant extract` : "Merchant extract"
                                            );
                                            setSaveRuleGroup(1);
                                            setSaveRuleRegex(
                                              op ? `${op.toLowerCase()}\\s*\\*\\s*([^/|]+)` : ""
                                            );

                                            setApplySimilarSeedId(txn.id);
                                            setApplySimilarCandidates(candidates);
                                            setApplySimilarSelected(
                                              new Set(candidates.map((c) => c.transaction_id))
                                            );
                                            setApplySimilarOpen(candidates.length > 0);
                                            load();
                                          } catch (e) {
                                            setError(
                                              e instanceof Error
                                                ? e.message
                                                : "Failed to fetch suggestions"
                                            );
                                          } finally {
                                            setApplySimilarLoading(false);
                                          }
                                        }}
                                      >
                                        Apply to similar...
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={editSaving || !editDate || !editDescription.trim()}
                                        onClick={async () => {
                                          setEditSaving(true);
                                          try {
                                            await api.updateTransaction(txn.id, {
                                              date: editDate,
                                              amount: editAmount,
                                              merchant: editMerchant,
                                              description: editDescription,
                                              raw_description: editRawDescription,
                                              currency: editCurrency,
                                            });
                                            if (editCategoryId) {
                                              await api.classifyTransaction(txn.id, {
                                                category_id: editCategoryId,
                                                merchant: editMerchant || undefined,
                                              });
                                            }
                                            setEditOpenTxnId(null);
                                            load();
                                          } catch (e) {
                                            setError(
                                              e instanceof Error
                                                ? e.message
                                                : "Failed to update transaction"
                                            );
                                          } finally {
                                            setEditSaving(false);
                                          }
                                        }}
                                      >
                                        Save
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditOpenTxnId(txn.id);
                                        setEditDate(txn.date);
                                        setEditAmount(txn.amount);
                                        setEditCategoryId(
                                          txn.final_category_id ??
                                            txn.predicted_category_id ??
                                            ""
                                        );
                                        setEditMerchant(txn.merchant ?? "");
                                        setEditDescription(txn.description ?? "");
                                        setEditRawDescription(txn.raw_description ?? "");
                                        setEditCurrency((txn.currency ?? "EUR").toUpperCase());
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {editOpenTxnId === txn.id && (
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div>
                                    <label className="text-xs text-muted-foreground">Date</label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      type="date"
                                      value={editDate}
                                      onChange={(e) => setEditDate(e.target.value)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Amount</label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      type="number"
                                      step="0.01"
                                      value={editAmount}
                                      onChange={(e) => setEditAmount(Number(e.target.value))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">
                                      Currency
                                    </label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      value={editCurrency}
                                      onChange={(e) =>
                                        setEditCurrency(e.target.value.toUpperCase())
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <label className="text-xs text-muted-foreground">
                                      Category
                                    </label>
                                    <Select
                                      className="mt-1"
                                      value={editCategoryId}
                                      onChange={(e) =>
                                        setEditCategoryId(Number(e.target.value) || "")
                                      }
                                    >
                                      <option value="">(no change)</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.parent_id ? "\u00A0\u00A0" : ""}
                                          {c.name}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div className="md:col-span-1">
                                    <label className="text-xs text-muted-foreground">
                                      Merchant
                                    </label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      value={editMerchant}
                                      onChange={(e) => setEditMerchant(e.target.value)}
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <label className="text-xs text-muted-foreground">
                                      Description
                                    </label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      value={editDescription}
                                      onChange={(e) => setEditDescription(e.target.value)}
                                    />
                                  </div>
                                  <div className="md:col-span-3">
                                    <label className="text-xs text-muted-foreground">
                                      Raw description
                                    </label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      value={editRawDescription}
                                      onChange={(e) =>
                                        setEditRawDescription(e.target.value)
                                      }
                                    />
                                  </div>
                                </div>
                              )}

                              {expandedRaw.raw_row_line && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Raw line
                                  </div>
                                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background p-3">
                                    {expandedRaw.raw_row_line}
                                  </pre>
                                </div>
                              )}
                              {expandedRaw.raw_row_json && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">
                                    Raw row (JSON)
                                  </div>
                                  <pre className="text-xs whitespace-pre-wrap rounded-md border border-border bg-background p-3">
                                    {(() => {
                                      try {
                                        return JSON.stringify(
                                          JSON.parse(expandedRaw.raw_row_json),
                                          null,
                                          2
                                        );
                                      } catch {
                                        return expandedRaw.raw_row_json;
                                      }
                                    })()}
                                  </pre>
                                </div>
                              )}
                              {!expandedRaw.raw_row_json && !expandedRaw.raw_row_line && (
                                <div className="text-sm text-muted-foreground">
                                  No raw import data stored for this transaction.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No raw import data available.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
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

      {manualOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Add transaction</div>
                <div className="text-sm text-muted-foreground">
                  Manually add a transaction (not from an import).
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setManualOpen(false);
                }}
              >
                Close
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm text-muted-foreground">Account</label>
                  <Select
                    className="mt-1"
                    value={manualAccountId ?? ""}
                    onChange={(e) => setManualAccountId(Number(e.target.value) || null)}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Date</label>
                  <input
                    className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Amount</label>
                  <input
                    className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    type="number"
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Merchant</label>
                  <input
                    className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={manualMerchant}
                    onChange={(e) => setManualMerchant(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Currency</label>
                  <input
                    className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value.toUpperCase())}
                    placeholder="EUR"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-muted-foreground">Description</label>
                  <input
                    className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="e.g. Cash withdrawal"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setManualOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={
                    manualSaving ||
                    manualAccountId === null ||
                    !manualDate ||
                    !manualDescription.trim() ||
                    Number.isNaN(manualAmount)
                  }
                  onClick={async () => {
                    setManualSaving(true);
                    try {
                      await api.createManualTransaction({
                        account_id: manualAccountId!,
                        date: manualDate,
                        amount: manualAmount,
                        description: manualDescription.trim(),
                        merchant: manualMerchant.trim() || null,
                        currency: manualCurrency.trim() || "EUR",
                      });
                      setManualOpen(false);
                      load();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Failed to create transaction"
                      );
                    } finally {
                      setManualSaving(false);
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {applySimilarOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl mx-4">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Apply edits to similar</div>
                <div className="text-sm text-muted-foreground">
                  Review matches and bulk-apply the selected field updates.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setApplySimilarOpen(false);
                  setApplySimilarCandidates([]);
                  setApplySimilarSelected(new Set());
                }}
              >
                Close
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyFieldMerchant}
                      onChange={(e) => setApplyFieldMerchant(e.target.checked)}
                    />
                    Merchant
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyFieldDescription}
                      onChange={(e) => setApplyFieldDescription(e.target.checked)}
                    />
                    Description
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={applyFieldRawDescription}
                      onChange={(e) => setApplyFieldRawDescription(e.target.checked)}
                    />
                    Raw description
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setApplySimilarSelected(
                        new Set(applySimilarCandidates.map((c) => c.transaction_id))
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setApplySimilarSelected(new Set())}
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
                      <th className="p-2 text-left">Merchant</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applySimilarCandidates.map((c) => (
                      <tr key={c.transaction_id} className="border-b">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={applySimilarSelected.has(c.transaction_id)}
                            onChange={(e) => {
                              setApplySimilarSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(c.transaction_id);
                                else next.delete(c.transaction_id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{c.current_merchant}</td>
                        <td className="p-2 max-w-md truncate" title={c.current_description}>
                          {c.current_description}
                        </td>
                        <td className="p-2 text-right font-mono">{c.score.toFixed(0)}</td>
                      </tr>
                    ))}
                    {applySimilarCandidates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          No candidates found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  disabled={
                    applySimilarSelected.size === 0 ||
                    (!applyFieldMerchant && !applyFieldDescription && !applyFieldRawDescription) ||
                    applySimilarLoading ||
                    applySimilarSeedId === null ||
                    applySimilarCandidates.length === 0
                  }
                  onClick={async () => {
                    if (applySimilarSeedId === null) return;
                    const seed = applySimilarCandidates[0];
                    const payload: {
                      transaction_ids: number[];
                      merchant?: string | null;
                      description?: string | null;
                      raw_description?: string | null;
                      re_predict?: boolean;
                    } = {
                      transaction_ids: Array.from(applySimilarSelected),
                      re_predict: true,
                    };
                    if (applyFieldMerchant && seed?.suggested_merchant)
                      payload.merchant = seed.suggested_merchant;
                    if (applyFieldDescription && seed?.suggested_description)
                      payload.description = seed.suggested_description;
                    if (applyFieldRawDescription && seed?.suggested_raw_description)
                      payload.raw_description = seed.suggested_raw_description;

                    setApplySimilarLoading(true);
                    try {
                      await api.bulkUpdateFields(payload);
                      setApplySimilarOpen(false);
                      setApplySimilarCandidates([]);
                      setApplySimilarSelected(new Set());
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Bulk update failed");
                    } finally {
                      setApplySimilarLoading(false);
                    }
                  }}
                >
                  Apply to selected
                </Button>
              </div>
              <div className="border border-border rounded-md p-3 space-y-2">
                <div className="text-sm font-medium">Save as parsing rule (optional)</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className="border border-border rounded px-2 py-1 bg-background text-sm"
                    placeholder="Rule name"
                    value={saveRuleName}
                    onChange={(e) => setSaveRuleName(e.target.value)}
                  />
                  <input
                    className="border border-border rounded px-2 py-1 bg-background text-sm"
                    placeholder="Operator token (optional)"
                    value={saveRuleOperator ?? ""}
                    onChange={(e) => setSaveRuleOperator(e.target.value || null)}
                  />
                  <input
                    className="border border-border rounded px-2 py-1 bg-background text-sm"
                    placeholder="Merchant group (default 1)"
                    type="number"
                    value={saveRuleGroup}
                    onChange={(e) => setSaveRuleGroup(Number(e.target.value || 1))}
                    min={1}
                  />
                </div>
                <input
                  className="border border-border rounded px-2 py-1 bg-background text-sm w-full"
                  placeholder="Regex with capture group for merchant"
                  value={saveRuleRegex}
                  onChange={(e) => setSaveRuleRegex(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    disabled={
                      saveRuleSaving || !saveRuleName.trim() || !saveRuleRegex.trim()
                    }
                    onClick={async () => {
                      setSaveRuleSaving(true);
                      try {
                        await api.createParsingRule({
                          name: saveRuleName.trim(),
                          enabled: true,
                          priority: 100,
                          operator_token: saveRuleOperator,
                          match_regex: saveRuleRegex,
                          merchant_group: saveRuleGroup,
                        });
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed to save rule");
                      } finally {
                        setSaveRuleSaving(false);
                      }
                    }}
                  >
                    Save rule
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Rules apply on future imports (and can be managed via the API).
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
