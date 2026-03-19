import type { LayoutEntry, PageId } from "@/lib/widgets/types";

const KEY_PREFIX = "widget-layout";
export const LAYOUT_VERSION = 4;

type LegacyLayoutEntry = Pick<LayoutEntry, "widgetId" | "size" | "order">;

interface StoredLayout {
  v: number;
  entries: LayoutEntry[];
}

/** Legacy flow defaults (size + order); grid positions from `toGridLayout`. */
const pageDefaults: Record<PageId, LegacyLayoutEntry[]> = {
  overview: [],
  analytics: [],
  budgets: [
    { widgetId: "budget-management", size: "full", order: 1 },
    { widgetId: "budget-status", size: "lg", order: 2 },
    { widgetId: "savings-rate", size: "lg", order: 3 },
    { widgetId: "enhanced-pie", size: "lg", order: 4 },
  ],
};

/**
 * Default layouts for Overview and Analytics (new installs, reset, bad local data).
 * Explicit x/y/w/h match saved user_preferences for person_id 1.
 */
const pageDefaultEntries: Partial<Record<PageId, LayoutEntry[]>> = {
  overview: [
    {
      widgetId: "kpi-cards",
      size: "full",
      order: 1,
      x: 6,
      y: 0,
      w: 6,
      h: 1,
    },
    {
      widgetId: "snapshot",
      size: "xl",
      order: 2,
      x: 6,
      y: 3,
      w: 6,
      h: 2,
    },
    {
      widgetId: "external-funding-context",
      size: "lg",
      order: 3,
      x: 6,
      y: 1,
      w: 6,
      h: 2,
    },
    {
      widgetId: "net-worth-snapshot",
      size: "lg",
      order: 4,
      x: 0,
      y: 0,
      w: 6,
      h: 3,
    },
    {
      widgetId: "monthly-bar",
      size: "lg",
      order: 5,
      x: 0,
      y: 3,
      w: 6,
      h: 3,
    },
    {
      widgetId: "category-pie",
      size: "lg",
      order: 6,
      x: 6,
      y: 5,
      w: 6,
      h: 3,
    },
    {
      widgetId: "top-categories",
      size: "lg",
      order: 7,
      x: 0,
      y: 6,
      w: 6,
      h: 3,
    },
    {
      widgetId: "expense-highlights",
      size: "lg",
      order: 8,
      x: 6,
      y: 8,
      w: 6,
      h: 2,
    },
    {
      widgetId: "person-comparison",
      size: "xl",
      order: 9,
      x: 0,
      y: 9,
      w: 6,
      h: 2,
    },
    {
      widgetId: "budget-status",
      size: "xl",
      order: 10,
      x: 6,
      y: 10,
      w: 6,
      h: 1,
    },
  ],
  analytics: [
    {
      widgetId: "interactive-category-bar",
      size: "full",
      order: 1,
      x: 0,
      y: 0,
      w: 12,
      h: 5,
    },
    {
      widgetId: "sankey",
      size: "full",
      order: 2,
      x: 0,
      y: 12,
      w: 12,
      h: 4,
    },
    {
      widgetId: "outlier-panel",
      size: "lg",
      order: 3,
      x: 0,
      y: 19,
      w: 6,
      h: 3,
    },
    {
      widgetId: "spending-heatmap",
      size: "lg",
      order: 4,
      x: 0,
      y: 16,
      w: 12,
      h: 3,
    },
    {
      widgetId: "cashflow-forecast",
      size: "lg",
      order: 5,
      x: 0,
      y: 25,
      w: 6,
      h: 3,
    },
    {
      widgetId: "year-over-year",
      size: "lg",
      order: 6,
      x: 6,
      y: 19,
      w: 6,
      h: 3,
    },
    {
      widgetId: "running-balance",
      size: "lg",
      order: 7,
      x: 6,
      y: 25,
      w: 6,
      h: 3,
    },
    {
      widgetId: "merchant-insights",
      size: "lg",
      order: 8,
      x: 6,
      y: 22,
      w: 6,
      h: 3,
    },
    {
      widgetId: "recurring",
      size: "lg",
      order: 9,
      x: 0,
      y: 22,
      w: 6,
      h: 3,
    },
    {
      widgetId: "spending-habits",
      size: "full",
      order: 10,
      x: 0,
      y: 5,
      w: 12,
      h: 7,
    },
  ],
};

function defaultLayoutForPage(page: PageId): LayoutEntry[] {
  const explicit = pageDefaultEntries[page];
  if (explicit) return explicit.map((e) => ({ ...e }));
  return toGridLayout(pageDefaults[page]);
}

function getKey(page: PageId, personId: number | null = null) {
  const user = personId != null ? String(personId) : "anon";
  return `${KEY_PREFIX}-${user}-${page}`;
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

/** KPI widget is compact; use fewer rows so vertical sizing isn't excessive. */
const KPI_GRID_HEIGHT = 4;

function gridHeightForEntry(entry: LegacyLayoutEntry): number {
  if (entry.widgetId === "kpi-cards") return KPI_GRID_HEIGHT;
  return heightFromSize(entry.size);
}

function toGridLayout(entries: LegacyLayoutEntry[]): LayoutEntry[] {
  const sorted = [...entries].sort((a, b) => a.order - b.order);
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;
  const totalCols = 12;

  return sorted.map((entry, index) => {
    const w = widthFromSize(entry.size);
    const h = gridHeightForEntry(entry);
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

export function hasGridFields(entry: unknown): entry is LayoutEntry {
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

export function loadLayout(page: PageId, personId: number | null = null): LayoutEntry[] {
  const raw = localStorage.getItem(getKey(page, personId));
  if (!raw) return defaultLayoutForPage(page);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultLayoutForPage(page);

    if ("v" in parsed && "entries" in parsed) {
      const stored = parsed as StoredLayout;
      if (stored.v !== LAYOUT_VERSION) {
        return defaultLayoutForPage(page);
      }
      if (!Array.isArray(stored.entries) || !stored.entries.every(hasGridFields)) {
        return defaultLayoutForPage(page);
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

    return defaultLayoutForPage(page);
  } catch {
    return defaultLayoutForPage(page);
  }
}

export function saveLayout(page: PageId, entries: LayoutEntry[], personId: number | null = null) {
  const stored: StoredLayout = { v: LAYOUT_VERSION, entries };
  localStorage.setItem(getKey(page, personId), JSON.stringify(stored));
}

export function getDefaultLayout(page: PageId): LayoutEntry[] {
  return defaultLayoutForPage(page);
}

export function resetLayout(page: PageId, personId: number | null = null) {
  localStorage.removeItem(getKey(page, personId));
}
