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
