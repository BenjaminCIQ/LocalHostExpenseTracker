import DashboardComposer from "@/components/DashboardComposer";
import { DashboardFiltersProvider } from "@/lib/widgets/DashboardFiltersContext";
import "@/lib/widgets";

export default function BudgetPage() {
  return (
    <DashboardFiltersProvider pageId="budgets">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold">Budgets</h2>
        <p className="text-sm text-muted-foreground">
          Manage limits and monitor budget adherence.
        </p>
        <DashboardComposer page="budgets" />
      </div>
    </DashboardFiltersProvider>
  );
}
