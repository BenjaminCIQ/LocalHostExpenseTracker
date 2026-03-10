import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type TransferCandidate } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSelectedPersonId } from "@/lib/personFilter";

function TransferTxnPane({
  transactionId,
  title,
  date,
  amount,
  merchant,
  description,
  rawDescription,
  currency,
  kind,
  isInternalTransfer,
  transferGroupId,
  disabled,
  onChanged,
}: {
  transactionId: number;
  title: string;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  rawDescription: string;
  currency: string;
  kind: string;
  isInternalTransfer: boolean;
  transferGroupId: string | null;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [showMore, setShowMore] = useState(false);
  const [raw, setRaw] = useState<{ raw_row_json: string | null; raw_row_line: string | null } | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(date);
  const [editAmount, setEditAmount] = useState(amount);
  const [editMerchant, setEditMerchant] = useState(merchant);
  const [editDescription, setEditDescription] = useState(description);
  const [editRawDescription, setEditRawDescription] = useState(rawDescription);
  const [editCurrency, setEditCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">{title}</div>
        <Badge variant={kind === "transfer" || isInternalTransfer ? "secondary" : "default"}>
          {kind || "unknown"}
        </Badge>
      </div>
      <div className="text-sm">{formatDate(date)} · {formatCurrency(amount)} · {currency}</div>
      <div className="text-sm">{merchant || "Unknown merchant"}</div>
      <div className="text-xs text-muted-foreground break-words">{description || "-"}</div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/transactions?focus_txn_id=${transactionId}`}>
          <Button size="sm" variant="outline">Go to transaction</Button>
        </Link>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setLoadingRaw(true);
            setShowMore((v) => !v);
            if (!raw) {
              try {
                const data = await api.getTransactionRaw(transactionId);
                setRaw(data);
              } finally {
                setLoadingRaw(false);
              }
            } else {
              setLoadingRaw(false);
            }
          }}
        >
          {showMore ? "Hide details" : "Show details"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.updateTransaction(transactionId, {
                transaction_kind: "transfer",
                is_internal_transfer: true,
              });
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Mark transfer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.unlinkTransfer(transactionId);
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Unlink
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await api.updateTransaction(transactionId, {
                transaction_kind:
                  amount > 0 ? "income" : amount < 0 ? "expense" : "adjustment",
                is_internal_transfer: false,
                transfer_group_id: null,
                transfer_linked_transaction_id: null,
                transfer_confidence: null,
                transfer_match_source: null,
              });
              await onChanged();
            } finally {
              setSaving(false);
            }
          }}
        >
          Unmark transfer
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditing((v) => !v)}
          disabled={disabled || saving}
        >
          {editing ? "Cancel edit" : "Edit"}
        </Button>
      </div>

      {editing && (
        <div className="grid gap-2 md:grid-cols-2">
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={editCurrency} onChange={(e) => setEditCurrency(e.target.value.toUpperCase())} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={editMerchant} onChange={(e) => setEditMerchant(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm md:col-span-2" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
          <input className="h-8 rounded-md border border-border bg-background px-2 text-sm md:col-span-2" value={editRawDescription} onChange={(e) => setEditRawDescription(e.target.value)} />
          <div className="md:col-span-2 flex justify-end">
            <Button
              size="sm"
              disabled={disabled || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await api.updateTransaction(transactionId, {
                    date: editDate,
                    amount: editAmount,
                    currency: editCurrency,
                    merchant: editMerchant,
                    description: editDescription,
                    raw_description: editRawDescription,
                  });
                  setEditing(false);
                  await onChanged();
                } finally {
                  setSaving(false);
                }
              }}
            >
              Save edit
            </Button>
          </div>
        </div>
      )}

      {showMore && (
        <div className="rounded-md border border-border bg-muted/20 p-2 text-xs">
          {loadingRaw ? (
            <div className="text-muted-foreground">Loading raw data...</div>
          ) : (
            <div className="space-y-2">
              {transferGroupId && (
                <div>
                  <span className="text-muted-foreground">Transfer group:</span> {transferGroupId}
                </div>
              )}
              {raw?.raw_row_line ? (
                <pre className="whitespace-pre-wrap break-words">{raw.raw_row_line}</pre>
              ) : (
                <div className="text-muted-foreground">No raw line available.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TransferReviewPage({ embedded = false }: { embedded?: boolean }) {
  const selectedPersonId = useSelectedPersonId();
  const [rows, setRows] = useState<TransferCandidate[]>([]);
  const [activeBySourceId, setActiveBySourceId] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [minConfidence, setMinConfidence] = useState(0.55);
  const [seedLimit, setSeedLimit] = useState(1200);
  const [maxResults, setMaxResults] = useState(400);
  const [amountTolerance, setAmountTolerance] = useState(5);
  const [dateWindowDays, setDateWindowDays] = useState(5);
  const [autoConfidence, setAutoConfidence] = useState(0.9);

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
                setMinConfidence(0.55);
                setSeedLimit(1200);
                setMaxResults(400);
                setAmountTolerance(5);
                setDateWindowDays(5);
                setAutoConfidence(0.9);
              }}
            >
              Reset defaults
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
                      <TransferTxnPane
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
                      <TransferTxnPane
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
