import { Fragment, useEffect, useState, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import CategorySelect from "@/components/category/CategorySelect";
import CategoryMultiDropdown from "@/components/category/CategoryMultiDropdown";
import { Tabs } from "@/components/ui/tabs";
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
  type Trip,
  type SimilarTransactionCandidate,
  type TransactionRaw,
  type SuggestFieldUpdateCandidate,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useSelectedPersonId } from "@/lib/personFilter";
import TransferReviewPage from "@/pages/TransferReviewPage";

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
      <CategorySelect
        categories={categories}
        value={selectedCat}
        onChange={(value) => setSelectedCat(typeof value === "number" ? value : "")}
        className="w-40"
        placeholder="Select..."
        mode="path"
      />
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
              <CategorySelect
                className="mt-1"
                categories={categories}
                value={newParentId}
                placeholder="(none)"
                mode="path"
                onChange={(value) => setNewParentId(typeof value === "number" ? value : "")}
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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPersonId = useSelectedPersonId();
  const activeTab = searchParams.get("tab") === "transfers" ? "transfers" : "transactions";
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortBy, setSortBy] = useState<"date" | "amount" | "merchant" | "description" | "category">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");
  const [bounds, setBounds] = useState<{
    min_date: string | null;
    max_date: string | null;
    min_amount: number | null;
    max_amount: number | null;
  } | null>(null);

  const [searchText, setSearchText] = useState("");
  const [merchantText, setMerchantText] = useState("");
  const [categoryFilterIds, setCategoryFilterIds] = useState<number[]>([]);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const [transactionKindFilter, setTransactionKindFilter] = useState<
    "" | "income" | "expense" | "transfer" | "adjustment"
  >("");
  const [includeTransfers, setIncludeTransfers] = useState(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [tripFilterId, setTripFilterId] = useState<number | "">("");
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
  const [editMerchantSuggestions, setEditMerchantSuggestions] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const [applySimilarOpen, setApplySimilarOpen] = useState(false);
  const [applySimilarSeedId, setApplySimilarSeedId] = useState<number | null>(null);
  const [applySimilarCandidates, setApplySimilarCandidates] = useState<SuggestFieldUpdateCandidate[]>([]);
  const [applySimilarSelected, setApplySimilarSelected] = useState<Set<number>>(
    new Set()
  );
  const [applySimilarSeedValues, setApplySimilarSeedValues] = useState<{
    merchant: string;
    description: string;
    raw_description: string;
  }>({ merchant: "", description: "", raw_description: "" });
  const [applySimilarLoading, setApplySimilarLoading] = useState(false);
  const [applySimilarInfo, setApplySimilarInfo] = useState<string>("");
  const [applySimilarMinScore, setApplySimilarMinScore] = useState<number>(85);
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
  const [manualMerchantSuggestions, setManualMerchantSuggestions] = useState<string[]>([]);
  const [manualDescription, setManualDescription] = useState<string>("");
  const [manualCurrency, setManualCurrency] = useState<string>("EUR");
  const [manualSaving, setManualSaving] = useState(false);
  const [linkSourceTxnId, setLinkSourceTxnId] = useState<number | null>(null);
  const [linkDropTargetTxnId, setLinkDropTargetTxnId] = useState<number | null>(null);

  const selectedCategoryNames = useMemo(
    () =>
      categories
        .filter((c) => categoryFilterIds.includes(c.id))
        .map((c) => c.name),
    [categories, categoryFilterIds]
  );

  function buildTransferLinkWarnings(source: Transaction, target: Transaction): string[] {
    const warnings: string[] = [];
    if (source.account_id === target.account_id) {
      warnings.push("Both transactions are in the same account.");
    }
    if (source.currency !== target.currency) {
      warnings.push("Currencies do not match.");
    }
    if (source.amount === 0 || target.amount === 0 || source.amount * target.amount > 0) {
      warnings.push("Amounts are not opposite-sign inflow/outflow.");
    }
    const amountDelta = Math.abs(Math.abs(source.amount) - Math.abs(target.amount));
    if (amountDelta > 0.01) {
      warnings.push(`Absolute amounts differ by ${formatCurrency(amountDelta)}.`);
    }
    const dayDelta = Math.abs(
      (new Date(source.date).getTime() - new Date(target.date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (dayDelta > 3) {
      warnings.push(`Dates are ${Math.round(dayDelta)} days apart.`);
    }
    return warnings;
  }

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
      category_ids?: number[];
      start_date?: string;
      end_date?: string;
      min_amount?: number;
      max_amount?: number;
      transaction_kind?: "income" | "expense" | "transfer" | "adjustment";
      trip_id?: number;
      include_transfers?: boolean;
      sort_by?: "date" | "amount" | "merchant" | "description" | "category";
      sort_dir?: "asc" | "desc";
    } = {
      page,
      page_size: 50,
    };
    if (selectedPersonId) params.person_id = selectedPersonId;
    if (filter === "classified") params.classified = true;
    if (filter === "unclassified") params.classified = false;
    if (searchText.trim()) params.q = searchText.trim();
    if (merchantText.trim()) params.merchant = merchantText.trim();
    if (categoryFilterIds.length === 1) params.category_id = categoryFilterIds[0];
    if (categoryFilterIds.length > 1) params.category_ids = categoryFilterIds;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (tripFilterId) params.trip_id = Number(tripFilterId);
    if (minAmount !== null) params.min_amount = minAmount;
    if (maxAmount !== null) params.max_amount = maxAmount;
    if (transactionKindFilter) params.transaction_kind = transactionKindFilter;
    params.include_transfers = includeTransfers;
    params.sort_by = sortBy;
    params.sort_dir = sortDir;
    api.getTransactions(params).then(setData).catch((e) => setError(e.message));
  }, [
    page,
    filter,
    searchText,
    merchantText,
    categoryFilterIds,
    startDate,
    endDate,
    tripFilterId,
    minAmount,
    maxAmount,
    transactionKindFilter,
    includeTransfers,
    sortBy,
    sortDir,
    selectedPersonId,
  ]);

  const linkByDrop = useCallback(
    async (targetTxn: Transaction) => {
      if (!data || linkSourceTxnId === null || linkSourceTxnId === targetTxn.id) return;
      const sourceTxn = data.items.find((item) => item.id === linkSourceTxnId);
      if (!sourceTxn) return;
      const warnings = buildTransferLinkWarnings(sourceTxn, targetTxn);
      const title = `Link transfer: #${sourceTxn.id} -> #${targetTxn.id}`;
      const warningBlock = warnings.length
        ? `\n\nWarnings:\n- ${warnings.join("\n- ")}\n\nContinue anyway?`
        : "\n\nChecks passed (date/value alignment looks good). Continue?";
      const confirmed = window.confirm(`${title}${warningBlock}`);
      if (!confirmed) return;
      try {
        await api.linkTransferPair(sourceTxn.id, targetTxn.id);
        setLinkSourceTxnId(null);
        setLinkDropTargetTxnId(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to link transfer");
      }
    },
    [data, linkSourceTxnId, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(() => setTrips([]));
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

  useEffect(() => {
    if (editOpenTxnId === null) {
      setEditMerchantSuggestions([]);
      return;
    }
    const q = editMerchant.trim();
    if (!q) {
      setEditMerchantSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .getMerchantSuggestions(q, 12)
        .then((items) => setEditMerchantSuggestions(items))
        .catch(() => setEditMerchantSuggestions([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [editMerchant, editOpenTxnId]);

  useEffect(() => {
    if (!manualOpen) {
      setManualMerchantSuggestions([]);
      return;
    }
    const q = manualMerchant.trim();
    if (!q) {
      setManualMerchantSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .getMerchantSuggestions(q, 12)
        .then((items) => setManualMerchantSuggestions(items))
        .catch(() => setManualMerchantSuggestions([]));
    }, 150);
    return () => clearTimeout(timer);
  }, [manualMerchant, manualOpen]);

  const loadApplySimilarCandidates = useCallback(
    async (seedId: number, minScore: number) => {
      setApplySimilarLoading(true);
      try {
        const candidates = await api.suggestFieldUpdates(seedId, {
          limit: 50,
          min_score: minScore,
          only_unclassified: false,
          exclude_already_matching: true,
        });
        setApplySimilarCandidates(candidates);
        setApplySimilarSelected(new Set(candidates.map((c) => c.transaction_id)));
        setApplySimilarInfo(
          candidates.length
            ? `Found ${candidates.length} match(es) at threshold >= ${minScore}.`
            : `No similar transactions found at threshold >= ${minScore}. Try lowering the threshold.`
        );
      } finally {
        setApplySimilarLoading(false);
      }
    },
    []
  );

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

  const toggleSort = (
    next: "date" | "amount" | "merchant" | "description" | "category"
  ) => {
    if (sortBy === next) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(next);
      setSortDir(next === "date" ? "desc" : "asc");
    }
    setPage(1);
  };

  if (error) return <p className="text-destructive">{error}</p>;

  const resetFilters = () => {
    setSearchText("");
    setMerchantText("");
    setCategoryFilterIds([]);
    setCategoryFilterSearch("");
    setTransactionKindFilter("");
    setIncludeTransfers(true);
    setStartDate(bounds?.min_date ?? "");
    setEndDate(bounds?.max_date ?? "");
    setTripFilterId("");
    setMinAmount(bounds?.min_amount ?? null);
    setMaxAmount(bounds?.max_amount ?? null);
    setPage(1);
  };

  const activeFilterCount = (() => {
    let n = 0;
    if (searchText.trim()) n += 1;
    if (merchantText.trim()) n += 1;
    if (categoryFilterIds.length) n += 1;
    if (transactionKindFilter) n += 1;
    if (!includeTransfers) n += 1;

    const defaultStart = bounds?.min_date ?? "";
    const defaultEnd = bounds?.max_date ?? "";
    if (startDate && startDate !== defaultStart) n += 1;
    if (endDate && endDate !== defaultEnd) n += 1;
    if (tripFilterId) n += 1;

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

  if (activeTab === "transfers") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onChange={(next) => setSearchParams(next === "transfers" ? { tab: "transfers" } : {})}
            options={[
              { value: "transactions", label: "Transactions" },
              { value: "transfers", label: "Transfer Review" },
            ]}
          />
          <Link to="/import">
            <Button variant="outline">Import Data</Button>
          </Link>
        </div>
        <TransferReviewPage embedded />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={(next) => setSearchParams(next === "transfers" ? { tab: "transfers" } : {})}
          options={[
            { value: "transactions", label: "Transactions" },
            { value: "transfers", label: "Transfer Review" },
          ]}
        />
        <Link to="/import">
          <Button variant="outline">Import Data</Button>
        </Link>
      </div>

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
              {!filtersOpen && selectedCategoryNames.length > 0 && (
                <>
                  {selectedCategoryNames.slice(0, 2).map((name, idx) => (
                    <Badge key={`${name}-${idx}`} variant="outline">{name}</Badge>
                  ))}
                  {selectedCategoryNames.length > 2 && (
                    <Badge variant="outline">+{selectedCategoryNames.length - 2}</Badge>
                  )}
                </>
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
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Category</label>
              <CategoryMultiDropdown
                categories={categories}
                selectedIds={categoryFilterIds}
                search={categoryFilterSearch}
                onSearchChange={setCategoryFilterSearch}
                onChange={(ids) => {
                  setCategoryFilterIds(ids);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Kind</label>
              <Select
                className="mt-1"
                value={transactionKindFilter}
                onChange={(e) => {
                  setTransactionKindFilter(
                    (e.target.value as "income" | "expense" | "transfer" | "adjustment" | "") ?? ""
                  );
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="adjustment">Adjustment</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="include-transfers-filter"
                type="checkbox"
                checked={includeTransfers}
                onChange={(e) => {
                  setIncludeTransfers(e.target.checked);
                  setPage(1);
                }}
              />
              <label htmlFor="include-transfers-filter" className="text-sm text-muted-foreground">
                Include transfers
              </label>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Trip window</label>
              <Select
                className="mt-1"
                value={tripFilterId}
                onChange={(e) => {
                  const raw = e.target.value;
                  setTripFilterId(raw ? Number(raw) : "");
                  setPage(1);
                }}
              >
                <option value="">All trips</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name} ({trip.start_date} {"->"} {trip.end_date})
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
          {linkSourceTxnId !== null && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-3 py-2 text-sm">
              <span>
                Drag transaction <span className="font-mono">#{linkSourceTxnId}</span> onto its counterpart row to link.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLinkSourceTxnId(null);
                  setLinkDropTargetTxnId(null);
                }}
              >
                Cancel link mode
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-44 text-left p-3 font-medium">
                    <button onClick={() => toggleSort("date")}>Date {sortBy === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => toggleSort("description")}>
                        Description {sortBy === "description" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                      <span className="text-muted-foreground">/</span>
                      <button onClick={() => toggleSort("merchant")}>
                        Merchant {sortBy === "merchant" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </div>
                  </th>
                  <th className="w-36 text-right p-3 font-medium">
                    <button onClick={() => toggleSort("amount")}>Amount {sortBy === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button>
                  </th>
                  <th className="w-[28rem] text-left p-3 font-medium">
                    <button onClick={() => toggleSort("category")}>Category {sortBy === "category" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((txn) => {
                  const isLinkSource = linkSourceTxnId === txn.id;
                  const isLinkDropTarget = linkDropTargetTxnId === txn.id;
                  return (
                  <Fragment key={txn.id}>
                    <tr
                      draggable={isLinkSource}
                      onDragStart={(e) => {
                        if (!isLinkSource) return;
                        e.dataTransfer.setData("text/plain", String(txn.id));
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setLinkDropTargetTxnId(null)}
                      onDragOver={(e) => {
                        if (linkSourceTxnId === null || isLinkSource) return;
                        e.preventDefault();
                        setLinkDropTargetTxnId(txn.id);
                      }}
                      onDragLeave={() => {
                        if (isLinkDropTarget) setLinkDropTargetTxnId(null);
                      }}
                      onDrop={(e) => {
                        if (linkSourceTxnId === null || isLinkSource) return;
                        e.preventDefault();
                        setLinkDropTargetTxnId(null);
                        void linkByDrop(txn);
                      }}
                      className={`border-b transition-colors ${
                        isLinkSource
                          ? "cursor-grab bg-primary/10"
                          : isLinkDropTarget
                            ? "bg-warning/15"
                            : "hover:bg-muted/30"
                      }`}
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
                      <td className="p-3 align-top">
                        <div className="truncate" title={txn.raw_description}>
                          {txn.description}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground truncate max-w-56" title={txn.merchant}>
                            {txn.merchant || "Unknown merchant"}
                          </span>
                          <Badge
                            variant={
                              txn.transaction_kind === "transfer"
                                ? "secondary"
                                : txn.transaction_kind === "income"
                                  ? "success"
                                  : txn.transaction_kind === "adjustment"
                                    ? "warning"
                                    : "default"
                            }
                          >
                            {txn.transaction_kind}
                          </Badge>
                        </div>
                      </td>
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
                        <td colSpan={4} className="p-3">
                          {expandedLoading ? (
                            <div className="text-sm text-muted-foreground">
                              Loading raw import data...
                            </div>
                          ) : expandedRaw ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-medium">Details</div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await api.updateTransaction(txn.id, {
                                          transaction_kind: "transfer",
                                          is_internal_transfer: true,
                                        });
                                        load();
                                      } catch (e) {
                                        setError(e instanceof Error ? e.message : "Failed to mark transfer");
                                      }
                                    }}
                                  >
                                    Mark as transfer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setLinkSourceTxnId(txn.id);
                                      setLinkDropTargetTxnId(null);
                                    }}
                                  >
                                    Link counterpart (drag)
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await api.unlinkTransfer(txn.id);
                                        load();
                                      } catch (e) {
                                        setError(e instanceof Error ? e.message : "Failed to unlink transfer");
                                      }
                                    }}
                                  >
                                    Unlink
                                  </Button>
                                  {(txn.transaction_kind === "transfer" || txn.is_internal_transfer) && !txn.transfer_group_id && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async () => {
                                        try {
                                          await api.updateTransaction(txn.id, {
                                            transaction_kind:
                                              txn.amount > 0
                                                ? "income"
                                                : txn.amount < 0
                                                  ? "expense"
                                                  : "adjustment",
                                            is_internal_transfer: false,
                                            transfer_group_id: null,
                                            transfer_linked_transaction_id: null,
                                            transfer_confidence: null,
                                            transfer_match_source: null,
                                          });
                                          await load();
                                        } catch (e) {
                                          setError(
                                            e instanceof Error
                                              ? e.message
                                              : "Failed to unmark transfer"
                                          );
                                        }
                                      }}
                                    >
                                      Unmark transfer
                                    </Button>
                                  )}
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
                                          setApplySimilarInfo("");
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
                                            setApplySimilarSeedValues({
                                              merchant: editMerchant,
                                              description: editDescription,
                                              raw_description: editRawDescription,
                                            });
                                            // Always open modal so users get explicit feedback.
                                            setApplySimilarOpen(true);
                                            await loadApplySimilarCandidates(
                                              txn.id,
                                              applySimilarMinScore
                                            );
                                            load();
                                          } catch (e) {
                                            setError(
                                              e instanceof Error
                                                ? e.message
                                                : "Failed to fetch suggestions"
                                            );
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
                                    <CategorySelect
                                      className="mt-1"
                                      categories={categories}
                                      value={editCategoryId}
                                      placeholder="(no change)"
                                      mode="path"
                                      onChange={(value) =>
                                        setEditCategoryId(
                                          typeof value === "number" ? value : ""
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="md:col-span-1">
                                    <label className="text-xs text-muted-foreground">
                                      Merchant
                                    </label>
                                    <input
                                      className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                                      list="merchant-suggestions-list"
                                      value={editMerchant}
                                      onChange={(e) => setEditMerchant(e.target.value)}
                                    />
                                    <datalist id="merchant-suggestions-list">
                                      {editMerchantSuggestions.map((name) => (
                                        <option key={name} value={name} />
                                      ))}
                                    </datalist>
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
                  </Fragment>
                )})}
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
                    list="manual-merchant-suggestions-list"
                    value={manualMerchant}
                    onChange={(e) => setManualMerchant(e.target.value)}
                    placeholder="Optional"
                  />
                  <datalist id="manual-merchant-suggestions-list">
                    {manualMerchantSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
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
        <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto p-4">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl mx-auto my-2 max-h-[92vh] flex flex-col">
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
            <div className="p-4 space-y-3 overflow-y-auto">
              {applySimilarInfo && (
                <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                  {applySimilarInfo}
                </div>
              )}
              {applySimilarSelected.size > 0 &&
                (() => {
                  const selectedClassified = applySimilarCandidates.filter(
                    (candidate) =>
                      applySimilarSelected.has(candidate.transaction_id) &&
                      candidate.is_classified
                  ).length;
                  if (selectedClassified === 0) return null;
                  return (
                    <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                      {selectedClassified} selected transaction(s) are already classified.
                      Applying changes will update text fields but keep existing categories.
                    </div>
                  );
                })()}
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
                  <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                    <label className="text-xs text-muted-foreground">
                      Threshold
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={95}
                      step={1}
                      value={applySimilarMinScore}
                      onChange={(e) => setApplySimilarMinScore(Number(e.target.value))}
                    />
                    <span className="w-8 text-right font-mono text-xs">
                      {applySimilarMinScore}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    disabled={applySimilarLoading || applySimilarSeedId === null}
                    onClick={async () => {
                      if (applySimilarSeedId === null) return;
                      await loadApplySimilarCandidates(
                        applySimilarSeedId,
                        applySimilarMinScore
                      );
                    }}
                  >
                    Refresh matches
                  </Button>
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
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Merchant</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">ML suggestion</th>
                      <th className="p-2 text-left">Match reason</th>
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
                        <td className="p-2">
                          {c.is_classified ? (
                            <Badge variant="warning">Classified</Badge>
                          ) : (
                            <Badge variant="secondary">Unclassified</Badge>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">{c.current_merchant}</td>
                        <td className="p-2 max-w-md truncate" title={c.current_description}>
                          {c.current_description}
                        </td>
                        <td className="p-2 max-w-sm">
                          <div className="space-y-1">
                            <div className="truncate text-xs" title={c.ml_suggested_merchant ?? ""}>
                              M: {c.ml_suggested_merchant ?? "-"}
                              {typeof c.ml_merchant_confidence === "number" && (
                                <span className="ml-1 text-muted-foreground">
                                  ({Math.round(c.ml_merchant_confidence * 100)}%)
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs" title={c.ml_suggested_description ?? ""}>
                              D: {c.ml_suggested_description ?? "-"}
                              {typeof c.ml_description_confidence === "number" && (
                                <span className="ml-1 text-muted-foreground">
                                  ({Math.round(c.ml_description_confidence * 100)}%)
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 max-w-xs truncate" title={c.reasons.join(", ")}>
                          {(c.reasons.length ? c.reasons : [c.reason]).join(", ")}{" "}
                          {Object.keys(c.score_components ?? {}).length > 0 && (
                            <span className="text-muted-foreground">
                              [{Object.entries(c.score_components)
                                .map(([k, v]) => `${k}:${Math.round(v)}`)
                                .join(" | ")}]
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">{c.score.toFixed(0)}</td>
                      </tr>
                    ))}
                    {applySimilarCandidates.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
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
                    const payload: {
                      transaction_ids: number[];
                      merchant?: string | null;
                      description?: string | null;
                      raw_description?: string | null;
                      allow_classified?: boolean;
                      re_predict?: boolean;
                    } = {
                      transaction_ids: Array.from(applySimilarSelected),
                      allow_classified: true,
                      re_predict: true,
                    };
                    if (applyFieldMerchant) payload.merchant = applySimilarSeedValues.merchant;
                    if (applyFieldDescription) payload.description = applySimilarSeedValues.description;
                    if (applyFieldRawDescription)
                      payload.raw_description = applySimilarSeedValues.raw_description;

                    setApplySimilarLoading(true);
                    try {
                      const result = await api.bulkUpdateFields(payload);
                      const skippedReasons = Object.entries(result.skipped_reasons ?? {})
                        .map(([reason, count]) => `${reason}: ${count}`)
                        .join(", ");
                      alert(
                        `Updated ${result.updated} transaction(s) (${result.updated_classified} classified). ` +
                          `Skipped ${result.skipped}.` +
                          (skippedReasons ? ` Reasons: ${skippedReasons}` : "")
                      );
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
