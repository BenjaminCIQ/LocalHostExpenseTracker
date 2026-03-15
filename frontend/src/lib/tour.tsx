import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";

const TOUR_STORAGE_KEY = "expense_tracker_tour";
const TOUR_PROMPT_DONE_KEY = "tour_prompt_done";
const TOUR_PROMPT_PENDING_KEY = "tour_prompt_pending";
const TOUR_PROMPT_FROM_KEY = "tour_prompt_from";
const TOUR_START_NEXT_LOAD_KEY = "tour_start_next_load";

export function setTourStartNextLoad() {
  try {
    localStorage.setItem(TOUR_START_NEXT_LOAD_KEY, "1");
  } catch {
    // ignore
  }
}

export const TOUR_STEP_IDS = [
  "transactions",
  "accounts",
  "categories",
  "classification",
  "transfer-linking",
  "ml",
  "import",
  "transactions-after",
  "external-accounts",
  "analytics",
  "themes",
] as const;

export type TourStepId = (typeof TOUR_STEP_IDS)[number];

export const TOUR_STEP_PATHS: Record<TourStepId, string> = {
  transactions: "/transactions",
  accounts: "/accounts",
  categories: "/categories",
  classification: "/classification",
  "transfer-linking": "/transfer-linking-rules",
  ml: "/ml",
  import: "/import",
  "transactions-after": "/transactions",
  "external-accounts": "/external-accounts",
  analytics: "/analytics",
  themes: "/",
};

export const TOUR_STEP_LABELS: Record<TourStepId, string> = {
  transactions: "Transactions",
  accounts: "Bank Accounts",
  categories: "Categories",
  classification: "Classification",
  "transfer-linking": "Transfer Linking Rules",
  ml: "ML Status",
  import: "Import",
  "transactions-after": "View Transactions",
  "external-accounts": "External Accounts",
  analytics: "Analytics",
  themes: "Themes",
};

/** Rich tooltip/panel copy: a short explanation of each page for tour tooltips and the current-step popover. */
export const TOUR_STEP_DESCRIPTIONS: Record<TourStepId, string> = {
  transactions:
    "Your transaction list lives here. To get started, go to Import and upload a CSV (e.g. the docs example files). After you import, you’ll see everything here—filter by date, account, or category, and search by description or amount.",
  accounts:
    "Add and manage the bank accounts you import from. Each account has its own balance and transaction history. You’ll need at least one account before you can import; the tour uses a demo account so you can try it safely.",
  categories:
    "Categories (e.g. Food, Transport, Income) organize how you see spending and earnings. Transactions are assigned to categories so your analytics and budgets make sense. You can create, edit, and reorder them here.",
  classification:
    "Define rules and overrides so transactions get the right category automatically. Set patterns by description, amount, or payee so future imports are categorized without extra work. Saves time and keeps reports accurate.",
  "transfer-linking":
    "When money moves between your own accounts (e.g. checking → savings), link those transactions as transfers. That way they’re counted once in analytics instead of as income and expense, so your totals stay correct.",
  ml: "The app can learn from how you categorize and suggest categories for new transactions. This page shows training status and when suggestions will start appearing. The more you categorize, the better the suggestions.",
  import:
    "Upload a CSV of transactions from your bank. Example files are in your project's docs/ folder (example_MainAcc_mt940.csv, example_savings.csv)—open that folder in the file picker to upload. Use Auto-detect for column mapping; no import profile needed for the docs examples.",
  "transactions-after":
    "Back on the transaction list with your imported data. You can categorize, filter, search, and edit. Use this view to clean up categories and get a feel for how the app works with real (or demo) data.",
  "external-accounts":
    "Track balances that aren’t in your main bank—savings, investments, or other accounts. Enter manual balances or link feeds. Used for net worth and funding flow so you see the full picture.",
  analytics:
    "Spending trends, category breakdowns, and insights over time. Most useful once you have some categorized transactions. See where money goes, compare periods, and spot patterns.",
  themes:
    "Change how the app looks. Open the Theme panel here in the sidebar to pick a color theme. Your choice is saved so the app stays in your preferred style.",
};

