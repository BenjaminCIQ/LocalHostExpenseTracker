import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type TransferCandidate } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function TransferReviewPage({ embedded = false }: { embedded?: boolean }) {
  const [rows, setRows] = useState<TransferCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.getTransferCandidates({ limit: 200 });
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
  }, []);

  async function autoLink() {
    setActionLoading(true);
    setError("");
    try {
      const res = await api.autoLinkTransfers(300);
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
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Candidates ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfer candidates found.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={`${row.transaction_id}-${row.candidate_id}`} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1 text-sm">
                      <div>
                        #{row.transaction_id} ({row.transaction_date}) {formatCurrency(row.transaction_amount)}
                        {" -> "}#{row.candidate_id} ({row.candidate_date}){" "}
                        {formatCurrency(row.candidate_amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.score >= 0.9 ? "success" : "warning"}>
                        {(row.score * 100).toFixed(0)}%
                      </Badge>
                      <Button size="sm" onClick={() => void approve(row)} disabled={actionLoading}>
                        Approve link
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
