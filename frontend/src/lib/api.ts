const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface Account {
  id: number;
  name: string;
  bank_name: string;
  account_type: string;
  account_group: string;
  currency: string;
  owner: string;
  starting_balance: number;
  person_id?: number | null;
}

export interface Person {
  id: number;
  name: string;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  is_income: boolean;
  sort_order: number;
  children?: Category[];
}

export interface CategoryCreate {
  name: string;
  parent_id: number | null;
  is_income: boolean;
  sort_order?: number | null;
}

export interface Transaction {
  id: number;
  account_id: number;
  date: string;
  amount: number;
  raw_description: string;
  description: string;
  merchant: string;
  currency: string;
  predicted_category_id: number | null;
  predicted_category_name: string | null;
  final_category_id: number | null;
  final_category_name: string | null;
  classification_source: string | null;
  confidence: number | null;
  transaction_kind: "income" | "expense" | "transfer" | "adjustment";
  transfer_group_id: string | null;
  transfer_linked_transaction_id: number | null;
  transfer_confidence: number | null;
  transfer_match_source: "auto" | "manual" | null;
  is_internal_transfer: boolean;
  created_at: string;
}

export interface Trip {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  destination: string | null;
  notes: string | null;
  default_category_id: number | null;
  created_at: string;
  overrides_count: number;
}

export interface TripCreate {
  name: string;
  start_date: string;
  end_date: string;
  destination?: string | null;
  notes?: string | null;
  default_category_id?: number | null;
}

export interface TripTransactionItem {
  id: number;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  raw_description: string;
  currency: string;
  final_category_id: number | null;
  final_category_name: string | null;
  predicted_category_id: number | null;
  predicted_category_name: string | null;
  membership: "include" | "exclude";
  membership_source: "auto" | "manual_override" | "suggestion_applied";
  suggested_membership: "include" | "exclude" | "review" | null;
  suggestion_score: number | null;
  suggestion_reasons: string[];
}

export interface TripMembershipSuggestion {
  transaction_id: number;
  suggested_membership: "include" | "exclude" | "review";
  score: number;
  reasons: string[];
  is_applied: boolean;
}

export interface TransactionManualCreate {
  account_id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  merchant?: string | null;
  raw_description?: string | null;
  currency?: string;
}

export interface TransactionUpdate {
  merchant?: string | null;
  description?: string | null;
  raw_description?: string | null;
  date?: string | null;
  amount?: number | null;
  currency?: string | null;
  transaction_kind?: "income" | "expense" | "transfer" | "adjustment" | null;
  transfer_group_id?: string | null;
  transfer_linked_transaction_id?: number | null;
  transfer_confidence?: number | null;
  transfer_match_source?: "auto" | "manual" | null;
  is_internal_transfer?: boolean | null;
}

export interface SuggestFieldUpdateCandidate {
  transaction_id: number;
  score: number;
  reason: string;
  reasons: string[];
  matched_fields: string[];
  score_components: Record<string, number>;
  is_classified: boolean;
  current_merchant: string;
  current_description: string;
  current_raw_description: string;
  suggested_merchant: string | null;
  suggested_description: string | null;
  suggested_raw_description: string | null;
  ml_suggested_merchant: string | null;
  ml_merchant_confidence: number | null;
  ml_suggested_description: string | null;
  ml_description_confidence: number | null;
}

export interface BulkUpdateFieldsResponse {
  updated: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  updated_classified: number;
}

