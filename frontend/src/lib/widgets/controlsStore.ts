import type {
  GlobalControlState,
  PageId,
  WidgetControlState,
} from "@/lib/widgets/types";

const SCHEMA_VERSION = 1;

const GLOBAL_KEY_PREFIX = "widget-global-controls";
const WIDGET_KEY_PREFIX = "widget-controls";

type Persisted<T> = {
  schemaVersion: number;
  savedAt: string;
  data: T;
};

const defaultGlobalControls: GlobalControlState = {
  dateWindow: "ALL",
  granularity: "auto",
  scope: "household",
  valueMode: "absolute",
  excludeTripIncluded: false,
  excludedTripIds: [],
};

function globalKey(page: PageId) {
  return `${GLOBAL_KEY_PREFIX}-${page}`;
}

function widgetKey(page: PageId, widgetId: string) {
  return `${WIDGET_KEY_PREFIX}-${page}-${widgetId}`;
}

function safeParse<T>(raw: string | null): Persisted<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Persisted<T>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.schemaVersion !== "number" ||
      typeof parsed.savedAt !== "string" ||
      !("data" in parsed)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persist<T>(key: string, data: T) {
  const payload: Persisted<T> = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    data,
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

export function getDefaultGlobalControls(): GlobalControlState {
  return { ...defaultGlobalControls };
}

export function loadGlobalControls(page: PageId): GlobalControlState {
  const parsed = safeParse<GlobalControlState>(localStorage.getItem(globalKey(page)));
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
    return getDefaultGlobalControls();
  }
  return { ...defaultGlobalControls, ...parsed.data };
}

export function saveGlobalControls(page: PageId, controls: GlobalControlState) {
  persist(globalKey(page), controls);
}

export function resetGlobalControls(page: PageId) {
  localStorage.removeItem(globalKey(page));
}

export function loadWidgetControls(
  page: PageId,
  widgetId: string
): WidgetControlState {
  const parsed = safeParse<WidgetControlState>(
    localStorage.getItem(widgetKey(page, widgetId))
  );
  if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
    return {};
  }
  return parsed.data ?? {};
}

export function saveWidgetControls(
  page: PageId,
  widgetId: string,
  controls: WidgetControlState
) {
  persist(widgetKey(page, widgetId), controls);
}

export function resetWidgetControls(page: PageId, widgetId: string) {
  localStorage.removeItem(widgetKey(page, widgetId));
}
