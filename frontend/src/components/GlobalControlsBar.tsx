import { useEffect, useState } from "react";
import { TripExclusionControl } from "@/components/widget-controls/TripExclusionControl";
import { api, type Trip } from "@/lib/api";
import { useDashboardFilters } from "@/lib/widgets/DashboardFiltersContext";

const DATE_PRESETS = ["7D", "30D", "90D", "YTD", "1Y", "ALL"] as const;

export function GlobalControlsBar() {
  const {
    globalControls,
    setDateWindow,
    setGlobalGranularity,
    setScope,
    setValueMode,
    setExcludeTripIncluded,
    setExcludedTripIds,
    resetGlobal,
  } = useDashboardFilters();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(() => setTrips([]));
  }, []);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Time</div>
          <div className="flex flex-wrap gap-1">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset}
                className={`rounded-md border px-2 py-1 text-xs ${
                  globalControls.dateWindow === preset
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background"
                }`}
                onClick={() => setDateWindow(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Granularity</div>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={globalControls.granularity}
            onChange={(e) =>
              setGlobalGranularity(
                e.target.value as
                  | "auto"
                  | "daily"
                  | "weekly"
                  | "monthly"
                  | "quarterly"
                  | "yearly"
              )
            }
          >
            <option value="auto">auto</option>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="quarterly">quarterly</option>
            <option value="yearly">yearly</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Scope</div>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={globalControls.scope}
            onChange={(e) =>
              setScope(e.target.value as "household" | "person" | "account")
            }
          >
            <option value="household">household</option>
            <option value="person">person</option>
            <option value="account">account</option>
          </select>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Display</div>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={globalControls.valueMode}
            onChange={(e) =>
              setValueMode(
                e.target.value as
                  | "absolute"
                  | "percent_share"
                  | "normalized_per_day"
              )
            }
          >
            <option value="absolute">absolute</option>
            <option value="percent_share">% share</option>
            <option value="normalized_per_day">per day</option>
          </select>
        </div>
        <button
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          onClick={resetGlobal}
        >
          Reset global controls
        </button>
      </div>
      <div className="mt-3">
        <TripExclusionControl
          enabled={globalControls.excludeTripIncluded}
          selectedTripIds={globalControls.excludedTripIds}
          trips={trips}
          onEnabledChange={setExcludeTripIncluded}
          onSelectedTripIdsChange={setExcludedTripIds}
        />
      </div>
    </div>
  );
}