/** Path that corresponds to the current tour step (for sidebar highlighting). Themes use "/" but are shown on the Theme panel, not Dashboard. */
export function getTourStepPath(stepId: TourStepId): string {
  return TOUR_STEP_PATHS[stepId];
}

/** Nav paths that are part of the tour (for showing "i" and hover info). Excludes "/" (themes use the Theme panel). */
const TOUR_NAV_PATHS = new Set([
  "/transactions",
  "/accounts",
  "/categories",
  "/classification",
  "/transfer-linking-rules",
  "/ml",
  "/import",
  "/external-accounts",
  "/analytics",
]);

export function isTourNavPath(path: string): boolean {
  return TOUR_NAV_PATHS.has(path);
}

/** First step that uses this path (for hover tooltip). */
export function getStepIdForPath(path: string): TourStepId | undefined {
  const step = (TOUR_STEP_IDS as readonly TourStepId[]).find((id) => TOUR_STEP_PATHS[id] === path);
  return step;
}

type TourState = {
  tourActive: boolean;
  demoAccountIds: number[];
  demoExternalAccountIds: number[];
  completedSteps: TourStepId[];
};

function loadTourState(): Partial<TourState> {
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      tourActive: Boolean(parsed.tourActive),
      demoAccountIds: Array.isArray(parsed.demoAccountIds) ? parsed.demoAccountIds : [],
      demoExternalAccountIds: Array.isArray(parsed.demoExternalAccountIds)
        ? parsed.demoExternalAccountIds
        : [],
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
    };
  } catch {
    return {};
  }
}

function saveTourState(state: TourState) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getTourPromptDone(personId: number | null): boolean {
  if (!personId) return false;
  try {
    return localStorage.getItem(`${TOUR_PROMPT_DONE_KEY}_${personId}`) === "1";
  } catch {
    return false;
  }
}

export function setTourPromptDone(personId: number) {
  try {
    localStorage.setItem(`${TOUR_PROMPT_DONE_KEY}_${personId}`, "1");
  } catch {
    // ignore
  }
}

export function setTourPromptPending(fromPath: string) {
  try {
    localStorage.setItem(TOUR_PROMPT_PENDING_KEY, "1");
    localStorage.setItem(TOUR_PROMPT_FROM_KEY, fromPath);
  } catch {
    // ignore
  }
}

export function getTourPromptPending(): string | null {
  try {
    if (localStorage.getItem(TOUR_PROMPT_PENDING_KEY) !== "1") return null;
    return localStorage.getItem(TOUR_PROMPT_FROM_KEY) || "/";
  } catch {
    return null;
  }
}

export function clearTourPromptPending() {
  try {
    localStorage.removeItem(TOUR_PROMPT_PENDING_KEY);
    localStorage.removeItem(TOUR_PROMPT_FROM_KEY);
  } catch {
    // ignore
  }
}

/** Clear tour state and prompt-done flag so the tour prompt can show again. Call after successful login so a fresh login (e.g. after DB reset) shows the tour prompt. */
export function clearTourLocalStorageOnLogin(personId: number) {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(`${TOUR_PROMPT_DONE_KEY}_${personId}`);
    localStorage.removeItem(TOUR_START_NEXT_LOAD_KEY);
  } catch {
    // ignore
  }
}

