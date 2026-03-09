import { useEffect, useState } from "react";
import DashboardComposer from "@/components/DashboardComposer";
import { DashboardFiltersProvider, useDashboardFilters } from "@/lib/widgets/DashboardFiltersContext";
import "@/lib/widgets";
import { api, type Account, type Person } from "@/lib/api";
import { useSelectedPersonId } from "@/lib/personFilter";

function OverviewFilters() {
  const { filters, setDateRange, setMonth, setPersonId, setAccountId } = useDashboardFilters();
  const selectedPersonId = useSelectedPersonId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    api.getAccounts().then(setAccounts).catch(() => setAccounts([]));
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    setPersonId(selectedPersonId);
  }, [selectedPersonId, setPersonId]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
      <div>
        <div className="text-xs text-muted-foreground">Month (YYYY-MM)</div>
        <input
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={filters.month ?? ""}
          onChange={(e) => setMonth(e.target.value || null)}
          placeholder="all"
        />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Start</div>
        <input
          type="date"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={filters.dateRange.start ?? ""}
          onChange={(e) => setDateRange(e.target.value || null, filters.dateRange.end)}
        />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">End</div>
        <input
          type="date"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={filters.dateRange.end ?? ""}
          onChange={(e) => setDateRange(filters.dateRange.start, e.target.value || null)}
        />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Person</div>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={filters.personId ?? ""}
          onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Household</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Account</div>
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={filters.accountId ?? ""}
          onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <DashboardFiltersProvider pageId="overview">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold">Overview</h2>
        <OverviewFilters />
        <DashboardComposer page="overview" />
      </div>
    </DashboardFiltersProvider>
  );
}
