import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type TransferCandidate } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSelectedPersonId } from "@/lib/personFilter";
import TransactionComparisonPane from "@/components/transactions/TransactionComparisonPane";

const TRANSFER_REVIEW_DEFAULTS_KEY = "transfer_review_candidate_defaults_v1";
const SYSTEM_DEFAULTS = {
  minConfidence: 0.55,
  seedLimit: 1200,
  maxResults: 400,
  amountTolerance: 5,
  dateWindowDays: 5,
  autoConfidence: 0.9,
};

function getInitialDefaults() {
  try {
    const raw = localStorage.getItem(TRANSFER_REVIEW_DEFAULTS_KEY);
    if (!raw) return SYSTEM_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<typeof SYSTEM_DEFAULTS>;
    return {
      minConfidence: Number(parsed.minConfidence ?? SYSTEM_DEFAULTS.minConfidence),
      seedLimit: Number(parsed.seedLimit ?? SYSTEM_DEFAULTS.seedLimit),
      maxResults: Number(parsed.maxResults ?? SYSTEM_DEFAULTS.maxResults),
      amountTolerance: Number(parsed.amountTolerance ?? SYSTEM_DEFAULTS.amountTolerance),
      dateWindowDays: Number(parsed.dateWindowDays ?? SYSTEM_DEFAULTS.dateWindowDays),
      autoConfidence: Number(parsed.autoConfidence ?? SYSTEM_DEFAULTS.autoConfidence),
    };
  } catch {
    return SYSTEM_DEFAULTS;
  }
}

