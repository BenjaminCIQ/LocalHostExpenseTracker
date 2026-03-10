import type { WidgetControlState } from "@/lib/widgets/types";

export interface WidgetZoomState {
  start: string | null;
  end: string | null;
}

const EMPTY_ZOOM: WidgetZoomState = { start: null, end: null };

export function readWidgetZoom(widgetState?: WidgetControlState): WidgetZoomState {
  const raw = widgetState?.zoom;
  if (!raw || typeof raw !== "object") return EMPTY_ZOOM;
  const zoom = raw as Partial<WidgetZoomState>;
  return {
    start: typeof zoom.start === "string" ? zoom.start : null,
    end: typeof zoom.end === "string" ? zoom.end : null,
  };
}

export function withWidgetZoom(
  widgetState: WidgetControlState | undefined,
  zoom: WidgetZoomState
): WidgetControlState {
  return {
    ...(widgetState ?? {}),
    zoom,
  };
}

export function clearWidgetZoom(widgetState: WidgetControlState | undefined): WidgetControlState {
  return withWidgetZoom(widgetState, EMPTY_ZOOM);
}

export function zoomFromIndices<T>(
  rows: T[],
  startIndex: number | undefined,
  endIndex: number | undefined,
  keyFn: (row: T) => string
): WidgetZoomState {
  if (!rows.length || startIndex === undefined || endIndex === undefined) return EMPTY_ZOOM;
  const left = Math.max(0, Math.min(startIndex, endIndex));
  const right = Math.max(0, Math.max(startIndex, endIndex));
  const startRow = rows[left];
  const endRow = rows[Math.min(right, rows.length - 1)];
  if (!startRow || !endRow) return EMPTY_ZOOM;
  return {
    start: keyFn(startRow),
    end: keyFn(endRow),
  };
}

export function applyZoomWindow<T>(
  rows: T[],
  zoom: WidgetZoomState,
  keyFn: (row: T) => string
): T[] {
  if (!zoom.start || !zoom.end) return rows;
  const startIdx = rows.findIndex((row) => keyFn(row) === zoom.start);
  const endIdx = rows.findIndex((row) => keyFn(row) === zoom.end);
  if (startIdx < 0 || endIdx < 0) return rows;
  const left = Math.min(startIdx, endIdx);
  const right = Math.max(startIdx, endIdx);
  return rows.slice(left, right + 1);
}
