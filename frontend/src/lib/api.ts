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
  sort_order: number;
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

export const api = {
  getAccounts: () => request<Account[]>("/accounts/"),
  createAccount: (data: Partial<Account>) =>
    request<Account>("/accounts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

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

  getTransactionBounds: (params?: { account_id?: number; classified?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.account_id) qs.set("account_id", String(params.account_id));
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

  uploadFile: async (file: File, accountId: number): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `${BASE}/upload/?account_id=${accountId}`,
      { method: "POST", body: form }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Upload failed");
    }
    return res.json();
  },

  getDashboard: (params?: { accountId?: number; month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.accountId) qs.set("account_id", String(params.accountId));
    if (params?.month) qs.set("month", params.month);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Dashboard>(`/dashboard/${suffix}`);
  },
  getMonthlyDashboard: (months = 6, accountId?: number) => {
    const params = new URLSearchParams();
    params.set("months", String(months));
    if (accountId) params.set("account_id", String(accountId));
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
