import DashboardComposer from "@/components/DashboardComposer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardFiltersProvider } from "@/lib/widgets/DashboardFiltersContext";
import "@/lib/widgets";

export default function AnalyticsPage() {
  return (
    <ErrorBoundary clearPageId="analytics">
      <DashboardFiltersProvider pageId="analytics">
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Deep-dive analysis view with trend, outlier, and flow widgets.
          </p>
          <DashboardComposer page="analytics" />
        </div>
      </DashboardFiltersProvider>
    </ErrorBoundary>
  );
}
