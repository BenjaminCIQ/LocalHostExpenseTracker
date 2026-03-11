import { Fragment, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import DoubleRangeSlider from "@/components/ui/DoubleRangeSlider";
import CategorySelect from "@/components/category/CategorySelect";
import CategoryMultiDropdown from "@/components/category/CategoryMultiDropdown";
import AccountMultiDropdown from "@/components/account/AccountMultiDropdown";
import { Tabs } from "@/components/ui/tabs";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import {
  api,
  type Account,
  type ExistingDuplicateCandidate,
  type Person,
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
import PersonIcon from "@/components/icons/PersonIcon";
import AccountIcon from "@/components/icons/AccountIcon";
import { useSelectedPersonId } from "@/lib/personFilter";
import { useAuth } from "@/lib/auth";
import TransferReviewPage from "@/pages/TransferReviewPage";
import TransactionComparisonPane from "@/components/transactions/TransactionComparisonPane";

type FilterMode = "all" | "unclassified" | "classified";

function toIsoDate(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return roundMoney(Math.min(max, Math.max(min, value)));
}

function scrollToFocusedTransaction(txnId: number): void {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-focus-txn-id="${txnId}"]`)
  );
  const visibleTarget = candidates.find(
    (el) => el.getClientRects().length > 0 && window.getComputedStyle(el).display !== "none"
  );
  if (!visibleTarget) return;
  visibleTarget.scrollIntoView({ behavior: "smooth", block: "center" });
}

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
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPersonId = useSelectedPersonId();
  const focusTxnIdParam = searchParams.get("focus_txn_id");
  const focusTxnId = focusTxnIdParam ? Number(focusTxnIdParam) : Number.NaN;
  const activeTabParam = searchParams.get("tab");
  const activeTab =
    activeTabParam === "transfers" || activeTabParam === "duplicates"
      ? activeTabParam
      : "transactions";
  const [data, setData] = useState<TransactionListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<ExistingDuplicateCandidate[]>([]);
  const [duplicateTxnById, setDuplicateTxnById] = useState<Record<number, Transaction>>({});
  const [duplicateActiveBySourceId, setDuplicateActiveBySourceId] = useState<Record<number, number>>({});
  const [duplicateAlertCount, setDuplicateAlertCount] = useState(0);
  const [transferAlertCount, setTransferAlertCount] = useState(0);
  const [focusAnchorDate, setFocusAnchorDate] = useState<string | null>(null);
  const [focusPreparedForId, setFocusPreparedForId] = useState<number | null>(null);
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
    income_min: number | null;
    income_max: number | null;
    expense_min_abs: number | null;
    expense_max_abs: number | null;
  } | null>(null);

  const [searchText, setSearchText] = useState("");
  const [merchantText, setMerchantText] = useState("");
  const [accountFilterIds, setAccountFilterIds] = useState<number[]>([]);
  const [accountFilterSearch, setAccountFilterSearch] = useState("");
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
  const [amountFilterMode, setAmountFilterMode] = useState<"any" | "expense_only" | "income_only" | "both_separate">("any");
  const [incomeMin, setIncomeMin] = useState<number | null>(null);
  const [incomeMax, setIncomeMax] = useState<number | null>(null);
  const [expenseMinAbs, setExpenseMinAbs] = useState<number | null>(null);
  const [expenseMaxAbs, setExpenseMaxAbs] = useState<number | null>(null);
  const hasAmountBounds =
    bounds !== null && bounds.min_amount !== null && bounds.max_amount !== null;
  const hasIncomeBounds =
    bounds !== null && bounds.income_min !== null && bounds.income_max !== null;
  const hasExpenseBounds =
    bounds !== null && bounds.expense_min_abs !== null && bounds.expense_max_abs !== null;

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
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<number>>(new Set());
  const [bulkSyncLoading, setBulkSyncLoading] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditCategoryId, setBulkEditCategoryId] = useState<number | "">("");
  const [bulkEditMerchant, setBulkEditMerchant] = useState("");
  const [bulkEditDescription, setBulkEditDescription] = useState("");
  const [bulkEditRawDescription, setBulkEditRawDescription] = useState("");
  const [bulkEditAllowClassified, setBulkEditAllowClassified] = useState(true);
  const [bulkEditSaving, setBulkEditSaving] = useState(false);

  const selectedCategoryNames = useMemo(
    () =>
      categories
        .filter((c) => categoryFilterIds.includes(c.id))
        .map((c) => c.name),
    [categories, categoryFilterIds]
  );
  const selectedAccountNames = useMemo(
    () =>
      accounts
        .filter((a) => accountFilterIds.includes(a.id))
        .map((a) => a.name),
    [accounts, accountFilterIds]
  );

  const accountById = useMemo(() => {
    if (!Array.isArray(accounts)) return new Map<number, Account>();
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);
  const personById = useMemo(() => {
    if (!Array.isArray(people)) return new Map<number, Person>();
    return new Map(people.map((p) => [p.id, p]));
  }, [people]);

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
      account_ids?: number[];
      category_id?: number;
      category_ids?: number[];
      start_date?: string;
      end_date?: string;
      min_amount?: number;
      max_amount?: number;
      income_min?: number;
      income_max?: number;
      expense_min_abs?: number;
      expense_max_abs?: number;
      transaction_kind?: "income" | "expense" | "transfer" | "adjustment";
      trip_id?: number;
      include_transfers?: boolean;
      sort_by?: "date" | "amount" | "merchant" | "description" | "category";
      sort_dir?: "asc" | "desc";
    } = {
      page,
      page_size: Number.isFinite(focusTxnId) ? 200 : 50,
    };
    if (Number.isFinite(focusTxnId)) {
      params.sort_by = "date";
      params.sort_dir = "desc";
    }
    if (selectedPersonId) params.person_id = selectedPersonId;
    if (filter === "classified") params.classified = true;
    if (filter === "unclassified") params.classified = false;
    if (searchText.trim()) params.q = searchText.trim();
    if (merchantText.trim()) params.merchant = merchantText.trim();
    if (accountFilterIds.length) params.account_ids = accountFilterIds;
    if (categoryFilterIds.length === 1) params.category_id = categoryFilterIds[0];
    if (categoryFilterIds.length > 1) params.category_ids = categoryFilterIds;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (tripFilterId) params.trip_id = Number(tripFilterId);
    if (amountFilterMode === "any") {
      if (minAmount !== null) params.min_amount = roundMoney(minAmount);
      if (maxAmount !== null) params.max_amount = roundMoney(maxAmount);
    } else if (amountFilterMode === "income_only") {
      if (incomeMin !== null) params.min_amount = roundMoney(incomeMin);
      if (incomeMax !== null) params.max_amount = roundMoney(incomeMax);
    } else if (amountFilterMode === "expense_only") {
      if (expenseMaxAbs !== null) params.min_amount = -roundMoney(expenseMaxAbs);
      if (expenseMinAbs !== null) params.max_amount = -roundMoney(expenseMinAbs);
    } else if (amountFilterMode === "both_separate") {
      if (incomeMin !== null) params.income_min = roundMoney(incomeMin);
      if (incomeMax !== null) params.income_max = roundMoney(incomeMax);
      if (expenseMinAbs !== null) params.expense_min_abs = roundMoney(expenseMinAbs);
      if (expenseMaxAbs !== null) params.expense_max_abs = roundMoney(expenseMaxAbs);
    }
    if (transactionKindFilter) params.transaction_kind = transactionKindFilter;
    params.include_transfers = includeTransfers;
    if (!Number.isFinite(focusTxnId)) {
      params.sort_by = sortBy;
      params.sort_dir = sortDir;
    }
    api.getTransactions(params).then(setData).catch((e) => setError(e.message));
  }, [
    page,
    filter,
    searchText,
    merchantText,
    accountFilterIds,
    categoryFilterIds,
    startDate,
    endDate,
    tripFilterId,
    minAmount,
    maxAmount,
    transactionKindFilter,
    amountFilterMode,
    incomeMin,
    incomeMax,
    expenseMinAbs,
    expenseMaxAbs,
    includeTransfers,
    sortBy,
    sortDir,
    selectedPersonId,
    focusTxnId,
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
    const timer = setTimeout(() => {
      load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!Number.isFinite(focusTxnId)) {
      setFocusPreparedForId(null);
      setFocusAnchorDate(null);
      return;
    }
    if (focusPreparedForId === focusTxnId) return;
    let cancelled = false;
    api
      .getTransactions({ page: 1, page_size: 1, transaction_id: focusTxnId })
      .then((res) => {
        if (cancelled) return;
        const txn = res.items?.[0];
        if (!txn) {
          setFocusPreparedForId(focusTxnId);
          return;
        }
        setFocusAnchorDate(txn.date);
        // Build a contextual view around the focused transaction.
        setFilter("all");
        setSearchText("");
        setMerchantText("");
        setAccountFilterIds([]);
        setAccountFilterSearch("");
        setCategoryFilterIds([]);
        setCategoryFilterSearch("");
        setTransactionKindFilter("");
        setTripFilterId("");
        setIncludeTransfers(true);
        setAmountFilterMode("any");
        setMinAmount(null);
        setMaxAmount(null);
        setIncomeMin(null);
        setIncomeMax(null);
        setExpenseMinAbs(null);
        setExpenseMaxAbs(null);
        setStartDate(addDays(txn.date, -14));
        setEndDate(addDays(txn.date, 14));
        setPage(1);
        setFocusPreparedForId(focusTxnId);
      })
      .catch(() => {
        if (!cancelled) setFocusPreparedForId(focusTxnId);
      });
    return () => {
      cancelled = true;
    };
  }, [focusPreparedForId, focusTxnId]);

  useEffect(() => {
    if (!Number.isFinite(focusTxnId) || !data?.items?.length) return;
    const target = data.items.find((item) => item.id === focusTxnId);
    if (!target) return;
    setTimeout(() => {
      scrollToFocusedTransaction(focusTxnId);
    }, 60);
  }, [data, focusTxnId]);

  useEffect(() => {
    const load = () => api.getCategories().then(setCategories);
    load();
    window.addEventListener("categories-updated", load);
    return () => window.removeEventListener("categories-updated", load);
  }, []);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

  const loadDuplicateReview = useCallback(async () => {
    const items = await api.getPotentialDuplicates({
      limit: 250,
      person_id: selectedPersonId ?? undefined,
    });
    setDuplicateCandidates(items);
    setDuplicateAlertCount(items.length);
    const ids = Array.from(
      new Set(items.flatMap((item) => [item.transaction_id, item.candidate_id]))
    );
    if (ids.length === 0) {
      setDuplicateTxnById({});
      return;
    }
    const details = await Promise.all(
      ids.map(async (id) => {
        const txn = await api.getTransaction(id);
        return [id, txn] as const;
      })
    );
    setDuplicateTxnById(Object.fromEntries(details));
  }, [selectedPersonId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getTransferCandidates({
        limit: 25,
        seed_limit: 400,
        max_results: 25,
        person_id: selectedPersonId ?? undefined,
      }),
      api.getPotentialDuplicates({
        limit: 250,
        person_id: selectedPersonId ?? undefined,
      }),
    ])
      .then(([transferItems, duplicateItems]) => {
        if (cancelled) return;
        setTransferAlertCount(transferItems.length);
        setDuplicateAlertCount(duplicateItems.length);
      })
      .catch(() => {
        if (cancelled) return;
        setTransferAlertCount(0);
        setDuplicateAlertCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPersonId]);

  useEffect(() => {
    if (activeTab !== "duplicates") return;
    let cancelled = false;
    loadDuplicateReview()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (!cancelled) {
          setDuplicateCandidates([]);
          setDuplicateTxnById({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadDuplicateReview]);

  useEffect(() => {
    const loadAccountsAndPeople = () => {
      Promise.all([api.getAccounts(), api.getPersons()])
        .then(([accs, persons]) => {
          setAccounts(Array.isArray(accs) ? accs : []);
          setPeople(Array.isArray(persons) ? persons : []);
          if (manualAccountId === null && Array.isArray(accs) && accs.length > 0) setManualAccountId(accs[0].id);
        })
        .catch(() => {
          setAccounts([]);
          setPeople([]);
        });
    };
    loadAccountsAndPeople();
    window.addEventListener("people-updated", loadAccountsAndPeople);
    window.addEventListener("accounts-updated", loadAccountsAndPeople);
    return () => {
      window.removeEventListener("people-updated", loadAccountsAndPeople);
      window.removeEventListener("accounts-updated", loadAccountsAndPeople);
    };
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
        if (minAmount === null && b.min_amount !== null) setMinAmount(roundMoney(b.min_amount));
        if (maxAmount === null && b.max_amount !== null) setMaxAmount(roundMoney(b.max_amount));
        if (incomeMin === null && b.income_min !== null) setIncomeMin(roundMoney(b.income_min));
        if (incomeMax === null && b.income_max !== null) setIncomeMax(roundMoney(b.income_max));
        if (expenseMinAbs === null && b.expense_min_abs !== null) setExpenseMinAbs(roundMoney(b.expense_min_abs));
        if (expenseMaxAbs === null && b.expense_max_abs !== null) setExpenseMaxAbs(roundMoney(b.expense_max_abs));
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
    setAccountFilterIds([]);
    setAccountFilterSearch("");
    setCategoryFilterIds([]);
    setCategoryFilterSearch("");
    setTransactionKindFilter("");
    setIncludeTransfers(true);
    setStartDate(bounds?.min_date ?? "");
    setEndDate(bounds?.max_date ?? "");
    setTripFilterId("");
    setAmountFilterMode("any");
    setMinAmount(bounds?.min_amount !== null && bounds?.min_amount !== undefined ? roundMoney(bounds.min_amount) : null);
    setMaxAmount(bounds?.max_amount !== null && bounds?.max_amount !== undefined ? roundMoney(bounds.max_amount) : null);
    setIncomeMin(bounds?.income_min !== null && bounds?.income_min !== undefined ? roundMoney(bounds.income_min) : null);
    setIncomeMax(bounds?.income_max !== null && bounds?.income_max !== undefined ? roundMoney(bounds.income_max) : null);
    setExpenseMinAbs(bounds?.expense_min_abs !== null && bounds?.expense_min_abs !== undefined ? roundMoney(bounds.expense_min_abs) : null);
    setExpenseMaxAbs(bounds?.expense_max_abs !== null && bounds?.expense_max_abs !== undefined ? roundMoney(bounds.expense_max_abs) : null);
    setPage(1);
    if (Number.isFinite(focusTxnId)) {
      const next = new URLSearchParams(searchParams);
      next.delete("focus_txn_id");
      setSearchParams(next);
    }
  };

  const clearFocusedTransaction = () => {
    if (!Number.isFinite(focusTxnId)) return;
    const next = new URLSearchParams(searchParams);
    next.delete("focus_txn_id");
    setSearchParams(next);
    setPage(1);
  };

  const widenFocusedContext = (days: number) => {
    if (!focusAnchorDate) return;
    setStartDate(addDays(focusAnchorDate, -days));
    setEndDate(addDays(focusAnchorDate, days));
    setPage(1);
  };

  const activeFilterCount = (() => {
    let n = 0;
    if (searchText.trim()) n += 1;
    if (merchantText.trim()) n += 1;
    if (accountFilterIds.length) n += 1;
    if (categoryFilterIds.length) n += 1;
    if (transactionKindFilter) n += 1;
    if (!includeTransfers) n += 1;

    const defaultStart = bounds?.min_date ?? "";
    const defaultEnd = bounds?.max_date ?? "";
    if (startDate && startDate !== defaultStart) n += 1;
    if (endDate && endDate !== defaultEnd) n += 1;
    if (tripFilterId) n += 1;

    if (amountFilterMode !== "any") n += 1;
    const minBound = bounds?.min_amount ?? null;
    const maxBound = bounds?.max_amount ?? null;
    const incomeMinBound = bounds?.income_min ?? null;
    const incomeMaxBound = bounds?.income_max ?? null;
    const expenseMinBound = bounds?.expense_min_abs ?? null;
    const expenseMaxBound = bounds?.expense_max_abs ?? null;
    if (amountFilterMode === "any") {
      if (minBound !== null && minAmount !== null && minAmount !== minBound) n += 1;
      if (maxBound !== null && maxAmount !== null && maxAmount !== maxBound) n += 1;
    } else if (amountFilterMode === "income_only") {
      if (incomeMinBound !== null && incomeMin !== null && incomeMin !== incomeMinBound) n += 1;
      if (incomeMaxBound !== null && incomeMax !== null && incomeMax !== incomeMaxBound) n += 1;
    } else if (amountFilterMode === "expense_only") {
      if (expenseMinBound !== null && expenseMinAbs !== null && expenseMinAbs !== expenseMinBound) n += 1;
      if (expenseMaxBound !== null && expenseMaxAbs !== null && expenseMaxAbs !== expenseMaxBound) n += 1;
    } else if (amountFilterMode === "both_separate") {
      if (incomeMinBound !== null && incomeMin !== null && incomeMin !== incomeMinBound) n += 1;
      if (incomeMaxBound !== null && incomeMax !== null && incomeMax !== incomeMaxBound) n += 1;
      if (expenseMinBound !== null && expenseMinAbs !== null && expenseMinAbs !== expenseMinBound) n += 1;
      if (expenseMaxBound !== null && expenseMaxAbs !== null && expenseMaxAbs !== expenseMaxBound) n += 1;
    }

    return n;
  })();

  const selectedCount = similarSelected.size;
  const selectedTotal = similarCandidates
    .filter((c) => similarSelected.has(c.transaction_id))
    .reduce((sum, c) => sum + c.amount, 0);
  const isFocusedTxnVisible =
    Number.isFinite(focusTxnId) &&
    !!data?.items?.some((item) => item.id === focusTxnId);
  const renderAlertLabel = (text: string, count: number) => {
    if (count <= 0) return text;
    const textCount = `${count}${count >= 25 ? "+" : ""}`;
    return (
      <span className="inline-flex items-center gap-1">
        <span>{text}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[11px] text-destructive">
          <AlertCircle className="h-3 w-3" />
          {textCount}
        </span>
      </span>
    );
  };
  const tabOptions: { value: "transactions" | "transfers" | "duplicates"; label: ReactNode }[] = [
    { value: "transactions", label: "Transactions" },
    {
      value: "transfers",
      label: renderAlertLabel("Transfer Review", transferAlertCount),
    },
    {
      value: "duplicates",
      label: renderAlertLabel("Duplicates", duplicateAlertCount),
    },
  ];
  const duplicateGrouped = useMemo(() => {
    const bySource = new Map<number, ExistingDuplicateCandidate[]>();
    for (const item of duplicateCandidates) {
      const list = bySource.get(item.transaction_id) ?? [];
      list.push(item);
      bySource.set(item.transaction_id, list);
    }
    return Array.from(bySource.entries())
      .map(([sourceId, candidates]) => ({
        sourceId,
        candidates: candidates.sort((a, b) => b.rating - a.rating),
      }))
      .sort((a, b) => (b.candidates[0]?.rating ?? 0) - (a.candidates[0]?.rating ?? 0));
  }, [duplicateCandidates]);
  const selectedDuplicateFor = (sourceId: number, list: ExistingDuplicateCandidate[]) => {
    const idx = duplicateActiveBySourceId[sourceId] ?? 0;
    if (idx < 0 || idx >= list.length) return list[0];
    return list[idx];
  };
  const handleTabChange = (next: "transactions" | "transfers" | "duplicates") => {
    if (next === "transactions") {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab: next });
  };

  if (activeTab === "transfers") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            options={tabOptions}
          />
          <Link to="/import">
            <Button variant="outline">Import Data</Button>
          </Link>
        </div>
        <TransferReviewPage embedded />
      </div>
    );
  }

  if (activeTab === "duplicates") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            options={tabOptions}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                loadDuplicateReview().catch(() => {
                  setDuplicateCandidates([]);
                  setDuplicateTxnById({});
                });
              }}
            >
              Refresh
            </Button>
            <Link to="/import">
              <Button variant="outline">Import Data</Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>
              Potential duplicates ({duplicateCandidates.length} pairs / {duplicateGrouped.length} source transactions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {duplicateGrouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">No potential duplicates found.</p>
            ) : (
              <div className="space-y-2">
                {duplicateGrouped.map((group) => {
                  const active = selectedDuplicateFor(group.sourceId, group.candidates);
                  const activeIdx = group.candidates.findIndex((item) => item.candidate_id === active.candidate_id);
                  const sourceTxn = duplicateTxnById[active.transaction_id];
                  const candidateTxn = duplicateTxnById[active.candidate_id];
                  return (
                    <div key={group.sourceId} className="rounded-md border border-border p-3 space-y-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          Source #{group.sourceId} · {group.candidates.length} candidates
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={activeIdx <= 0}
                            onClick={() =>
                              setDuplicateActiveBySourceId((prev) => ({
                                ...prev,
                                [group.sourceId]: activeIdx - 1,
                              }))
                            }
                          >
                            Prev
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {Math.max(activeIdx + 1, 1)} / {group.candidates.length}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={activeIdx >= group.candidates.length - 1}
                            onClick={() =>
                              setDuplicateActiveBySourceId((prev) => ({
                                ...prev,
                                [group.sourceId]: activeIdx + 1,
                              }))
                            }
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {sourceTxn ? (
                          <TransactionComparisonPane
                            transactionId={sourceTxn.id}
                            title={`Source #${sourceTxn.id}`}
                            date={sourceTxn.date}
                            amount={sourceTxn.amount}
                            merchant={sourceTxn.merchant}
                            description={sourceTxn.description}
                            rawDescription={sourceTxn.raw_description}
                            currency={sourceTxn.currency}
                            kind={sourceTxn.transaction_kind}
                            isInternalTransfer={sourceTxn.is_internal_transfer}
                            transferGroupId={sourceTxn.transfer_group_id}
                            disabled={false}
                            onChanged={async () => {
                              await loadDuplicateReview();
                            }}
                          />
                        ) : (
                          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                            Loading source transaction...
                          </div>
                        )}
                        {candidateTxn ? (
                          <TransactionComparisonPane
                            transactionId={candidateTxn.id}
                            title={`Candidate #${candidateTxn.id}`}
                            date={candidateTxn.date}
                            amount={candidateTxn.amount}
                            merchant={candidateTxn.merchant}
                            description={candidateTxn.description}
                            rawDescription={candidateTxn.raw_description}
                            currency={candidateTxn.currency}
                            kind={candidateTxn.transaction_kind}
                            isInternalTransfer={candidateTxn.is_internal_transfer}
                            transferGroupId={candidateTxn.transfer_group_id}
                            disabled={false}
                            onChanged={async () => {
                              await loadDuplicateReview();
                            }}
                          />
                        ) : (
                          <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                            Loading candidate transaction...
                          </div>
                        )}
                      </div>
                      <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                        <Badge variant={active.rating >= 0.9 ? "warning" : "secondary"}>
                          {(active.rating * 100).toFixed(0)}%
                        </Badge>
                        <span className="ml-2 text-muted-foreground">{active.reason}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          options={tabOptions}
        />
        <Link to="/import">
          <Button variant="outline">Import Data</Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div className="flex gap-2">
          {Number.isFinite(focusTxnId) ? (
            <Button variant="outline" onClick={clearFocusedTransaction}>
              Clear focus
            </Button>
          ) : null}
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
      {Number.isFinite(focusTxnId) ? (
        <div className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm flex flex-wrap items-center gap-2">
          <span className="font-medium">Focused transaction:</span>
          <span className="font-mono">#{focusTxnId}</span>
          {isFocusedTxnVisible ? (
            <span className="text-muted-foreground">Visible and highlighted below.</span>
          ) : (
            <span className="text-muted-foreground">Not visible on current page yet.</span>
          )}
          {focusAnchorDate ? (
            <Button size="sm" variant="outline" onClick={() => widenFocusedContext(90)}>
              Widen to +/-90 days
            </Button>
          ) : null}
        </div>
      ) : null}

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
              {!filtersOpen && selectedAccountNames.length > 0 && (
                <>
                  {selectedAccountNames.slice(0, 2).map((name, idx) => (
                    <Badge key={`acct-${name}-${idx}`} variant="outline">{name}</Badge>
                  ))}
                  {selectedAccountNames.length > 2 && (
                    <Badge variant="outline">+{selectedAccountNames.length - 2}</Badge>
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
                placeholder="merchant/description… + AND | OR () groups"
                title="Use + for AND, | for OR, () for grouping. Example: (REWE|Lidl)+Groceries"
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
              <label className="text-sm text-muted-foreground">Account</label>
              <AccountMultiDropdown
                accounts={accounts}
                selectedIds={accountFilterIds}
                search={accountFilterSearch}
                onSearchChange={setAccountFilterSearch}
                onChange={(ids) => {
                  setAccountFilterIds(ids);
                  setPage(1);
                }}
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
              <div className="grid gap-2 md:grid-cols-2 md:items-end">
                <div>
                  <label className="text-sm text-muted-foreground">Amount mode</label>
                  <Select
                    className="mt-1"
                    value={amountFilterMode}
                    onChange={(e) => {
                      setAmountFilterMode(
                        (e.target.value as "any" | "expense_only" | "income_only" | "both_separate") ?? "any"
                      );
                      setPage(1);
                    }}
                  >
                    <option value="any">Any (signed range)</option>
                    <option value="expense_only">Expense only</option>
                    <option value="income_only">Income only</option>
                    <option value="both_separate">Both (separate ranges)</option>
                  </Select>
                </div>
              </div>

              {amountFilterMode === "any" && hasAmountBounds ? (
                <div className="mt-2 space-y-2">
                  <DoubleRangeSlider
                    min={bounds!.min_amount!}
                    max={bounds!.max_amount!}
                    step={1}
                    minValue={minAmount ?? bounds!.min_amount!}
                    maxValue={maxAmount ?? bounds!.max_amount!}
                    onChange={(nextMin, nextMax) => {
                      setMinAmount(roundMoney(nextMin));
                      setMaxAmount(roundMoney(nextMax));
                      setPage(1);
                    }}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Min
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={minAmount ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setMinAmount(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = bounds!.min_amount!;
                          const upper = maxAmount ?? bounds!.max_amount!;
                          setMinAmount(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Max
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={maxAmount ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setMaxAmount(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = minAmount ?? bounds!.min_amount!;
                          const upper = bounds!.max_amount!;
                          setMaxAmount(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {amountFilterMode === "income_only" && hasIncomeBounds ? (
                <div className="mt-2 space-y-2">
                  <DoubleRangeSlider
                    min={bounds!.income_min!}
                    max={bounds!.income_max!}
                    step={1}
                    minValue={incomeMin ?? bounds!.income_min!}
                    maxValue={incomeMax ?? bounds!.income_max!}
                    onChange={(nextMin, nextMax) => {
                      setIncomeMin(roundMoney(nextMin));
                      setIncomeMax(roundMoney(nextMax));
                      setPage(1);
                    }}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Income min
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={incomeMin ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setIncomeMin(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = bounds!.income_min!;
                          const upper = incomeMax ?? bounds!.income_max!;
                          setIncomeMin(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Income max
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={incomeMax ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setIncomeMax(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = incomeMin ?? bounds!.income_min!;
                          const upper = bounds!.income_max!;
                          setIncomeMax(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {amountFilterMode === "expense_only" && hasExpenseBounds ? (
                <div className="mt-2 space-y-2">
                  <DoubleRangeSlider
                    min={bounds!.expense_min_abs!}
                    max={bounds!.expense_max_abs!}
                    step={1}
                    minValue={expenseMinAbs ?? bounds!.expense_min_abs!}
                    maxValue={expenseMaxAbs ?? bounds!.expense_max_abs!}
                    onChange={(nextMin, nextMax) => {
                      setExpenseMinAbs(roundMoney(nextMin));
                      setExpenseMaxAbs(roundMoney(nextMax));
                      setPage(1);
                    }}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Expense min
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={expenseMinAbs ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setExpenseMinAbs(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = bounds!.expense_min_abs!;
                          const upper = expenseMaxAbs ?? bounds!.expense_max_abs!;
                          setExpenseMinAbs(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Expense max
                      <input
                        type="number"
                        step={1}
                        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                        value={expenseMaxAbs ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            setExpenseMaxAbs(null);
                            setPage(1);
                            return;
                          }
                          const parsed = Number(raw);
                          if (Number.isNaN(parsed)) return;
                          const lower = expenseMinAbs ?? bounds!.expense_min_abs!;
                          const upper = bounds!.expense_max_abs!;
                          setExpenseMaxAbs(clampNumber(parsed, lower, upper));
                          setPage(1);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              {amountFilterMode === "both_separate" && hasIncomeBounds && hasExpenseBounds ? (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-border p-2">
                    <div className="text-xs text-muted-foreground">Income range</div>
                    <DoubleRangeSlider
                      min={bounds!.income_min!}
                      max={bounds!.income_max!}
                      step={1}
                      minValue={incomeMin ?? bounds!.income_min!}
                      maxValue={incomeMax ?? bounds!.income_max!}
                      onChange={(nextMin, nextMax) => {
                        setIncomeMin(roundMoney(nextMin));
                        setIncomeMax(roundMoney(nextMax));
                        setPage(1);
                      }}
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs text-muted-foreground">
                        Min
                        <input
                          type="number"
                          step={1}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={incomeMin ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setIncomeMin(null);
                              setPage(1);
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) return;
                            const lower = bounds!.income_min!;
                            const upper = incomeMax ?? bounds!.income_max!;
                            setIncomeMin(clampNumber(parsed, lower, upper));
                            setPage(1);
                          }}
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Max
                        <input
                          type="number"
                          step={1}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={incomeMax ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setIncomeMax(null);
                              setPage(1);
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) return;
                            const lower = incomeMin ?? bounds!.income_min!;
                            const upper = bounds!.income_max!;
                            setIncomeMax(clampNumber(parsed, lower, upper));
                            setPage(1);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-border p-2">
                    <div className="text-xs text-muted-foreground">Expense range (absolute)</div>
                    <DoubleRangeSlider
                      min={bounds!.expense_min_abs!}
                      max={bounds!.expense_max_abs!}
                      step={1}
                      minValue={expenseMinAbs ?? bounds!.expense_min_abs!}
                      maxValue={expenseMaxAbs ?? bounds!.expense_max_abs!}
                      onChange={(nextMin, nextMax) => {
                        setExpenseMinAbs(roundMoney(nextMin));
                        setExpenseMaxAbs(roundMoney(nextMax));
                        setPage(1);
                      }}
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs text-muted-foreground">
                        Min
                        <input
                          type="number"
                          step={1}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={expenseMinAbs ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setExpenseMinAbs(null);
                              setPage(1);
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) return;
                            const lower = bounds!.expense_min_abs!;
                            const upper = expenseMaxAbs ?? bounds!.expense_max_abs!;
                            setExpenseMinAbs(clampNumber(parsed, lower, upper));
                            setPage(1);
                          }}
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Max
                        <input
                          type="number"
                          step={1}
                          className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={expenseMaxAbs ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              setExpenseMaxAbs(null);
                              setPage(1);
                              return;
                            }
                            const parsed = Number(raw);
                            if (Number.isNaN(parsed)) return;
                            const lower = expenseMinAbs ?? bounds!.expense_min_abs!;
                            const upper = bounds!.expense_max_abs!;
                            setExpenseMaxAbs(clampNumber(parsed, lower, upper));
                            setPage(1);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}

              {!hasAmountBounds ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Upload transactions to enable amount sliders.
                </p>
              ) : null}
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
          {selectedTxnIds.size > 0 && activeTab === "transactions" && (
            <div className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-3 py-2 text-sm">
              <span>
                <span className="font-mono font-medium">{selectedTxnIds.size}</span> transaction(s) selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTxnIds(new Set())}
                >
                  Clear selection
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBulkEditCategoryId("");
                    setBulkEditMerchant("");
                    setBulkEditDescription("");
                    setBulkEditRawDescription("");
                    setBulkEditOpen(true);
                  }}
                >
                  Bulk edit
                </Button>
                <Button
                  size="sm"
                  disabled={bulkSyncLoading}
                  onClick={async () => {
                    setBulkSyncLoading(true);
                    try {
                      await api.bulkSyncTransactionKind({
                        transaction_ids: Array.from(selectedTxnIds),
                      });
                      setError("");
                      setSelectedTxnIds(new Set());
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Bulk sync failed");
                    } finally {
                      setBulkSyncLoading(false);
                    }
                  }}
                >
                  {bulkSyncLoading ? "Syncing…" : "Sync transaction_kind with category"}
                </Button>
              </div>
            </div>
          )}
          <div className="md:hidden p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(
                    (e.target.value as "date" | "amount" | "merchant" | "description" | "category") ??
                      "date"
                  );
                  setPage(1);
                }}
              >
                <option value="date">Sort: Date</option>
                <option value="amount">Sort: Amount</option>
                <option value="merchant">Sort: Merchant</option>
                <option value="description">Sort: Description</option>
                <option value="category">Sort: Category</option>
              </Select>
              <Select
                value={sortDir}
                onChange={(e) => {
                  setSortDir((e.target.value as "asc" | "desc") ?? "desc");
                  setPage(1);
                }}
              >
                <option value="desc">Order: Desc</option>
                <option value="asc">Order: Asc</option>
              </Select>
            </div>

            {data?.items.map((txn) => (
              <div
                data-focus-txn-id={txn.id}
                key={txn.id}
                className={`rounded-md border p-3 space-y-2 ${
                  Number.isFinite(focusTxnId) && txn.id === focusTxnId
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedTxnIds.has(txn.id)}
                      onChange={(e) => {
                        setSelectedTxnIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(txn.id);
                          else next.delete(txn.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {(() => {
                      const acc = accountById.get(txn.account_id);
                      const person = acc?.person_id ? personById.get(acc.person_id) : null;
                      return (
                        <div className="flex items-center gap-1 shrink-0 text-base">
                          <PersonIcon
                            iconId={person?.icon_id}
                            title={person?.name ?? "Unassigned"}
                            className="text-base"
                          />
                          <AccountIcon
                            iconId={acc?.icon_id}
                            title={acc?.name ?? "Unknown account"}
                            className="text-base"
                          />
                        </div>
                      );
                    })()}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium shrink-0">{formatDate(txn.date)}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {txn.merchant || "Unknown merchant"}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-sm font-mono font-semibold ${
                      txn.amount >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {formatCurrency(txn.amount)}
                  </div>
                </div>

                <div className="text-sm">{txn.description}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
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
                  {txn.final_category_name ? (
                    <Badge variant="outline">{txn.final_category_name}</Badge>
                  ) : (
                    <Badge variant="outline">Unclassified</Badge>
                  )}
                </div>

                <div className="flex gap-2">
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
                    {expandedTxnId === txn.id ? "Hide details" : "Show details"}
                  </Button>
                </div>

                <ClassifyCell
                  transaction={txn}
                  categories={categories}
                  onClassify={handleClassify}
                  onCategoryCreated={async () => {
                    await refreshCategories();
                  }}
                  onError={(msg) => setError(msg)}
                />

                {expandedTxnId === txn.id && (
                  <div className="rounded-md border border-border bg-muted/20 p-2 space-y-2 text-xs">
                    {expandedLoading ? (
                      <div className="text-muted-foreground">Loading raw import data...</div>
                    ) : expandedRaw ? (
                      <>
                        {expandedRaw.raw_row_line ? (
                          <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-2">
                            {expandedRaw.raw_row_line}
                          </pre>
                        ) : null}
                        {expandedRaw.raw_row_json ? (
                          <pre className="whitespace-pre-wrap rounded-md border border-border bg-background p-2">
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
                        ) : null}
                        {!expandedRaw.raw_row_json && !expandedRaw.raw_row_line ? (
                          <div className="text-muted-foreground">
                            No raw import data stored for this transaction.
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-muted-foreground">
                        No raw import data available.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {data?.items.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">
                No transactions found. Upload a bank statement to get started.
              </div>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="w-10 py-3 pl-3 pr-1">
                    <input
                      type="checkbox"
                      checked={data?.items.length ? data.items.every((t) => selectedTxnIds.has(t.id)) : false}
                      onChange={(e) => {
                        if (!data?.items) return;
                        if (e.target.checked) {
                          setSelectedTxnIds((prev) => {
                            const next = new Set(prev);
                            data.items.forEach((t) => next.add(t.id));
                            return next;
                          });
                        } else {
                          setSelectedTxnIds((prev) => {
                            const next = new Set(prev);
                            data.items.forEach((t) => next.delete(t.id));
                            return next;
                          });
                        }
                      }}
                      title="Select all on page"
                    />
                  </th>
                  <th className="w-52 text-left py-3 pl-3 pr-6 font-medium">
                    <button onClick={() => toggleSort("date")}>Date {sortBy === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</button>
                  </th>
                  <th className="text-left py-3 pr-3 pl-6 font-medium">
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
                      data-focus-txn-id={txn.id}
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
                        txn.has_external_funding_links ? "border-l-4 border-l-amber-500" : ""
                      } ${
                        isLinkSource
                          ? "cursor-grab bg-primary/10"
                          : isLinkDropTarget
                            ? "bg-warning/15"
                            : Number.isFinite(focusTxnId) && txn.id === focusTxnId
                              ? "bg-primary/15 ring-2 ring-inset ring-primary/50"
                              : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="py-3 pl-3 pr-1">
                        <input
                          type="checkbox"
                          checked={selectedTxnIds.has(txn.id)}
                          onChange={(e) => {
                            setSelectedTxnIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(txn.id);
                              else next.delete(txn.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-3 pl-3 pr-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const acc = accountById.get(txn.account_id);
                            const person = acc?.person_id ? personById.get(acc.person_id) : null;
                            return (
                              <div className="flex items-center gap-1 shrink-0 text-base">
                                <PersonIcon
                                  iconId={person?.icon_id}
                                  title={person?.name ?? "Unassigned"}
                                  className="text-base"
                                />
                                <AccountIcon
                                  iconId={acc?.icon_id}
                                  title={acc?.name ?? "Unknown account"}
                                  className="text-base"
                                />
                              </div>
                            );
                          })()}
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
                          <span className="min-w-[7rem]">{formatDate(txn.date)}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 pl-6 align-top">
                        <div className="truncate" title={txn.raw_description}>
                          {txn.description}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground truncate max-w-56" title={txn.merchant}>
                            {txn.merchant || "Unknown merchant"}
                          </span>
                          {txn.has_external_funding_links ? (
                            <Badge
                              variant="secondary"
                              className="badge-external-transfer bg-amber-500/20 dark:bg-amber-500/30"
                            >
                              external_transfer
                            </Badge>
                          ) : (
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
                          )}
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
                                    <div className="flex items-center gap-2">
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
                                      {isAdmin ? (
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={async () => {
                                            const reason = window.prompt(
                                              "Delete reason (required):",
                                              "duplicate transaction"
                                            );
                                            if (!reason || !reason.trim()) return;
                                            try {
                                              await api.softDeleteTransaction(txn.id, reason.trim());
                                              await load();
                                            } catch (e) {
                                              setError(
                                                e instanceof Error
                                                  ? e.message
                                                  : "Failed to delete transaction"
                                              );
                                            }
                                          }}
                                        >
                                          Delete
                                        </Button>
                                      ) : null}
                                    </div>
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

      {bulkEditOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl mx-4">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Bulk edit</div>
                <div className="text-sm text-muted-foreground">
                  Edit category, merchant, or description for {selectedTxnIds.size} selected transaction(s). Leave fields empty to keep current values.
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setBulkEditOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Category</label>
                <CategorySelect
                  className="mt-1"
                  categories={categories}
                  value={bulkEditCategoryId}
                  placeholder="(keep current)"
                  mode="path"
                  onChange={(value) =>
                    setBulkEditCategoryId(typeof value === "number" ? value : "")
                  }
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Merchant</label>
                <input
                  className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={bulkEditMerchant}
                  onChange={(e) => setBulkEditMerchant(e.target.value)}
                  placeholder="(keep current)"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Description</label>
                <input
                  className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={bulkEditDescription}
                  onChange={(e) => setBulkEditDescription(e.target.value)}
                  placeholder="(keep current)"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Raw description</label>
                <input
                  className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                  value={bulkEditRawDescription}
                  onChange={(e) => setBulkEditRawDescription(e.target.value)}
                  placeholder="(keep current)"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bulkEditAllowClassified}
                  onChange={(e) => setBulkEditAllowClassified(e.target.checked)}
                />
                Apply to already-classified transactions
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setBulkEditOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    bulkEditSaving ||
                    (!bulkEditCategoryId &&
                      !bulkEditMerchant.trim() &&
                      !bulkEditDescription.trim() &&
                      !bulkEditRawDescription.trim())
                  }
                  onClick={async () => {
                    setBulkEditSaving(true);
                    try {
                      setError("");
                      const ids = Array.from(selectedTxnIds);
                      if (bulkEditCategoryId) {
                        await api.bulkClassify({
                          transaction_ids: ids,
                          category_id: bulkEditCategoryId,
                          merchant: bulkEditMerchant.trim() || undefined,
                          allow_classified: bulkEditAllowClassified,
                        });
                      }
                      if (
                        bulkEditMerchant.trim() ||
                        bulkEditDescription.trim() ||
                        bulkEditRawDescription.trim()
                      ) {
                        await api.bulkUpdateFields({
                          transaction_ids: ids,
                          merchant: bulkEditMerchant.trim() || undefined,
                          description: bulkEditDescription.trim() || undefined,
                          raw_description: bulkEditRawDescription.trim() || undefined,
                          allow_classified: bulkEditAllowClassified,
                          re_predict: false,
                        });
                      }
                      setBulkEditOpen(false);
                      setSelectedTxnIds(new Set());
                      load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Bulk edit failed");
                    } finally {
                      setBulkEditSaving(false);
                    }
                  }}
                >
                  {bulkEditSaving ? "Applying…" : "Apply"}
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
