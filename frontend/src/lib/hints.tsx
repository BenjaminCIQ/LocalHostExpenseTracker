import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const HINTS_STORAGE_KEY = "helpful_hints_enabled";

export function getHintsEnabled(): boolean {
  try {
    return localStorage.getItem(HINTS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistHintsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HINTS_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

export type HintContent = {
  label: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
};

/** Page hints: path or special key "theme" for the Theme panel. */
const PAGE_HINTS: Record<string, HintContent> = {
  "/": {
    label: "Dashboard",
    description:
      "Your overview of finances at a glance. Widgets and filters let you see balances, recent activity, and quick links. Customize the layout to focus on what matters most.",
    actionLabel: "Go to Dashboard",
    actionTo: "/",
  },
  "/transactions": {
    label: "Transactions",
    description:
      "Your transaction list lives here. After you add bank accounts and import data, you'll see everything in one place—filter by date, account, or category, and search by description or amount.",
    actionLabel: "Go to Transactions",
    actionTo: "/transactions",
  },
  "/accounts": {
    label: "Bank Accounts",
    description:
      "Add and manage the bank accounts you import from. Each account has its own balance and transaction history. You'll need at least one account before you can import.",
    actionLabel: "Go to Bank Accounts",
    actionTo: "/accounts",
  },
  "/external-accounts": {
    label: "External Accounts",
    description:
      "Track balances that aren't in your main bank—savings, investments, or other accounts. Enter manual balances or link feeds. Used for net worth and funding flow so you see the full picture.",
    actionLabel: "Go to External Accounts",
    actionTo: "/external-accounts",
  },
  "/categories": {
    label: "Categories",
    description:
      "Categories (e.g. Food, Transport, Income) organize how you see spending and earnings. Transactions are assigned to categories so your analytics and budgets make sense. You can create, edit, and reorder them here.",
    actionLabel: "Go to Categories",
    actionTo: "/categories",
  },
  "/classification": {
    label: "Classification",
    description:
      "Define rules and overrides so transactions get the right category automatically. Set patterns by description, amount, or payee so future imports are categorized without extra work.",
    actionLabel: "Go to Classification",
    actionTo: "/classification",
  },
  "/transfer-linking-rules": {
    label: "Transfer Linking Rules",
    description:
      "When money moves between your own accounts (e.g. checking to savings), link those transactions as transfers. That way they're counted once in analytics instead of as income and expense.",
    actionLabel: "Go to Transfer Linking Rules",
    actionTo: "/transfer-linking-rules",
  },
  "/import": {
    label: "Import",
    description:
      "Upload a CSV of transactions from your bank. Importing is the first step to see your finances in the app; you can map columns and assign an account before saving. Use the Profiles tab to save mappings.",
    actionLabel: "Go to Import",
    actionTo: "/import",
  },
  "/ml": {
    label: "ML Status",
    description:
      "The app can learn from how you categorize and suggest categories for new transactions. This page shows training status and when suggestions will start appearing.",
    actionLabel: "Go to ML Status",
    actionTo: "/ml",
  },
  "/analytics": {
    label: "Analytics",
    description:
      "Spending trends, category breakdowns, and insights over time. Most useful once you have some categorized transactions. See where money goes, compare periods, and spot patterns.",
    actionLabel: "Go to Analytics",
    actionTo: "/analytics",
  },
  "/budgets": {
    label: "Budgets",
    description:
      "Set and track budgets by category or custom groups. See how spending compares to your targets and get a clear view of what's left for the period.",
    actionLabel: "Go to Budgets",
    actionTo: "/budgets",
  },
  "/trips": {
    label: "Trips",
    description:
      "Track spending and transactions by trip. Useful for travel or project-based budgeting. Create trips and assign transactions to see totals per trip.",
    actionLabel: "Go to Trips",
    actionTo: "/trips",
  },
  "/people": {
    label: "People",
    description:
      "Manage people (users) who can access this expense tracker. Invite others, set roles, and control who sees which data.",
    actionLabel: "Go to People",
    actionTo: "/people",
  },
  "/admin": {
    label: "Admin Console",
    description:
      "Administrative tools: security events, system health, and configuration. Restricted to admin users.",
    actionLabel: "Go to Admin",
    actionTo: "/admin",
  },
  theme: {
    label: "Themes",
    description:
      "Change how the app looks. Open the Theme panel here in the sidebar to pick a color theme. Your choice is saved so the app stays in your preferred style.",
    actionLabel: "Open theme panel below",
  },
};

/** Button hints: stable id for key actions. */
export type ButtonHintId =
  | "add-transaction"
  | "import-data"
  | "transfer-review"
  | "duplicates"
  | "run-ml-unclassified"
  | "import-profiles"
  | "add-valuation-snapshot"
  | "link-transfer"
  | "add-account"
  | "add-external-account"
  | "upload-csv";

const BUTTON_HINTS: Record<ButtonHintId, HintContent> = {
  "add-transaction": {
    label: "Add transaction",
    description:
      "Create a single transaction manually. Useful for one-off entries, corrections, or when you don't have a CSV. You can set date, amount, description, category, and account.",
    actionLabel: "Add transaction",
  },
  "import-data": {
    label: "Import Data",
    description:
      "Open the Import page to upload a CSV of transactions from your bank. You'll map columns, pick an account, and import in bulk. Use saved profiles to repeat imports quickly.",
    actionLabel: "Go to Import",
    actionTo: "/import",
  },
  "transfer-review": {
    label: "Transfer Review",
    description:
      "Find and link transfers between your accounts (e.g. moving money from checking to savings). Linking them avoids double-counting in analytics and keeps balances correct.",
    actionLabel: "Open Transfer Review",
  },
  duplicates: {
    label: "Duplicates",
    description:
      "Spot potential duplicate transactions (same amount, date, or description). Review and merge or dismiss so your data stays clean.",
    actionLabel: "View Duplicates",
  },
  "run-ml-unclassified": {
    label: "Run ML on Unclassified",
    description:
      "Use the trained model to suggest categories for transactions that don't have one yet. Run this after importing or when you've added new categorizations.",
    actionLabel: "Run ML",
  },
  "import-profiles": {
    label: "Import Profiles",
    description:
      "Save and reuse column mappings and import settings. Create a profile once, then use it for future imports from the same source to save time.",
    actionLabel: "Go to Import Profiles",
    actionTo: "/import",
  },
  "add-valuation-snapshot": {
    label: "Add valuation snapshot",
    description:
      "Record the current balance or value of an external account (e.g. investment or savings). Snapshots over time show how the balance changes for net worth and funding flow.",
    actionLabel: "Add snapshot",
  },
  "link-transfer": {
    label: "Link transfer",
    description:
      "Link an external-account transaction to an internal transfer. Connects money moving in or out of this account to the corresponding transaction in your bank accounts.",
    actionLabel: "Link transfer",
  },
  "add-account": {
    label: "Add account",
    description:
      "Create a new bank account. You'll need at least one account before importing transactions. Each account has its own balance and history.",
    actionLabel: "Add account",
  },
  "add-external-account": {
    label: "Add External Account",
    description:
      "Create an external account to track investments, savings, or other balances outside your main bank. You can add valuation snapshots and link funding transfers.",
    actionLabel: "Add external account",
  },
  "upload-csv": {
    label: "Upload CSV",
    description:
      "Select a CSV file from your computer to import transactions. The next step will let you map columns to date, amount, description, and category.",
    actionLabel: "Upload",
  },
};

export function getPageHint(path: string): HintContent | undefined {
  return PAGE_HINTS[path];
}

export function getButtonHint(buttonId: ButtonHintId): HintContent | undefined {
  return BUTTON_HINTS[buttonId];
}

/** All paths that have a page hint (for sidebar). */
export function getPageHintPaths(): string[] {
  return Object.keys(PAGE_HINTS).filter((k) => k.startsWith("/"));
}

type HintsContextValue = {
  hintsEnabled: boolean;
  setHintsEnabled: (enabled: boolean) => void;
};

const HintsContext = createContext<HintsContextValue | null>(null);

export function HintsProvider({ children }: { children: ReactNode }) {
  const [hintsEnabled, setHintsEnabledState] = useState(getHintsEnabled);

  const setHintsEnabled = useCallback((enabled: boolean) => {
    setHintsEnabledState(enabled);
    persistHintsEnabled(enabled);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === HINTS_STORAGE_KEY && e.newValue !== null)
        setHintsEnabledState(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value: HintsContextValue = { hintsEnabled, setHintsEnabled };

  return (
    <HintsContext.Provider value={value}>{children}</HintsContext.Provider>
  );
}

export function useHintsEnabled(): boolean {
  const ctx = useContext(HintsContext);
  return ctx?.hintsEnabled ?? false;
}

export function useHintsContext(): HintsContextValue | null {
  return useContext(HintsContext);
}
