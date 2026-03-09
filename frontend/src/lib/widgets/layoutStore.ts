import type { LayoutEntry, PageId } from "@/lib/widgets/types";

const KEY_PREFIX = "widget-layout";

const pageDefaults: Record<PageId, LayoutEntry[]> = {
  overview: [
    { widgetId: "kpi-cards", size: "full", order: 1 },
    { widgetId: "snapshot", size: "full", order: 2 },
    { widgetId: "monthly-bar", size: "lg", order: 3 },
    { widgetId: "category-pie", size: "lg", order: 4 },
    { widgetId: "top-categories", size: "lg", order: 5 },
    { widgetId: "expense-highlights", size: "lg", order: 6 },
    { widgetId: "person-comparison", size: "full", order: 7 },
    { widgetId: "budget-status", size: "full", order: 8 },
  ],
  analytics: [
    { widgetId: "interactive-category-bar", size: "full", order: 1 },
    { widgetId: "sankey", size: "full", order: 2 },
    { widgetId: "category-trend", size: "full", order: 3 },
    { widgetId: "outlier-panel", size: "lg", order: 4 },
    { widgetId: "spending-heatmap", size: "lg", order: 5 },
    { widgetId: "cashflow-forecast", size: "lg", order: 6 },
    { widgetId: "year-over-year", size: "lg", order: 7 },
    { widgetId: "running-balance", size: "lg", order: 8 },
    { widgetId: "merchant-insights", size: "lg", order: 9 },
    { widgetId: "recurring", size: "lg", order: 10 },
  ],
  budgets: [
    { widgetId: "budget-management", size: "full", order: 1 },
    { widgetId: "budget-status", size: "full", order: 2 },
    { widgetId: "savings-rate", size: "lg", order: 3 },
    { widgetId: "enhanced-pie", size: "lg", order: 4 },
  ],
};

function getKey(page: PageId) {
  return `${KEY_PREFIX}-${page}`;
}

export function loadLayout(page: PageId): LayoutEntry[] {
  const raw = localStorage.getItem(getKey(page));
  if (!raw) return [...pageDefaults[page]];
  try {
    const parsed = JSON.parse(raw) as LayoutEntry[];
    if (!Array.isArray(parsed)) return [...pageDefaults[page]];
    return parsed;
  } catch {
    return [...pageDefaults[page]];
  }
}

export function saveLayout(page: PageId, entries: LayoutEntry[]) {
  localStorage.setItem(getKey(page), JSON.stringify(entries));
}

export function getDefaultLayout(page: PageId): LayoutEntry[] {
  return [...pageDefaults[page]];
}

export function resetLayout(page: PageId) {
  localStorage.removeItem(getKey(page));
}