/** Clear all tour state and prompt-done flags so the tour prompt can show. Keeps pending/from intact. Use after create-account where personId is not yet known. */
export function clearAllTourLocalStorage() {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    localStorage.removeItem(TOUR_START_NEXT_LOAD_KEY);
    const prefix = `${TOUR_PROMPT_DONE_KEY}_`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

type TourContextValue = {
  tourActive: boolean;
  setTourActive: (active: boolean) => void;
  demoAccountIds: number[];
  demoExternalAccountIds: number[];
  addDemoAccountId: (id: number) => void;
  addDemoExternalAccountId: (id: number) => void;
  completedSteps: TourStepId[];
  isStepCompleted: (step: TourStepId) => boolean;
  markStepCompleted: (step: TourStepId) => void;
  endTour: (deleteDemoData: boolean) => Promise<void>;
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({
  children,
  personId: _personId,
}: {
  children: ReactNode;
  personId: number | null;
}) {
  const [state, setState] = useState<TourState>(() => ({
    tourActive: false,
    demoAccountIds: [],
    demoExternalAccountIds: [],
    completedSteps: [],
  }));

  useEffect(() => {
    const loaded = loadTourState();
    const startNextLoad = typeof localStorage !== "undefined" && localStorage.getItem(TOUR_START_NEXT_LOAD_KEY) === "1";
    if (startNextLoad) {
      try {
        localStorage.removeItem(TOUR_START_NEXT_LOAD_KEY);
      } catch {
        // ignore
      }
    }
    setState((prev) => ({
      ...prev,
      ...loaded,
      tourActive: Boolean(loaded.tourActive) || startNextLoad,
    }));
  }, []);

  useEffect(() => {
    if (!state.tourActive) return;
    saveTourState(state);
  }, [state]);

  const setTourActive = useCallback((active: boolean) => {
    setState((prev) => {
      const next = { ...prev, tourActive: active };
      if (!active) {
        next.demoAccountIds = [];
        next.demoExternalAccountIds = [];
        next.completedSteps = [];
      }
      saveTourState(next);
      return next;
    });
  }, []);

  const addDemoAccountId = useCallback((id: number) => {
    setState((prev) => {
      if (prev.demoAccountIds.includes(id)) return prev;
      const next = {
        ...prev,
        demoAccountIds: [...prev.demoAccountIds, id],
      };
      saveTourState(next);
      return next;
    });
  }, []);

  const addDemoExternalAccountId = useCallback((id: number) => {
    setState((prev) => {
      if (prev.demoExternalAccountIds.includes(id)) return prev;
      const next = {
        ...prev,
        demoExternalAccountIds: [...prev.demoExternalAccountIds, id],
      };
      saveTourState(next);
      return next;
    });
  }, []);

  const isStepCompleted = useCallback(
    (step: TourStepId) => state.completedSteps.includes(step),
    [state.completedSteps]
  );

  const markStepCompleted = useCallback((step: TourStepId) => {
    setState((prev) => {
      if (prev.completedSteps.includes(step)) return prev;
      const next = {
        ...prev,
        completedSteps: [...prev.completedSteps, step],
      };
      saveTourState(next);
      return next;
    });
  }, []);

  const endTour = useCallback(
    async (deleteDemoData: boolean) => {
      if (deleteDemoData && (state.demoAccountIds.length > 0 || state.demoExternalAccountIds.length > 0)) {
        await api.demoCleanup({
          account_ids: state.demoAccountIds,
          external_account_ids: state.demoExternalAccountIds.length
            ? state.demoExternalAccountIds
            : undefined,
        });
      }
      setState({
        tourActive: false,
        demoAccountIds: [],
        demoExternalAccountIds: [],
        completedSteps: [],
      });
      try {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      } catch {
        // ignore
      }
    },
    [state.demoAccountIds, state.demoExternalAccountIds]
  );

  const value = useMemo<TourContextValue>(
    () => ({
      tourActive: state.tourActive,
      setTourActive,
      demoAccountIds: state.demoAccountIds,
      demoExternalAccountIds: state.demoExternalAccountIds,
      addDemoAccountId,
      addDemoExternalAccountId,
      completedSteps: state.completedSteps,
      isStepCompleted,
      markStepCompleted,
      endTour,
    }),
    [
      state.tourActive,
      state.demoAccountIds,
      state.demoExternalAccountIds,
      state.completedSteps,
      setTourActive,
      addDemoAccountId,
      addDemoExternalAccountId,
      isStepCompleted,
      markStepCompleted,
      endTour,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}

export function useTourOptional() {
  return useContext(TourContext);
}
