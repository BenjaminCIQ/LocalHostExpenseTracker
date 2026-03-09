import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Trip, type TripTransactionItem } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function TripsPage() {
  type SuggestionBucket = "review" | "include" | "exclude" | "manual";

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [tripRows, setTripRows] = useState<TripTransactionItem[]>([]);
  const [activeBucket, setActiveBucket] = useState<SuggestionBucket>("review");
  const [searchText, setSearchText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);

  const [newName, setNewName] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newDestination, setNewDestination] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips]
  );

  const loadTrips = async () => {
    const next = await api.getTrips();
    setTrips(next);
    if (selectedTripId === null && next.length > 0) setSelectedTripId(next[0].id);
    if (selectedTripId !== null && !next.some((t) => t.id === selectedTripId)) {
      setSelectedTripId(next.length > 0 ? next[0].id : null);
    }
  };

  const loadTripRows = async (tripId: number, q?: string) => {
    setLoadingRows(true);
    try {
      const res = await api.getTripTransactions(tripId, q);
      setTripRows(res.items);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    loadTrips().catch((e) => setError(e instanceof Error ? e.message : "Failed loading trips"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTripId) {
      setTripRows([]);
      return;
    }
    loadTripRows(selectedTripId, searchText).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed loading trip transactions")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTripId]);

  const applyMembership = async (
    tripId: number,
    transactionId: number,
    next: "auto" | "include" | "exclude"
  ) => {
    try {
      if (next === "auto") {
        await api.clearTripOverride(tripId, transactionId);
      } else {
        await api.setTripOverride(tripId, transactionId, next === "include");
      }
      await loadTrips();
      await loadTripRows(tripId, searchText);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed updating trip membership");
    }
  };

  const filteredRows = useMemo(() => {
    return tripRows.filter((row) => {
      if (activeBucket === "manual") return row.membership_source === "manual_override";
      if (activeBucket === "review") return row.membership_source !== "manual_override" && row.suggested_membership === "review";
      if (activeBucket === "include")
        return row.membership_source !== "manual_override" && row.suggested_membership === "include";
      if (activeBucket === "exclude")
        return row.membership_source !== "manual_override" && row.suggested_membership === "exclude";
      return true;
    });
  }, [activeBucket, tripRows]);

  const counts = useMemo(
    () => ({
      review: tripRows.filter((r) => r.membership_source !== "manual_override" && r.suggested_membership === "review").length,
      include: tripRows.filter((r) => r.membership_source !== "manual_override" && r.suggested_membership === "include").length,
      exclude: tripRows.filter((r) => r.membership_source !== "manual_override" && r.suggested_membership === "exclude").length,
      manual: tripRows.filter((r) => r.membership_source === "manual_override").length,
    }),
    [tripRows]
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Trips</h2>
        <p className="text-sm text-muted-foreground">
          Define travel windows and separate trip-context spending from normal spending patterns.
        </p>
      </div>
      {error && <p className="text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Create trip window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Trip name (e.g. Tokyo May 2026)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
              <input
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
            <input
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Destination (optional)"
              value={newDestination}
              onChange={(e) => setNewDestination(e.target.value)}
            />
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
            />
            <Button
              disabled={!newName.trim() || !newStart || !newEnd}
              onClick={async () => {
                try {
                  await api.createTrip({
                    name: newName.trim(),
                    start_date: newStart,
                    end_date: newEnd,
                    destination: newDestination.trim() || null,
                    notes: newNotes.trim() || null,
                  });
                  setNewName("");
                  setNewStart("");
                  setNewEnd("");
                  setNewDestination("");
                  setNewNotes("");
                  await loadTrips();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed creating trip");
                }
              }}
            >
              Create trip
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved trips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {trips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  selectedTripId === trip.id ? "border-primary bg-primary/10" : "border-border"
                }`}
                onClick={() => setSelectedTripId(trip.id)}
              >
                <div className="font-medium">{trip.name}</div>
                <div className="text-xs text-muted-foreground">
                  {trip.start_date} {"->"} {trip.end_date}
                </div>
                <div className="text-xs text-muted-foreground">
                  Overrides: {trip.overrides_count}
                </div>
              </button>
            ))}
            {trips.length === 0 && (
              <p className="text-sm text-muted-foreground">No trips created yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!selectedTrip ? (
              <p className="text-sm text-muted-foreground">
                Select a trip to inspect and manage membership overrides.
              </p>
            ) : (
              <>
                <div className="text-sm">{selectedTrip.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedTrip.start_date} {"->"} {selectedTrip.end_date}
                </div>
                {selectedTrip.destination && (
                  <div className="text-xs text-muted-foreground">
                    Destination: {selectedTrip.destination}
                  </div>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    if (!selectedTrip) return;
                    try {
                      setBusy(true);
                      await api.deleteTrip(selectedTrip.id);
                      await loadTrips();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed deleting trip");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete selected trip
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !selectedTrip}
                  onClick={async () => {
                    if (!selectedTrip) return;
                    try {
                      setBusy(true);
                      await api.recomputeTripSuggestions(selectedTrip.id);
                      await loadTripRows(selectedTrip.id, searchText);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Failed recomputing suggestions");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Recompute suggestions
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Trip review queue</CardTitle>
            <div className="flex gap-2">
              <input
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                placeholder="Search merchant/description"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!selectedTripId || busy}
                onClick={() => {
                  if (!selectedTripId) return;
                  loadTripRows(selectedTripId, searchText).catch((e) =>
                    setError(e instanceof Error ? e.message : "Failed loading trip transactions")
                  );
                }}
              >
                Search
              </Button>
              <Button
                variant="outline"
                disabled={!selectedTripId || busy}
                onClick={async () => {
                  if (!selectedTripId) return;
                  try {
                    setBusy(true);
                    await api.applyTripSuggestions(selectedTripId, {
                      apply_bucket: true,
                      bucket: "include",
                    });
                    await loadTripRows(selectedTripId, searchText);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed applying include suggestions");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Accept suggested includes
              </Button>
              <Button
                variant="outline"
                disabled={!selectedTripId || busy}
                onClick={async () => {
                  if (!selectedTripId) return;
                  try {
                    setBusy(true);
                    await api.applyTripSuggestions(selectedTripId, {
                      apply_bucket: true,
                      bucket: "exclude",
                    });
                    await loadTripRows(selectedTripId, searchText);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed applying exclude suggestions");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Accept suggested excludes
              </Button>
              <Button
                variant="outline"
                disabled={!selectedTripId || busy}
                onClick={async () => {
                  if (!selectedTripId) return;
                  try {
                    setBusy(true);
                    await api.resetTripSuggestions(selectedTripId, false);
                    await loadTripRows(selectedTripId, searchText);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed resetting suggestions");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Reset non-manual to auto
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["review", `Needs review (${counts.review})`],
                ["include", `Suggested include (${counts.include})`],
                ["exclude", `Suggested exclude (${counts.exclude})`],
                ["manual", `Manual overrides (${counts.manual})`],
              ] as const
            ).map(([bucket, label]) => (
              <Button
                key={bucket}
                size="sm"
                variant={activeBucket === bucket ? "default" : "outline"}
                onClick={() => setActiveBucket(bucket)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!selectedTripId ? (
            <p className="text-sm text-muted-foreground">Select a trip to review transactions.</p>
          ) : loadingRows ? (
            <p className="text-sm text-muted-foreground">Loading transactions...</p>
          ) : (
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Merchant / Description</th>
                  <th className="p-2 text-left">Reasons</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-left">Trip membership</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((txn) => (
                  <tr key={txn.id} className="border-b">
                    <td className="p-2 whitespace-nowrap">{formatDate(txn.date)}</td>
                    <td className="p-2">
                      <div>{txn.merchant || "Unknown merchant"}</div>
                      <div className="text-xs text-muted-foreground truncate" title={txn.description}>
                        {txn.description}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {(txn.suggestion_reasons || []).map((reason) => (
                          <span
                            key={`${txn.id}-${reason}`}
                            className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {txn.suggestion_score !== null && txn.suggestion_score !== undefined
                          ? `score ${txn.suggestion_score.toFixed(2)}`
                          : "no score"}
                      </div>
                    </td>
                    <td className="p-2">{txn.final_category_name || txn.predicted_category_name || "-"}</td>
                    <td className={`p-2 text-right font-mono ${txn.amount >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="p-2">
                      <select
                        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                        value={
                          txn.membership_source === "manual_override"
                            ? txn.membership
                            : "auto"
                        }
                        onChange={(e) =>
                          applyMembership(
                            selectedTripId,
                            txn.id,
                            e.target.value as "auto" | "include" | "exclude"
                          )
                        }
                      >
                        <option value="auto">Auto</option>
                        <option value="include">Force include</option>
                        <option value="exclude">Force exclude</option>
                      </select>
                      <div className="text-xs text-muted-foreground mt-1">
                        {txn.membership_source}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No transactions in this queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

