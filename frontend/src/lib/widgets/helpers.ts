import type { DashboardFilters } from "@/lib/widgets/types";

export function toAnalyticsParams(filters: DashboardFilters) {
  return {
    startDate: filters.dateRange.start ?? undefined,
    endDate: filters.dateRange.end ?? undefined,
    accountId: filters.accountId ?? undefined,
    personId: filters.personId ?? undefined,
    categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
  };
}
