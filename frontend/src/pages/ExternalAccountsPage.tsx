import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  api,
  type ExternalAccount,
  type ExternalFundingLink,
  type ExternalReconciliation,
  type ExternalValuationSnapshot,
  type Transaction,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSelectedPersonId } from "@/lib/personFilter";

export default function ExternalAccountsPage() {
  const selectedPersonId = useSelectedPersonId();
  const [accounts, setAccounts] = useState<ExternalAccount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [snapshots, setSnapshots] = useState<ExternalValuationSnapshot[]>([]);
  const [fundingLinks, setFundingLinks] = useState<ExternalFundingLink[]>([]);
  const [reconciliation, setReconciliation] = useState<ExternalReconciliation | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("investment");
  const [newGroup, setNewGroup] = useState<"asset" | "liability">("asset");
  const [newCurrency, setNewCurrency] = useState("EUR");

  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [snapshotValue, setSnapshotValue] = useState<number>(0);

  const [linkTxnId, setLinkTxnId] = useState<number | "">("");
  const [linkAmount, setLinkAmount] = useState<number>(0);
  const [linkType, setLinkType] = useState<"funding_in" | "funding_out">("funding_in");

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );

  async function loadAccounts() {
    try {
      const rows = await api.getExternalAccounts(selectedPersonId ?? undefined);
      setAccounts(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load external accounts");
    }
  }

  async function loadSelectedDetails(id: number) {
    try {
      const [s, f, r, tx] = await Promise.all([
        api.getExternalSnapshots(id),
        api.getExternalFundingLinks(id),
        api.getExternalReconciliation(id),
        api.getTransactions({
          page: 1,
          page_size: 100,
          person_id: selectedPersonId ?? undefined,
          include_transfers: true,
          transaction_kind: "transfer",
        }),
      ]);
      setSnapshots(s);
      setFundingLinks(f);
      setReconciliation(r);
      setTransferCandidates(tx.items);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account details");
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, [selectedPersonId]);

  useEffect(() => {
    if (selectedId) void loadSelectedDetails(selectedId);
  }, [selectedId, selectedPersonId]);

  async function createAccount() {
    if (!newName.trim()) return;
    await api.createExternalAccount({
      name: newName.trim(),
      account_type: newType,
      account_group: newGroup,
      currency: newCurrency,
      person_id: selectedPersonId ?? null,
    });
    setNewName("");
    await loadAccounts();
  }

  async function addSnapshot() {
    if (!selectedId) return;
    await api.createExternalSnapshot(selectedId, {
      snapshot_date: `${snapshotDate}T00:00:00`,
      value: snapshotValue,
      source: "manual",
    });
    await loadSelectedDetails(selectedId);
  }

  async function addFundingLink() {
    if (!selectedId || !linkTxnId) return;
    await api.createExternalFundingLink(selectedId, {
      transaction_id: Number(linkTxnId),
      linked_amount: linkAmount,
      link_type: linkType,
    });
    setLinkTxnId("");
    setLinkAmount(0);
    await loadSelectedDetails(selectedId);
  }

  async function removeFundingLink(linkId: number) {
    if (!selectedId) return;
    await api.deleteExternalFundingLink(selectedId, linkId);
    await loadSelectedDetails(selectedId);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">External Accounts</h2>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Add External Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Name (e.g. Crypto Wallet)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
            <Select value={newGroup} onChange={(e) => setNewGroup((e.target.value as "asset" | "liability") ?? "asset")}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </Select>
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Currency"
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
            />
            <Button onClick={() => void createAccount()} disabled={!newName.trim()}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>External Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selectedId === a.id ? "border-primary bg-primary/10" : "border-border"
                }`}
                onClick={() => setSelectedId(a.id)}
              >
                <div className="font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground">{a.account_group} · {a.currency}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selected ? selected.name : "Select an account"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border p-3 text-sm">
                    <div className="text-muted-foreground">Latest value</div>
                    <div className="font-semibold">{formatCurrency(reconciliation?.latest_value ?? 0)}</div>
                  </div>
                  <div className="rounded-md border border-border p-3 text-sm">
                    <div className="text-muted-foreground">Linked funding</div>
                    <div className="font-semibold">{formatCurrency(reconciliation?.linked_funding_total ?? 0)}</div>
                  </div>
                  <div className="rounded-md border border-border p-3 text-sm">
                    <div className="text-muted-foreground">Unlinked component</div>
                    <div className="font-semibold">{formatCurrency(reconciliation?.unlinked_component ?? 0)}</div>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-4 items-end">
                  <input
                    type="date"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={snapshotDate}
                    onChange={(e) => setSnapshotDate(e.target.value)}
                  />
                  <input
                    type="number"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={snapshotValue}
                    onChange={(e) => setSnapshotValue(Number(e.target.value))}
                  />
                  <Button onClick={() => void addSnapshot()}>Add valuation snapshot</Button>
                </div>

                <div className="grid gap-2 md:grid-cols-5 items-end">
                  <Select value={linkTxnId} onChange={(e) => setLinkTxnId(Number(e.target.value) || "")}>
                    <option value="">Select transfer transaction</option>
                    {transferCandidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} · {formatDate(t.date)} · {formatCurrency(t.amount)} · {t.merchant || "Unknown"}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="number"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={linkAmount}
                    onChange={(e) => setLinkAmount(Number(e.target.value))}
                    placeholder="Linked amount"
                  />
                  <Select value={linkType} onChange={(e) => setLinkType((e.target.value as "funding_in" | "funding_out") ?? "funding_in")}>
                    <option value="funding_in">funding_in</option>
                    <option value="funding_out">funding_out</option>
                  </Select>
                  <Button onClick={() => void addFundingLink()} disabled={!linkTxnId || !linkAmount}>
                    Link transfer
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Funding links</div>
                  {fundingLinks.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>
                        Tx #{l.transaction_id} · {l.link_type} · {formatCurrency(l.linked_amount)}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => void removeFundingLink(l.id)}>
                        Unlink
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Valuation snapshots</div>
                  {snapshots.map((s) => (
                    <div key={s.id} className="rounded-md border border-border px-3 py-2 text-sm">
                      {formatDate(s.snapshot_date)} · {formatCurrency(s.value)} · {s.source}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Create/select an external account to track valuations and funding links.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