export interface ParsingRule {
  id: number;
  name: string;
  enabled: boolean;
  priority: number;
  import_profile_id: number | null;
  operator_token: string | null;
  match_regex: string;
  merchant_group: number;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TransactionBounds {
  min_date: string | null;
  max_date: string | null;
  min_amount: number | null;
  max_amount: number | null;
}

export interface ImportResult {
  batch_id: number;
  filename: string;
  transactions_imported: number;
  duplicates_skipped: number;
  account_id: number;
}

export interface Dashboard {
  total_income: number;
  total_expenses: number;
  net: number;
  spending_by_category: {
    category_id: number;
    category_name: string;
    total: number;
    count: number;
  }[];
  classification_stats: {
    total_transactions: number;
    classified: number;
    unclassified: number;
    auto_classified: number;
    manually_classified: number;
  };
}

export interface MonthlyTotals {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface AnalyticsCategoryAmount {
  category_id: number;
  category_name: string;
  total: number;
}

export interface AnalyticsTimeseriesPoint {
  period: string;
  income: number;
  expenses: number;
  net: number;
  categories: AnalyticsCategoryAmount[];
}

export interface SankeyNode {
  id: string;
  label: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface OutlierItem {
  transaction_id: number;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  category_id: number | null;
  category_name: string | null;
  score: number;
  reason: string;
}

export interface MerchantRankingItem {
  merchant: string;
  total_spend: number;
  count: number;
}

export interface NetWorthItem {
  account_id: number;
  account_name: string;
  account_group: string;
  balance: number;
}

export interface ExternalAccount {
  id: number;
  name: string;
  account_type: string;
  account_group: "asset" | "liability" | string;
  currency: string;
  owner: string;
  person_id: number | null;
  notes: string;
  is_active: boolean;
  ticker: string | null;
  asset_class: string | null;
  pricing_provider: string | null;
  last_price_sync_at: string | null;
  created_at: string;
}

export interface ExternalValuationSnapshot {
  id: number;
  external_account_id: number;
  snapshot_date: string;
  value: number;
  source: string;
  confidence: number | null;
  notes: string;
  created_at: string;
}

export interface ExternalFundingLink {
  id: number;
  external_account_id: number;
  transaction_id: number;
  linked_amount: number;
  link_type: "funding_in" | "funding_out" | string;
  notes: string;
  created_at: string;
}

export interface ExternalReconciliation {
  external_account_id: number;
  latest_value: number | null;
  linked_funding_total: number;
  unlinked_component: number | null;
  links_count: number;
}

export interface ExternalFundingSummary {
  funding_in_total: number;
  funding_out_total: number;
  net_external_flow: number;
  links_count: number;
}

export interface ExternalNetWorthItem {
  external_account_id: number;
  account_name: string;
  account_group: string;
  latest_value: number;
  linked_funding_total: number;
  unlinked_component: number | null;
}

export interface Budget {
  id: number;
  name: string;
  category_id: number | null;
  amount_limit: number;
  period: "monthly" | "weekly" | "yearly";
  is_active: boolean;
  created_at: string;
}

export interface BudgetStatus {
  budget_id: number;
  name: string;
  category_id: number | null;
  category_name: string | null;
  amount_limit: number;
  spent: number;
  remaining: number;
  ratio: number;
  period: string;
}

export interface MlStatus {
  is_trained: boolean;
  training_samples: number;
  min_samples_required: number;
  training_progress_pct?: number;
  ready_to_train?: boolean;
  model_state?: "collecting_data" | "trained" | "stale" | string;
  last_trained_at?: string | null;
  current_accuracy?: number | null;
  trained_num_samples?: number | null;
  trained_num_classes?: number | null;
  samples_since_last_train?: number;
  retrain_threshold?: number;
  needs_retrain?: boolean;
}

export interface UserOverride {
  id: number;
  pattern: string;
  category_id: number;
  is_regex: boolean;
  priority: number;
}

export interface RuleCondition {
  id?: number;
  rule_id?: number;
  field: "description" | "merchant" | "amount";
  operator:
    | "contains"
    | "not_contains"
    | "equals"
    | "starts_with"
    | "gt"
    | "lt"
    | "gte"
    | "lte";
  value: string;
}

export interface Rule {
  id: number;
  name: string;
  category_id: number;
  logic: "AND" | "OR";
  priority: number;
  enabled: boolean;
  conditions: RuleCondition[];
}

export interface SimilarTransactionCandidate {
  transaction_id: number;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  score: number;
  reason: string;
  predicted_category_id: number | null;
  final_category_id: number | null;
}

export interface ImportProfile {
  id: number;
  name: string;
  format: string;
  delimiter: string | null;
  date_column: string;
  amount_column: string;
  currency_column: string | null;
  merchant_columns: string[];
  description_columns: string[];
  enabled: boolean;
}

export interface TransactionRaw {
  raw_row_json: string | null;
  raw_row_line: string | null;
}

export interface TransferCandidate {
  transaction_id: number;
  candidate_id: number;
  transaction_date: string;
  candidate_date: string;
  transaction_amount: number;
  candidate_amount: number;
  transaction_account_id: number;
  candidate_account_id: number;
  transaction_currency: string;
  candidate_currency: string;
  score: number;
  reason: string;
}

export const api = {
  getAccounts: () => request<Account[]>("/accounts/"),
  createAccount: (data: Partial<Account>) =>
    request<Account>("/accounts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAccount: (id: number, data: Partial<Account>) =>
    request<Account>(`/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getPersons: () => request<Person[]>("/persons/"),
  createPerson: (data: { name: string }) =>
    request<Person>("/persons/", { method: "POST", body: JSON.stringify(data) }),
  updatePerson: (id: number, data: { name: string }) =>
    request<Person>(`/persons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePerson: (id: number) => request<void>(`/persons/${id}`, { method: "DELETE" }),

  getCategories: () => request<Category[]>("/categories/"),
  getCategoryTree: () => request<Category[]>("/categories/tree"),
  createCategory: (data: CategoryCreate) =>
    request<Category>("/categories/", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: number, data: CategoryCreate) =>
    request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  getTransactions: (params: {
    page?: number;
    page_size?: number;
    account_id?: number;
    person_id?: number;
    classified?: boolean;
    q?: string;
    merchant?: string;
    category_id?: number;
    category_ids?: number[];
    start_date?: string;
    end_date?: string;
    trip_id?: number;
    min_amount?: number;
    max_amount?: number;
    transaction_kind?: "income" | "expense" | "transfer" | "adjustment";
    include_transfers?: boolean;
    sort_by?: "date" | "amount" | "merchant" | "description" | "category";
    sort_dir?: "asc" | "desc";
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.page_size)
      searchParams.set("page_size", String(params.page_size));
    if (params.account_id)
      searchParams.set("account_id", String(params.account_id));
    if (params.person_id)
      searchParams.set("person_id", String(params.person_id));
    if (params.classified !== undefined)
      searchParams.set("classified", String(params.classified));
    if (params.q) searchParams.set("q", params.q);
    if (params.merchant) searchParams.set("merchant", params.merchant);
    if (params.category_id) searchParams.set("category_id", String(params.category_id));
    if (params.category_ids?.length) searchParams.set("category_ids", params.category_ids.join(","));
    if (params.start_date) searchParams.set("start_date", params.start_date);
    if (params.end_date) searchParams.set("end_date", params.end_date);
    if (params.trip_id) searchParams.set("trip_id", String(params.trip_id));
    if (params.min_amount !== undefined) searchParams.set("min_amount", String(params.min_amount));
    if (params.max_amount !== undefined) searchParams.set("max_amount", String(params.max_amount));
    if (params.transaction_kind) searchParams.set("transaction_kind", params.transaction_kind);
    if (params.include_transfers !== undefined) searchParams.set("include_transfers", String(params.include_transfers));
    if (params.sort_by) searchParams.set("sort_by", params.sort_by);
    if (params.sort_dir) searchParams.set("sort_dir", params.sort_dir);
    return request<TransactionListResponse>(
      `/transactions/?${searchParams.toString()}`
    );
  },

  getTransactionBounds: (params?: { account_id?: number; person_id?: number; classified?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.account_id) qs.set("account_id", String(params.account_id));
    if (params?.person_id) qs.set("person_id", String(params.person_id));
    if (params?.classified !== undefined) qs.set("classified", String(params.classified));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<TransactionBounds>(`/transactions/bounds${suffix}`);
  },

  classifyTransaction: (
    id: number,
    data: { category_id: number; merchant?: string }
  ) =>
    request<Transaction>(`/transactions/${id}/classify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  bulkClassify: (payload: { transaction_ids: number[]; category_id: number; merchant?: string }) =>
    request<{ updated: number; skipped: number }>(`/transactions/bulk-classify`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSimilarTransactions: (id: number, params?: { limit?: number; min_score?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.min_score !== undefined) qs.set("min_score", String(params.min_score));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<SimilarTransactionCandidate[]>(`/transactions/${id}/similar${suffix}`);
  },
  getTransactionRaw: (id: number) => request<TransactionRaw>(`/transactions/${id}/raw`),
  getMerchantSuggestions: (q: string, limit = 20) => {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("limit", String(limit));
    return request<string[]>(`/transactions/merchant-suggestions?${qs.toString()}`);
  },

  createManualTransaction: (payload: TransactionManualCreate) =>
    request<Transaction>(`/transactions/manual`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTransaction: (id: number, payload: TransactionUpdate) =>
    request<Transaction>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getTransferCandidates: (params?: { limit?: number; account_id?: number; person_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.account_id) qs.set("account_id", String(params.account_id));
    if (params?.person_id) qs.set("person_id", String(params.person_id));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<TransferCandidate[]>(`/transactions/transfer-candidates${suffix}`);
  },
  autoLinkTransfers: (limit = 200) =>
    request<{ linked: number; reviewed: number; skipped: number }>(
      `/transactions/transfers/auto-link?limit=${limit}`,
      { method: "POST" }
    ),
  linkTransferPair: (transaction_id: number, candidate_id: number, confidence?: number) =>
    request<{ linked: boolean; transfer_group_id: string | null }>(`/transactions/transfers/link`, {
      method: "POST",
      body: JSON.stringify({ transaction_id, candidate_id, confidence }),
    }),
  unlinkTransfer: (transaction_id: number) =>
    request<{ linked: boolean; transfer_group_id: string | null }>(`/transactions/transfers/unlink`, {
      method: "POST",
      body: JSON.stringify({ transaction_id }),
    }),
  suggestFieldUpdates: (id: number, params?: { limit?: number; min_score?: number; only_unclassified?: boolean; exclude_already_matching?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.min_score !== undefined) qs.set("min_score", String(params.min_score));
    if (params?.only_unclassified !== undefined) qs.set("only_unclassified", String(params.only_unclassified));
    if (params?.exclude_already_matching !== undefined) qs.set("exclude_already_matching", String(params.exclude_already_matching));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<SuggestFieldUpdateCandidate[]>(`/transactions/${id}/suggest-field-updates${suffix}`);
  },
  bulkUpdateFields: (payload: { transaction_ids: number[]; merchant?: string | null; description?: string | null; raw_description?: string | null; allow_classified?: boolean; re_predict?: boolean }) =>
    request<BulkUpdateFieldsResponse>(`/transactions/bulk-update-fields`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createParsingRule: (payload: { name: string; enabled?: boolean; priority?: number; import_profile_id?: number | null; operator_token?: string | null; match_regex: string; merchant_group?: number }) =>
    request<ParsingRule>(`/parsing-rules/`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  uploadFile: async (
    file: File,
    accountId: number,
    importProfileId?: number | null
  ): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const qs = new URLSearchParams();
    qs.set("account_id", String(accountId));
    if (importProfileId) qs.set("import_profile_id", String(importProfileId));
    const res = await fetch(
      `${BASE}/upload/?${qs.toString()}`,
      { method: "POST", body: form }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Upload failed");
    }
    return res.json();
  },

  getImportProfiles: () => request<ImportProfile[]>("/import-profiles/"),
  createImportProfile: (payload: Omit<ImportProfile, "id">) =>
    request<ImportProfile>("/import-profiles/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateImportProfile: (id: number, payload: Partial<Omit<ImportProfile, "id">>) =>
    request<ImportProfile>(`/import-profiles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteImportProfile: (id: number) =>
    request<{ deleted: boolean }>(`/import-profiles/${id}`, { method: "DELETE" }),

  getDashboard: (params?: { accountId?: number; personId?: number; month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.month) qs.set("month", params.month);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Dashboard>(`/dashboard/${suffix}`);
  },
  getMonthlyDashboard: (months = 6, accountId?: number, personId?: number) => {
    const params = new URLSearchParams();
    params.set("months", String(months));
    if (accountId) params.set("account_id", String(accountId));
    if (personId) params.set("person_id", String(personId));
    return request<{ months: MonthlyTotals[] }>(`/dashboard/monthly?${params.toString()}`);
  },

  getMlStatus: () => request<MlStatus>("/ml/status"),
  retrain: () => request<Record<string, unknown>>("/ml/retrain", { method: "POST" }),

  classifyAll: () =>
    request<{ processed: number }>("/transactions/classify-all", {
      method: "POST",
    }),

  getOverrides: () => request<UserOverride[]>("/overrides/"),
  createOverride: (data: Omit<UserOverride, "id">) =>
    request<UserOverride>("/overrides/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOverride: (id: number, data: Partial<Omit<UserOverride, "id">>) =>
    request<UserOverride>(`/overrides/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteOverride: (id: number) =>
    request<void>(`/overrides/${id}`, { method: "DELETE" }),
  testOverride: (id: number, description: string) =>
    request<{ matches: boolean }>(`/overrides/${id}/test`, {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  getRules: () => request<Rule[]>("/rules/"),
  createRule: (data: Omit<Rule, "id">) =>
    request<Rule>("/rules/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRule: (id: number, data: Partial<Omit<Rule, "id">>) =>
    request<Rule>(`/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRule: (id: number) => request<void>(`/rules/${id}`, { method: "DELETE" }),
  toggleRule: (id: number, enabled: boolean) =>
    request<Rule>(`/rules/${id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  testRule: (id: number, payload: { description: string; merchant: string; amount: number }) =>
    request<{ matches: boolean }>(`/rules/${id}/test`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getUncategorizedTitles: (limit = 20) =>
    request<string[]>(`/suggestions/uncategorized-titles?limit=${limit}`),

  getAnalyticsTimeseries: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    categoryIds?: number[];
    granularity?: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
    includeTransfers?: boolean;
    tripId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.categoryIds?.length) qs.set("category_ids", params.categoryIds.join(","));
    if (params?.granularity) qs.set("granularity", params.granularity);
    if (params?.includeTransfers !== undefined) qs.set("include_transfers", String(params.includeTransfers));
    if (params?.tripId) qs.set("trip_id", String(params.tripId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ points: AnalyticsTimeseriesPoint[] }>(`/analytics/timeseries${suffix}`);
  },
  getCategoryBreakdown: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    categoryIds?: number[];
    includeTransfers?: boolean;
    tripId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.categoryIds?.length) qs.set("category_ids", params.categoryIds.join(","));
    if (params?.includeTransfers !== undefined) qs.set("include_transfers", String(params.includeTransfers));
    if (params?.tripId) qs.set("trip_id", String(params.tripId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: AnalyticsCategoryAmount[] }>(`/analytics/category-breakdown${suffix}`);
  },
  getSankey: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    categoryIds?: number[];
    includeTransfers?: boolean;
    tripId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.categoryIds?.length) qs.set("category_ids", params.categoryIds.join(","));
    if (params?.includeTransfers !== undefined) qs.set("include_transfers", String(params.includeTransfers));
    if (params?.tripId) qs.set("trip_id", String(params.tripId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ nodes: SankeyNode[]; links: SankeyLink[] }>(`/analytics/sankey${suffix}`);
  },
  getOutliers: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    categoryIds?: number[];
    limit?: number;
    includeTransfers?: boolean;
    tripId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.categoryIds?.length) qs.set("category_ids", params.categoryIds.join(","));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.includeTransfers !== undefined) qs.set("include_transfers", String(params.includeTransfers));
    if (params?.tripId) qs.set("trip_id", String(params.tripId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: OutlierItem[] }>(`/analytics/outliers${suffix}`);
  },
  getMerchantRanking: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    categoryIds?: number[];
    limit?: number;
    includeTransfers?: boolean;
    tripId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.categoryIds?.length) qs.set("category_ids", params.categoryIds.join(","));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.includeTransfers !== undefined) qs.set("include_transfers", String(params.includeTransfers));
    if (params?.tripId) qs.set("trip_id", String(params.tripId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: MerchantRankingItem[] }>(`/analytics/merchant-ranking${suffix}`);
  },
  getNetWorth: (personId?: number) => {
    const qs = new URLSearchParams();
    if (personId) qs.set("person_id", String(personId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{
      items: NetWorthItem[];
      totals_by_group: Record<string, number>;
      external_items: ExternalNetWorthItem[];
      external_totals_by_group: Record<string, number>;
      external_reconciliation_summary: {
        linked_total: number;
        latest_value_total: number;
        unlinked_total: number;
      } | null;
    }>(
      `/analytics/net-worth${suffix}`
    );
  },
  getExternalAccounts: (personId?: number) => {
    const qs = new URLSearchParams();
    if (personId) qs.set("person_id", String(personId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<ExternalAccount[]>(`/external-accounts/${suffix}`);
  },
  createExternalAccount: (payload: Partial<ExternalAccount>) =>
    request<ExternalAccount>("/external-accounts/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateExternalAccount: (id: number, payload: Partial<ExternalAccount>) =>
    request<ExternalAccount>(`/external-accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getExternalSnapshots: (externalAccountId: number) =>
    request<ExternalValuationSnapshot[]>(`/external-accounts/${externalAccountId}/snapshots`),
  createExternalSnapshot: (
    externalAccountId: number,
    payload: {
      snapshot_date: string;
      value: number;
      source?: string;
      confidence?: number | null;
      notes?: string;
    }
  ) =>
    request<ExternalValuationSnapshot>(`/external-accounts/${externalAccountId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getExternalFundingLinks: (externalAccountId: number) =>
    request<ExternalFundingLink[]>(`/external-accounts/${externalAccountId}/funding-links`),
  createExternalFundingLink: (
    externalAccountId: number,
    payload: {
      transaction_id: number;
      linked_amount: number;
      link_type?: string;
      notes?: string;
      override_validation?: boolean;
    }
  ) =>
    request<ExternalFundingLink>(`/external-accounts/${externalAccountId}/funding-links`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteExternalFundingLink: (externalAccountId: number, linkId: number) =>
    request<void>(`/external-accounts/${externalAccountId}/funding-links/${linkId}`, {
      method: "DELETE",
    }),
  getExternalReconciliation: (externalAccountId: number) =>
    request<ExternalReconciliation>(`/external-accounts/${externalAccountId}/reconciliation`),
  getExternalFundingSummary: (params?: {
    month?: string;
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.month) qs.set("month", params.month);
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<ExternalFundingSummary>(`/external-accounts/funding-summary${suffix}`);
  },
  getRecurring: (params?: {
    startDate?: string;
    endDate?: string;
    accountId?: number;
    personId?: number;
    minOccurrences?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.personId) qs.set("person_id", String(params.personId));
    if (params?.minOccurrences) qs.set("min_occurrences", String(params.minOccurrences));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: { merchant: string; occurrences: number; avg_interval_days: number; avg_amount: number; last_seen: string; transaction_ids: number[] }[] }>(`/analytics/recurring${suffix}`);
  },
  getBudgets: () => request<Budget[]>("/budgets/"),
  createBudget: (payload: Omit<Budget, "id" | "created_at">) =>
    request<Budget>("/budgets/", { method: "POST", body: JSON.stringify(payload) }),
  updateBudget: (id: number, payload: Partial<Omit<Budget, "id" | "created_at">>) =>
    request<Budget>(`/budgets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBudget: (id: number) => request<{ deleted: boolean }>(`/budgets/${id}`, { method: "DELETE" }),
  getBudgetStatus: () => request<BudgetStatus[]>("/budgets/status"),

  getTrips: () => request<Trip[]>("/trips/"),
  createTrip: (payload: TripCreate) =>
    request<Trip>("/trips/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTrip: (id: number, payload: Partial<TripCreate>) =>
    request<Trip>(`/trips/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTrip: (id: number) => request<void>(`/trips/${id}`, { method: "DELETE" }),
  getTripTransactions: (id: number, q?: string) => {
    const qs = new URLSearchParams();
    if (q?.trim()) qs.set("q", q.trim());
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: TripTransactionItem[]; total: number }>(
      `/trips/${id}/transactions${suffix}`
    );
  },
  setTripOverride: (tripId: number, transactionId: number, include: boolean) =>
    request<Trip>(`/trips/${tripId}/overrides`, {
      method: "PUT",
      body: JSON.stringify({ transaction_id: transactionId, include }),
    }),
  clearTripOverride: (tripId: number, transactionId: number) =>
    request<Trip>(`/trips/${tripId}/overrides/${transactionId}`, {
      method: "DELETE",
    }),
  recomputeTripSuggestions: (tripId: number, force = false) =>
    request<{ created_or_updated: number; skipped_manual_overrides: number }>(
      `/trips/${tripId}/suggestions/recompute?force=${String(force)}`,
      { method: "POST" }
    ),
  getTripSuggestions: (tripId: number, bucket?: "include" | "exclude" | "review") => {
    const qs = new URLSearchParams();
    if (bucket) qs.set("bucket", bucket);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<TripMembershipSuggestion[]>(`/trips/${tripId}/suggestions${suffix}`);
  },
  applyTripSuggestions: (
    tripId: number,
    payload: {
      transaction_ids?: number[];
      bucket?: "include" | "exclude" | "review";
      apply_bucket?: boolean;
      include_review_as?: "include" | "exclude";
    }
  ) =>
    request<{ applied: number; skipped: number }>(`/trips/${tripId}/suggestions/apply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetTripSuggestions: (tripId: number, onlyUnapplied = true) =>
    request<{ removed: number }>(`/trips/${tripId}/suggestions/reset`, {
      method: "POST",
      body: JSON.stringify({ only_unapplied: onlyUnapplied }),
    }),
};
