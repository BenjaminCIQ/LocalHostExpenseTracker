import { useMemo, useState } from "react";
import type { Trip } from "@/lib/api";

export function TripExclusionControl({
  enabled,
  selectedTripIds,
  trips,
  onEnabledChange,
  onSelectedTripIdsChange,
}: {
  enabled: boolean;
  selectedTripIds: number[];
  trips: Trip[];
  onEnabledChange: (enabled: boolean) => void;
  onSelectedTripIdsChange: (tripIds: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visibleTrips = useMemo(
    () =>
      q
        ? trips.filter((trip) => trip.name.toLowerCase().includes(q))
        : trips,
    [q, trips]
  );
  const selectedSet = useMemo(() => new Set(selectedTripIds), [selectedTripIds]);

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Exclude trip-included transactions
      </label>
      {enabled ? (
        <div className="space-y-2">
          <div className="text-[11px] text-muted-foreground">
            Leave selection empty to exclude includes from all trips.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => onSelectedTripIdsChange(visibleTrips.map((trip) => trip.id))}
            >
              Select visible
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => onSelectedTripIdsChange([])}
            >
              All trips
            </button>
            <input
              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
              placeholder="Search trips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-28 overflow-auto rounded border border-border p-1">
            <div className="flex flex-wrap gap-1">
              {visibleTrips.map((trip) => {
                const active = selectedSet.has(trip.id);
                return (
                  <label
                    key={trip.id}
                    className={`cursor-pointer rounded border px-2 py-1 text-xs ${
                      active ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-1"
                      checked={active}
                      onChange={() => {
                        const next = new Set(selectedSet);
                        if (next.has(trip.id)) next.delete(trip.id);
                        else next.add(trip.id);
                        onSelectedTripIdsChange(Array.from(next));
                      }}
                    />
                    {trip.name}
                  </label>
                );
              })}
              {visibleTrips.length === 0 ? (
                <span className="px-2 py-1 text-xs text-muted-foreground">No matching trips.</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
