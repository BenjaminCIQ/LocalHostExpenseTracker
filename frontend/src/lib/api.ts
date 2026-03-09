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
  currency: string;
  owner: string;
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
  created_at: string;
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
}

export interface SuggestFieldUpdateCandidate {
  transaction_id: number;
  score: number;
  reason: string;
  current_merchant: string;
  current_description: string;
  current_raw_description: string;
  suggested_merchant: string | null;
  suggested_description: string | null;
  suggested_raw_description: string | null;
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

export interface MlStatus {
  is_trained: boolean;
  training_samples: number;
  min_samples_required: number;
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
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
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
    if (params.start_date) searchParams.set("start_date", params.start_date);
    if (params.end_date) searchParams.set("end_date", params.end_date);
    if (params.min_amount !== undefined) searchParams.set("min_amount", String(params.min_amount));
    if (params.max_amount !== undefined) searchParams.set("max_amount", String(params.max_amount));
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
  suggestFieldUpdates: (id: number, params?: { limit?: number; min_score?: number; only_unclassified?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.min_score !== undefined) qs.set("min_score", String(params.min_score));
    if (params?.only_unclassified !== undefined) qs.set("only_unclassified", String(params.only_unclassified));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<SuggestFieldUpdateCandidate[]>(`/transactions/${id}/suggest-field-updates${suffix}`);
  },
  bulkUpdateFields: (payload: { transaction_ids: number[]; merchant?: string | null; description?: string | null; raw_description?: string | null; re_predict?: boolean }) =>
    request<{ updated: number; skipped: number }>(`/transactions/bulk-update-fields`, {
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
};
