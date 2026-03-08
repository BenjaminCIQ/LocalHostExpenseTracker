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

export const api = {
  getAccounts: () => request<Account[]>("/accounts/"),
  createAccount: (data: Partial<Account>) =>
    request<Account>("/accounts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCategories: () => request<Category[]>("/categories/"),
  getCategoryTree: () => request<Category[]>("/categories/tree"),

  getTransactions: (params: {
    page?: number;
    page_size?: number;
    account_id?: number;
    classified?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", String(params.page));
    if (params.page_size)
      searchParams.set("page_size", String(params.page_size));
    if (params.account_id)
      searchParams.set("account_id", String(params.account_id));
    if (params.classified !== undefined)
      searchParams.set("classified", String(params.classified));
    return request<TransactionListResponse>(
      `/transactions/?${searchParams.toString()}`
    );
  },

  classifyTransaction: (
    id: number,
    data: { category_id: number; merchant?: string }
  ) =>
    request<Transaction>(`/transactions/${id}/classify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

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

  getDashboard: (accountId?: number) => {
    const params = accountId ? `?account_id=${accountId}` : "";
    return request<Dashboard>(`/dashboard/${params}`);
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
};