export default function TransferReviewPage({ embedded = false }: { embedded?: boolean }) {
  const selectedPersonId = useSelectedPersonId();
  const initialDefaults = getInitialDefaults();
  const [rows, setRows] = useState<TransferCandidate[]>([]);
  const [activeBySourceId, setActiveBySourceId] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [minConfidence, setMinConfidence] = useState(initialDefaults.minConfidence);
  const [seedLimit, setSeedLimit] = useState(initialDefaults.seedLimit);
  const [maxResults, setMaxResults] = useState(initialDefaults.maxResults);
  const [amountTolerance, setAmountTolerance] = useState(initialDefaults.amountTolerance);
  const [dateWindowDays, setDateWindowDays] = useState(initialDefaults.dateWindowDays);
  const [autoConfidence, setAutoConfidence] = useState(initialDefaults.autoConfidence);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getTransferCandidates({
        limit: maxResults,
        seed_limit: seedLimit,
        max_results: maxResults,
        min_confidence: minConfidence,
        amount_tolerance: amountTolerance,
        date_window_days: dateWindowDays,
        person_id: selectedPersonId ?? undefined,
      });
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load transfer candidates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [selectedPersonId]);

  async function autoLink() {
    setActionLoading(true);
    setError("");
    try {
      const res = await api.autoLinkTransfers(maxResults, autoConfidence);
      setMessage(`Auto-linked ${res.linked}, reviewed ${res.reviewed}, skipped ${res.skipped}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-link failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function approve(row: TransferCandidate) {
    setActionLoading(true);
    setError("");
    try {
      await api.linkTransferPair(row.transaction_id, row.candidate_id, row.score);
      setMessage(`Linked #${row.transaction_id} and #${row.candidate_id}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve link failed.");
    } finally {
      setActionLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const bySource = new Map<number, TransferCandidate[]>();
    for (const row of rows) {
      const list = bySource.get(row.transaction_id) ?? [];
      list.push(row);
      bySource.set(row.transaction_id, list);
    }
    return Array.from(bySource.entries())
      .map(([sourceId, candidates]) => ({
        sourceId,
        candidates: candidates.sort((a, b) => b.score - a.score),
      }))
      .sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0));
  }, [rows]);

  function setActiveCandidate(sourceId: number, idx: number) {
    setActiveBySourceId((prev) => ({ ...prev, [sourceId]: idx }));
  }

  function selectedCandidateFor(sourceId: number, list: TransferCandidate[]) {
    const idx = activeBySourceId[sourceId] ?? 0;
    if (idx < 0 || idx >= list.length) return list[0];
    return list[idx];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!embedded ? <h2 className="text-2xl font-bold">Transfer Review</h2> : <div />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading || actionLoading}>
            Refresh
          </Button>
          <Button onClick={() => void autoLink()} disabled={loading || actionLoading}>
            Auto-link high confidence
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Detection controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Min confidence</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Seed limit</label>
              <input
                type="number"
                min={1}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={seedLimit}
                onChange={(e) => setSeedLimit(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Max results</label>
              <input
                type="number"
                min={1}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Amount tolerance</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={amountTolerance}
                onChange={(e) => setAmountTolerance(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date window days</label>
              <input
                type="number"
                min={0}
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={dateWindowDays}
                onChange={(e) => setDateWindowDays(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Auto-link confidence</label>
              <input
                type="number"
                min={0}
                max={1}
                step="0.01"
                className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={autoConfidence}
                onChange={(e) => setAutoConfidence(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading || actionLoading}>
              Apply controls
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                localStorage.setItem(
                  TRANSFER_REVIEW_DEFAULTS_KEY,
                  JSON.stringify({
                    minConfidence,
                    seedLimit,
                    maxResults,
                    amountTolerance,
                    dateWindowDays,
                    autoConfidence,
                  })
                );
                setMessage("Saved current detection controls as defaults.");
              }}
            >
              Save as defaults
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMinConfidence(SYSTEM_DEFAULTS.minConfidence);
                setSeedLimit(SYSTEM_DEFAULTS.seedLimit);
                setMaxResults(SYSTEM_DEFAULTS.maxResults);
                setAmountTolerance(SYSTEM_DEFAULTS.amountTolerance);
                setDateWindowDays(SYSTEM_DEFAULTS.dateWindowDays);
                setAutoConfidence(SYSTEM_DEFAULTS.autoConfidence);
              }}
            >
              Reset to system defaults
            </Button>
          </div>
        </CardContent>
      </Card>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Candidates ({rows.length} pairs / {grouped.length} source transactions)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfer candidates found.</p>
          ) : (
            <div className="space-y-2">
              {grouped.map((group) => {
                const active = selectedCandidateFor(group.sourceId, group.candidates);
                const activeIdx = active ? group.candidates.findIndex((c) => c.candidate_id === active.candidate_id) : 0;
                return (
                  <div key={group.sourceId} className="rounded-md border border-border p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        Source #{group.sourceId} · {group.candidates.length} candidates
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeIdx <= 0}
                          onClick={() => setActiveCandidate(group.sourceId, activeIdx - 1)}
                        >
                          Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {Math.max(activeIdx + 1, 1)} / {group.candidates.length}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activeIdx >= group.candidates.length - 1}
                          onClick={() => setActiveCandidate(group.sourceId, activeIdx + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <TransactionComparisonPane
                        key={`src-${active.transaction_id}`}
                        transactionId={active.transaction_id}
                        title={`Source #${active.transaction_id}`}
                        date={active.transaction_date}
                        amount={active.transaction_amount}
                        merchant={active.transaction_merchant}
                        description={active.transaction_description}
                        rawDescription={active.transaction_raw_description}
                        kind={active.transaction_kind}
                        currency={active.transaction_currency}
                        isInternalTransfer={active.transaction_is_internal_transfer}
                        transferGroupId={active.transaction_transfer_group_id}
                        disabled={actionLoading}
                        onChanged={async () => {
                          await load();
                        }}
                      />
                      <TransactionComparisonPane
                        key={`cand-${active.candidate_id}`}
                        transactionId={active.candidate_id}
                        title={`Candidate #${active.candidate_id}`}
                        date={active.candidate_date}
                        amount={active.candidate_amount}
                        merchant={active.candidate_merchant}
                        description={active.candidate_description}
                        rawDescription={active.candidate_raw_description}
                        kind={active.candidate_kind}
                        currency={active.candidate_currency}
                        isInternalTransfer={active.candidate_is_internal_transfer}
                        transferGroupId={active.candidate_transfer_group_id}
                        disabled={actionLoading}
                        onChanged={async () => {
                          await load();
                        }}
                      />
                    </div>
                    <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={active.score >= 0.9 ? "success" : active.score >= 0.75 ? "warning" : "secondary"}>
                          {(active.score * 100).toFixed(0)}%
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatDate(active.transaction_date)} {formatCurrency(active.transaction_amount)} {"->"}{" "}
                          {formatDate(active.candidate_date)} {formatCurrency(active.candidate_amount)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{active.reasons?.join(", ") || active.reason}</div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" onClick={() => void approve(active)} disabled={actionLoading}>
                          Approve link
                        </Button>
                        <Link to="/transactions">
                          <Button size="sm" variant="outline">Open Transactions</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
