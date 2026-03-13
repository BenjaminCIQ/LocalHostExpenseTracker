import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getDefaultGlobalControls,
  loadGlobalControls,
  resetGlobalControls,
  saveGlobalControls,
} from "@/lib/widgets/controlsStore";
import { useAuth } from "@/lib/auth";
import { getSelectedPersonId } from "@/lib/personFilter";
import type {
  DashboardFilters,
  DateWindowPreset,
  GlobalControlState,
  PageId,
} from "@/lib/widgets/types";

interface DashboardFiltersState {
  filters: DashboardFilters;
  globalControls: GlobalControlState;
  setMonth: (month: string | null) => void;
  setDateRange: (start: string | null, end: string | null) => void;
  setDateWindow: (preset: DateWindowPreset) => void;
  setGlobalGranularity: (granularity: GlobalControlState["granularity"]) => void;
  setScope: (scope: GlobalControlState["scope"]) => void;
  setValueMode: (mode: GlobalControlState["valueMode"]) => void;
  setExcludeTripIncluded: (enabled: boolean) => void;
  setExcludedTripIds: (tripIds: number[]) => void;
  resetGlobal: () => void;
  setPersonId: (personId: number | null) => void;
  setAccountId: (accountId: number | null) => void;
  setCategoryIds: (categoryIds: number[]) => void;
}

const DashboardFiltersContext = createContext<DashboardFiltersState | null>(null);

function getDefaultFilters(): DashboardFilters {
  return {
    dateRange: { start: null, end: null },
    month: null,
    personId: getSelectedPersonId(),
    accountId: null,
    categoryIds: [],
  };
}

function toDateIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dateWindowToRange(preset: DateWindowPreset): {
  start: string | null;
  end: string | null;
} {
  const today = new Date();
  if (preset === "ALL") return { start: null, end: null };
  if (preset === "YTD") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { start: toDateIso(start), end: toDateIso(today) };
  }
  const dayMap: Record<Exclude<DateWindowPreset, "ALL" | "YTD">, number> = {
    "7D": 7,
    "30D": 30,
    "90D": 90,
    "1Y": 365,
  };
  const delta = dayMap[preset as Exclude<DateWindowPreset, "ALL" | "YTD">] ?? 30;
  const start = new Date(today);
  start.setDate(start.getDate() - delta);
  return { start: toDateIso(start), end: toDateIso(today) };
}

export function DashboardFiltersProvider({
  pageId,
  children,
}: {
  pageId: PageId;
  children: ReactNode;
}) {
  const { person } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(() => getDefaultFilters());
  const [globalControls, setGlobalControls] = useState<GlobalControlState>(() =>
    loadGlobalControls(pageId)
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      saveGlobalControls(pageId, globalControls);
    }, 200);
    return () => window.clearTimeout(id);
  }, [globalControls, pageId]);

  // Ensure filters have personId as soon as auth person is available (fixes empty first load)
  useEffect(() => {
    if (!person) return;
    const selected = getSelectedPersonId();
    if (selected !== null) return; // already have a selection (e.g. from localStorage)
    localStorage.setItem("selected_person_id", String(person.id));
    window.dispatchEvent(new Event("person-filter-changed"));
    setFilters((prev) => ({ ...prev, personId: person.id, accountId: null }));
  }, [person?.id]);

  useEffect(() => {
    const syncFromTopbar = () => {
      const selected = getSelectedPersonId();
      setFilters((prev) => {
        if (prev.personId === selected) return prev;
        return { ...prev, personId: selected, accountId: null };
      });
    };
    window.addEventListener("person-filter-changed", syncFromTopbar);
    window.addEventListener("storage", syncFromTopbar);
    return () => {
      window.removeEventListener("person-filter-changed", syncFromTopbar);
      window.removeEventListener("storage", syncFromTopbar);
    };
  }, []);

  const setMonth = useCallback((month: string | null) => {
    setFilters((prev) => ({ ...prev, month }));
  }, []);

  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setFilters((prev) => ({ ...prev, dateRange: { start, end } }));
  }, []);

  const setPersonId = useCallback((personId: number | null) => {
    setFilters((prev) => ({ ...prev, personId }));
  }, []);

  const setAccountId = useCallback((accountId: number | null) => {
    setFilters((prev) => ({ ...prev, accountId }));
  }, []);

  const setCategoryIds = useCallback((categoryIds: number[]) => {
    setFilters((prev) => ({ ...prev, categoryIds }));
  }, []);

  const setDateWindow = useCallback((preset: DateWindowPreset) => {
    setGlobalControls((prev) => ({ ...prev, dateWindow: preset }));
    const range = dateWindowToRange(preset);
    setFilters((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const setGlobalGranularity = useCallback(
    (granularity: GlobalControlState["granularity"]) => {
      setGlobalControls((prev) => ({ ...prev, granularity }));
    },
    []
  );

  const setScope = useCallback((scope: GlobalControlState["scope"]) => {
    setGlobalControls((prev) => ({ ...prev, scope }));
  }, []);

  const setValueMode = useCallback((mode: GlobalControlState["valueMode"]) => {
    setGlobalControls((prev) => ({ ...prev, valueMode: mode }));
  }, []);

  const setExcludeTripIncluded = useCallback((enabled: boolean) => {
    setGlobalControls((prev) => ({ ...prev, excludeTripIncluded: enabled }));
  }, []);

  const setExcludedTripIds = useCallback((tripIds: number[]) => {
    setGlobalControls((prev) => ({ ...prev, excludedTripIds: tripIds }));
  }, []);

  const resetGlobal = useCallback(() => {
    const defaults = getDefaultGlobalControls();
    setGlobalControls(defaults);
    setFilters((prev) => ({ ...prev, dateRange: { start: null, end: null } }));
    resetGlobalControls(pageId);
  }, [pageId]);

  const value = useMemo(
    () => ({
      filters,
      globalControls,
      setMonth,
      setDateRange,
      setDateWindow,
      setGlobalGranularity,
      setScope,
      setValueMode,
      setExcludeTripIncluded,
      setExcludedTripIds,
      resetGlobal,
      setPersonId,
      setAccountId,
      setCategoryIds,
    }),
    [
      filters,
      globalControls,
      resetGlobal,
      setAccountId,
      setCategoryIds,
      setDateRange,
      setDateWindow,
      setGlobalGranularity,
      setMonth,
      setPersonId,
      setScope,
      setValueMode,
      setExcludeTripIncluded,
      setExcludedTripIds,
    ]
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

export function useDashboardFilters() {
  const ctx = useContext(DashboardFiltersContext);
  if (!ctx) {
    throw new Error("useDashboardFilters must be used inside DashboardFiltersProvider");
  }
  return ctx;
}
