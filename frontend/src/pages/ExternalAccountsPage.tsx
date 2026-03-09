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
  const linkTypeLabel = (value: string) =>
    value === "funding_in" ? "Into external account" : value === "funding_out" ? "Out of external account" : value;
  const transferLikelyDirectionLabel = (amount: number) =>
    amount < 0 ? "likely into external" : amount > 0 ? "likely out of external" : "direction unclear";
  const directionToneClass = (value: "funding_in" | "funding_out" | "neutral") =>
    value === "funding_in"
      ? "text-green-600 dark:text-green-400"
      : value === "funding_out"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

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
  const [newOwner, setNewOwner] = useState("");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("investment");
  const [editGroup, setEditGroup] = useState<"asset" | "liability">("asset");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editOwner, setEditOwner] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [snapshotValueInput, setSnapshotValueInput] = useState("");

  const [linkTxnId, setLinkTxnId] = useState<number | "">("");
  const [linkAmountInput, setLinkAmountInput] = useState("");
  const [linkType, setLinkType] = useState<"funding_in" | "funding_out">("funding_in");

  const selected = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? null,
    [accounts, selectedId]
  );
  const selectedTransfer = useMemo(
    () => transferCandidates.find((t) => t.id === linkTxnId) ?? null,
    [transferCandidates, linkTxnId]
  );
  const filteredTransferCandidates = useMemo(
    () =>
      transferCandidates.filter((t) => {
        if (linkType === "funding_in") return t.amount < 0;
        return t.amount > 0;
      }),
    [transferCandidates, linkType]
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

  useEffect(() => {
    if (!selectedTransfer) return;
    setLinkAmountInput(String(Math.abs(selectedTransfer.amount)));
    setLinkType(selectedTransfer.amount < 0 ? "funding_in" : "funding_out");
  }, [selectedTransfer]);

  useEffect(() => {
    if (!selectedTransfer) return;
    const isValidForSelectedDirection =
      (linkType === "funding_in" && selectedTransfer.amount < 0) ||
      (linkType === "funding_out" && selectedTransfer.amount > 0);
    if (!isValidForSelectedDirection) {
      setLinkTxnId("");
      setLinkAmountInput("");
    }
  }, [linkType, selectedTransfer]);

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name);
    setEditType(selected.account_type);
    setEditGroup((selected.account_group as "asset" | "liability") ?? "asset");
    setEditCurrency(selected.currency);
    setEditOwner(selected.owner ?? "");
  }, [selected]);

  async function createAccount() {
    if (!newName.trim()) return;
    await api.createExternalAccount({
      name: newName.trim(),
      account_type: newType,
      account_group: newGroup,
      currency: newCurrency,
      owner: newOwner.trim(),
      person_id: selectedPersonId ?? null,
    });
    setNewName("");
    setNewOwner("");
    await loadAccounts();
  }

  async function addSnapshot() {
    if (!selectedId) return;
    const parsedSnapshotValue = Number(snapshotValueInput);
    if (!Number.isFinite(parsedSnapshotValue)) {
      setError("Please enter a valid snapshot value.");
      return;
    }
    await api.createExternalSnapshot(selectedId, {
      snapshot_date: `${snapshotDate}T00:00:00`,
      value: parsedSnapshotValue,
      source: "manual",
    });
    setSnapshotValueInput("");
    setError("");
    await loadSelectedDetails(selectedId);
  }

  async function addFundingLink() {
    if (!selectedId || !linkTxnId) return;
    const parsedLinkAmount = Number(linkAmountInput);
    if (!Number.isFinite(parsedLinkAmount) || parsedLinkAmount <= 0) {
      setError("Please enter a valid linked amount greater than zero.");
      return;
    }
    await api.createExternalFundingLink(selectedId, {
      transaction_id: Number(linkTxnId),
      linked_amount: parsedLinkAmount,
      link_type: linkType,
    });
    setLinkTxnId("");
    setLinkAmountInput("");
    setError("");
    await loadSelectedDetails(selectedId);
  }

  async function removeFundingLink(linkId: number) {
    if (!selectedId) return;
    await api.deleteExternalFundingLink(selectedId, linkId);
    await loadSelectedDetails(selectedId);
  }

  async function saveExternalAccountEdits() {
    if (!selectedId) return;
    try {
      setSavingEdit(true);
      await api.updateExternalAccount(selectedId, {
        name: editName.trim(),
        account_type: editType.trim(),
        account_group: editGroup,
        currency: editCurrency.trim().toUpperCase(),
        owner: editOwner.trim(),
      });
      await loadAccounts();
      await loadSelectedDetails(selectedId);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update external account");
    } finally {
      setSavingEdit(false);
    }
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
          <div className="grid gap-3 md:grid-cols-6 items-end">
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
            <input
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="Owner (optional)"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
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
                <div className="text-xs text-muted-foreground">
                  {a.account_group} · {a.currency}
                  {a.owner ? ` · ${a.owner}` : ""}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selected ? selected.name : "Select an account"}</CardTitle>
            {selected ? (
              <div className="text-sm text-muted-foreground">
                {selected.account_group} · {selected.currency}
                {selected.owner ? ` · Owner: ${selected.owner}` : ""}
              </div>
            ) : null}
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

                <div className="space-y-2 rounded-md border border-border p-3">
                  <div className="text-sm font-medium">Edit external account</div>
                  <div className="grid gap-2 md:grid-cols-5 items-end">
                    <input
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      placeholder="Name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      placeholder="Type"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                    />
                    <Select
                      value={editGroup}
                      onChange={(e) =>
                        setEditGroup((e.target.value as "asset" | "liability") ?? "asset")
                      }
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                    </Select>
                    <input
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      placeholder="Currency"
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value.toUpperCase())}
                    />
                    <input
                      className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                      placeholder="Owner"
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => void saveExternalAccountEdits()}
                      disabled={!editName.trim() || savingEdit}
                    >
                      {savingEdit ? "Saving..." : "Save account changes"}
                    </Button>
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
                    value={snapshotValueInput}
                    onChange={(e) => setSnapshotValueInput(e.target.value)}
                    placeholder="Snapshot value"
                  />
                  <Button onClick={() => void addSnapshot()} disabled={!snapshotValueInput.trim()}>
                    Add valuation snapshot
                  </Button>
                </div>

                <div className="grid gap-2 md:grid-cols-5 items-end">
                  <Select value={linkTxnId} onChange={(e) => setLinkTxnId(Number(e.target.value) || "")}>
                    <option value="">Select transfer transaction</option>
                    {filteredTransferCandidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} · {formatDate(t.date)} · {formatCurrency(t.amount)} · {t.merchant || "Unknown"} ·{" "}
                        {transferLikelyDirectionLabel(t.amount)}
                      </option>
                    ))}
                  </Select>
                  <input
                    type="number"
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={linkAmountInput}
                    onChange={(e) => setLinkAmountInput(e.target.value)}
                    placeholder="Linked amount"
                  />
                  <Select value={linkType} onChange={(e) => setLinkType((e.target.value as "funding_in" | "funding_out") ?? "funding_in")}>
                    <option value="funding_in">Into external account</option>
                    <option value="funding_out">Out of external account</option>
                  </Select>
                  <Button onClick={() => void addFundingLink()} disabled={!linkTxnId || !linkAmountInput.trim()}>
                    Link transfer
                  </Button>
                </div>
                <p className={`text-xs font-medium ${directionToneClass(linkType)}`}>Selected direction: {linkTypeLabel(linkType)}</p>
                {selectedTransfer ? (
                  <p
                    className={`text-xs font-medium ${
                      selectedTransfer.amount < 0
                        ? directionToneClass("funding_in")
                        : selectedTransfer.amount > 0
                          ? directionToneClass("funding_out")
                          : directionToneClass("neutral")
                    }`}
                  >
                    Selected transfer is {transferLikelyDirectionLabel(selectedTransfer.amount)}.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Direction guide: <span className="font-medium">Into external account</span> means money leaves your tracked account and funds this
                  external account. <span className="font-medium">Out of external account</span> means money returns from this external account into your
                  tracked account.
                </p>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Funding links</div>
                  {fundingLinks.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span>
                        Tx #{l.transaction_id} ·{" "}
                        <span
                          className={directionToneClass(
                            l.link_type === "funding_in" ? "funding_in" : l.link_type === "funding_out" ? "funding_out" : "neutral"
                          )}
                        >
                          {linkTypeLabel(l.link_type)}
                        </span>{" "}
                        · {formatCurrency(l.linked_amount)}
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
