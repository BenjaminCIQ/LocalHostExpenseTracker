import type { DashboardFilters, GlobalControlState } from "@/lib/widgets/types";

export function toAnalyticsParams(
  filters: DashboardFilters,
  globalControls?: GlobalControlState,
  options?: { categoryIds?: number[]; merchantNames?: string[] }
) {
  const categoryIds = options?.categoryIds ?? filters.categoryIds;
  const merchantNames = options?.merchantNames;
  return {
    startDate: filters.dateRange.start ?? undefined,
    endDate: filters.dateRange.end ?? undefined,
    accountId: filters.accountId ?? undefined,
    personId: filters.personId ?? undefined,
    categoryIds: categoryIds.length ? categoryIds : undefined,
    merchantNames: merchantNames?.length ? merchantNames : undefined,
    excludeTripIncluded: globalControls?.excludeTripIncluded ?? undefined,
    excludedTripIds:
      globalControls?.excludeTripIncluded && globalControls.excludedTripIds.length
        ? globalControls.excludedTripIds
        : undefined,
  };
}
