import type { LayoutEntry, PageId } from "@/lib/widgets/types";

const KEY_PREFIX = "widget-layout";
const LAYOUT_VERSION = 4;

type LegacyLayoutEntry = Pick<LayoutEntry, "widgetId" | "size" | "order">;

interface StoredLayout {
  v: number;
  entries: LayoutEntry[];
}

const pageDefaults: Record<PageId, LegacyLayoutEntry[]> = {
  overview: [
    { widgetId: "kpi-cards", size: "full", order: 1 },
    { widgetId: "snapshot", size: "xl", order: 2 },
    { widgetId: "external-funding-context", size: "lg", order: 3 },
    { widgetId: "net-worth-snapshot", size: "lg", order: 4 },
    { widgetId: "monthly-bar", size: "lg", order: 5 },
    { widgetId: "category-pie", size: "lg", order: 6 },
    { widgetId: "top-categories", size: "lg", order: 7 },
    { widgetId: "expense-highlights", size: "lg", order: 8 },
    { widgetId: "person-comparison", size: "xl", order: 9 },
    { widgetId: "budget-status", size: "xl", order: 10 },
  ],
  analytics: [
    { widgetId: "interactive-category-bar", size: "full", order: 1 },
    { widgetId: "sankey", size: "full", order: 2 },
    { widgetId: "category-trend", size: "xl", order: 3 },
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
    { widgetId: "budget-status", size: "lg", order: 2 },
    { widgetId: "savings-rate", size: "lg", order: 3 },
    { widgetId: "enhanced-pie", size: "lg", order: 4 },
  ],
};

function getKey(page: PageId) {
  return `${KEY_PREFIX}-${page}`;
}

function widthFromSize(size: LayoutEntry["size"]) {
  if (size === "full") return 12;
  if (size === "xl") return 8;
  if (size === "lg") return 6;
  if (size === "md") return 4;
  return 3;
}

function heightFromSize(size: LayoutEntry["size"]) {
  if (size === "md" || size === "sm") return 6;
  return 8;
}

function toGridLayout(entries: LegacyLayoutEntry[]): LayoutEntry[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  const totalCols = 12;

  return sorted.map((entry, index) => {
    const w = widthFromSize(entry.size);
    const h = heightFromSize(entry.size);
    if (cursorX + w > totalCols) {
      cursorX = 0;
      cursorY += rowH;
      rowH = 0;
    }
    const next: LayoutEntry = {
      ...entry,
      order: index + 1,
      x: cursorX,
      y: cursorY,
      w,
      h,
    };
    cursorX += w;
    rowH = Math.max(rowH, h);
    if (cursorX >= totalCols) {
      cursorX = 0;
      cursorY += rowH;
      rowH = 0;
    }
    return next;
  });
}

function hasGridFields(entry: unknown): entry is LayoutEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Partial<LayoutEntry>;
  return (
    typeof e.widgetId === "string" &&
    typeof e.size === "string" &&
    typeof e.order === "number" &&
    typeof e.x === "number" &&
    typeof e.y === "number" &&
    typeof e.w === "number" &&
    typeof e.h === "number"
  );
}

export function loadLayout(page: PageId): LayoutEntry[] {
  const raw = localStorage.getItem(getKey(page));
  if (!raw) return toGridLayout(pageDefaults[page]);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return toGridLayout(pageDefaults[page]);

    if ("v" in parsed && "entries" in parsed) {
      const stored = parsed as StoredLayout;
      if (stored.v !== LAYOUT_VERSION) {
        return toGridLayout(pageDefaults[page]);
      }
      if (!Array.isArray(stored.entries) || !stored.entries.every(hasGridFields)) {
        return toGridLayout(pageDefaults[page]);
      }
      return stored.entries;
    }

    if (Array.isArray(parsed)) {
      const validEntries = parsed.filter(
        (e: any) => e && typeof e === "object" && typeof e.widgetId === "string"
      );
      if (validEntries.length > 0) {
        return toGridLayout(
          validEntries.map((e: any, i: number) => ({
            widgetId: e.widgetId as string,
            size: (e.size as LayoutEntry["size"]) || "lg",
            order: (e.order as number) || i + 1,
          }))
        );
      }
    }

    return toGridLayout(pageDefaults[page]);
  } catch {
    return toGridLayout(pageDefaults[page]);
  }
}

export function saveLayout(page: PageId, entries: LayoutEntry[]) {
  const stored: StoredLayout = { v: LAYOUT_VERSION, entries };
  localStorage.setItem(getKey(page), JSON.stringify(stored));
}

export function getDefaultLayout(page: PageId): LayoutEntry[] {
  return toGridLayout(pageDefaults[page]);
}

export function resetLayout(page: PageId) {
  localStorage.removeItem(getKey(page));
}
