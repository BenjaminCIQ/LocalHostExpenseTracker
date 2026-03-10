import type { ComponentType } from "react";

export type WidgetSize = "sm" | "md" | "lg" | "xl" | "full";
export type PageId = "overview" | "analytics" | "budgets";
export type DateWindowPreset = "7D" | "30D" | "90D" | "YTD" | "1Y" | "ALL";
export type GlobalGranularity =
  | "auto"
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly";
export type ScopeMode = "household" | "person" | "account";
export type ValueMode = "absolute" | "percent_share" | "normalized_per_day";

export type WidgetCategory =
  | "overview"
  | "spending"
  | "income"
  | "trends"
  | "budgets"
  | "advanced";

export interface DashboardFilters {
  dateRange: { start: string | null; end: string | null };
  month: string | null;
  personId: number | null;
  accountId: number | null;
  categoryIds: number[];
}

export interface GlobalControlState {
  dateWindow: DateWindowPreset;
  granularity: GlobalGranularity;
  scope: ScopeMode;
  valueMode: ValueMode;
  excludeTripIncluded: boolean;
  excludedTripIds: number[];
}

export type WidgetControlState = Record<string, unknown>;

export interface WidgetProps {
  filters: DashboardFilters;
  size: WidgetSize;
  globalControls?: GlobalControlState;
  widgetState?: WidgetControlState;
  setWidgetState?: (next: WidgetControlState) => void;
}

export interface WidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  component: ComponentType<WidgetProps>;
  defaultEnabled?: boolean;
}

export interface LayoutEntry {
  widgetId: string;
  size: WidgetSize;
  order: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
