import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  api,
  type ExternalAccount,
  type ExternalFundingLink,
  type ExternalReconciliation,
  type ExternalValuationSnapshot,
  type Person,
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
  const [people, setPeople] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<ExternalAccount[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  function personLabel(id?: number | null) {
    if (!id) return "(unassigned)";
    return people.find((p) => p.id === id)?.name ?? `#${id}`;
  }
  const [snapshots, setSnapshots] = useState<ExternalValuationSnapshot[]>([]);
  const [fundingLinks, setFundingLinks] = useState<ExternalFundingLink[]>([]);
  const [reconciliation, setReconciliation] = useState<ExternalReconciliation | null>(null);
  const [transferCandidates, setTransferCandidates] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("investment");
  const [newGroup, setNewGroup] = useState<"asset" | "liability">("asset");
  const [newCurrency, setNewCurrency] = useState("EUR");
  const [newPersonId, setNewPersonId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("investment");
  const [editGroup, setEditGroup] = useState<"asset" | "liability">("asset");
  const [editCurrency, setEditCurrency] = useState("EUR");
  const [editPersonId, setEditPersonId] = useState<number | null>(null);
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
  const filteredTransferCandidates = useMemo(() => {
    const linkedIds = new Set(fundingLinks.map((f) => f.transaction_id));
    return transferCandidates.filter((t) => {
      if (linkedIds.has(t.id)) return false;
      if (linkType === "funding_in") return t.amount < 0;
      return t.amount > 0;
    });
  }, [transferCandidates, fundingLinks, linkType]);

  async function loadAccounts() {
    try {
      const [rows, ps] = await Promise.all([
        api.getExternalAccounts(selectedPersonId ?? undefined),
        api.getPersons(),
      ]);
      setAccounts(rows);
      setPeople(ps);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load external accounts");
    }
  }

  const PAGE_SIZE = 200;
  const [txnSearch, setTxnSearch] = useState("");
  const [txnPage, setTxnPage] = useState(1);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnHasMore, setTxnHasMore] = useState(false);
  const [txnDropdownOpen, setTxnDropdownOpen] = useState(false);
  const txnSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const txnDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!txnDropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (txnDropdownRef.current && !txnDropdownRef.current.contains(e.target as Node)) setTxnDropdownOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTxnDropdownOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [txnDropdownOpen]);

  const loadTransactionCandidates = useCallback(
    async (search: string, page: number, append: boolean) => {
      setTxnLoading(true);
      try {
        const res = await api.getTransactions({
          page,
          page_size: PAGE_SIZE,
          person_id: selectedPersonId ?? undefined,
          include_transfers: false,
          q: search.trim() || undefined,
          sort_by: "date",
          sort_dir: "desc",
        });
        setTransferCandidates((prev) => (append ? [...prev, ...res.items] : res.items));
        setTxnHasMore(res.page < res.total_pages);
        setTxnPage(page);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load transactions");
      } finally {
        setTxnLoading(false);
      }
    },
    [selectedPersonId]
  );

  async function loadSelectedDetails(id: number) {
    try {
      const [s, f, r] = await Promise.all([
        api.getExternalSnapshots(id),
        api.getExternalFundingLinks(id),
        api.getExternalReconciliation(id),
      ]);
      setSnapshots(s);
      setFundingLinks(f);
      setReconciliation(r);
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
    setTransferCandidates([]);
    setTxnDropdownOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!txnDropdownOpen || !selectedId) return;
    const delay = txnSearch.trim() ? 300 : 0;
    txnSearchDebounce.current = setTimeout(() => {
      loadTransactionCandidates(txnSearch.trim(), 1, false);
    }, delay);
    return () => {
      if (txnSearchDebounce.current) {
        clearTimeout(txnSearchDebounce.current);
        txnSearchDebounce.current = null;
      }
    };
  }, [txnDropdownOpen, selectedId, txnSearch, loadTransactionCandidates]);

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
    setEditPersonId(selected.person_id ?? null);
  }, [selected]);

  async function createAccount() {
    if (!newName.trim()) return;
    await api.createExternalAccount({
      name: newName.trim(),
      account_type: newType,
      account_group: newGroup,
      currency: newCurrency,
      owner: personLabel(newPersonId) === "(unassigned)" ? "" : personLabel(newPersonId),
      person_id: newPersonId ?? null,
    });
    setNewName("");
    setNewPersonId(null);
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
    try {
      await api.createExternalFundingLink(selectedId, {
        transaction_id: Number(linkTxnId),
        linked_amount: parsedLinkAmount,
        link_type: linkType,
      });
      setLinkTxnId("");
      setLinkAmountInput("");
      setError("");
      await loadSelectedDetails(selectedId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create funding link.";
      setError(msg);
      toast.error(msg, { duration: 5000 });
    }
  }

  async function removeFundingLink(linkId: number) {
    if (!selectedId) return;
    await api.deleteExternalFundingLink(selectedId, linkId);
    await loadSelectedDetails(selectedId);
  }

  async function removeExternalAccount() {
    if (!selected) return;
    if (!confirm(`Delete external account "${selected.name}"? Snapshots and funding links will be removed.`)) return;
    try {
      await api.deleteExternalAccount(selected.id);
      setError("");
      setSelectedId(null);
      await loadAccounts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete account");
    }
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
        owner: personLabel(editPersonId) === "(unassigned)" ? "" : personLabel(editPersonId),
        person_id: editPersonId ?? null,
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
            <Select
              value={newPersonId ?? ""}
              onChange={(e) => setNewPersonId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">(unassigned)</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
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
                  {personLabel(a.person_id) !== "(unassigned)" ? ` · ${personLabel(a.person_id)}` : ""}
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
                {personLabel(selected.person_id) !== "(unassigned)" ? ` · Owner: ${personLabel(selected.person_id)}` : ""}
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
                    <Select
                      value={editPersonId ?? ""}
                      onChange={(e) => setEditPersonId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">(unassigned)</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => void saveExternalAccountEdits()}
                      disabled={!editName.trim() || savingEdit}
                    >
                      {savingEdit ? "Saving..." : "Save account changes"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => void removeExternalAccount()}
                    >
                      Delete account
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
                  <div className="relative" ref={txnDropdownRef}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between font-normal"
                      onClick={() => {
                        setTxnDropdownOpen((v) => !v);
                        if (!txnDropdownOpen) setTxnSearch("");
                      }}
                    >
                      <span className="truncate">
                        {selectedTransfer
                          ? `#${selectedTransfer.id} · ${formatDate(selectedTransfer.date)} · ${formatCurrency(selectedTransfer.amount)} · ${selectedTransfer.merchant || "Unknown"}`
                          : "Select transfer transaction"}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                    {txnDropdownOpen && (
                      <div
                        className="absolute z-20 mt-1 left-0 right-0 min-w-[20rem] max-w-[32rem] rounded-md border border-border bg-background p-2 shadow-lg"
                      >
                        <input
                          className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
                          placeholder="Search merchant, description…"
                          value={txnSearch}
                          onChange={(e) => setTxnSearch(e.target.value)}
                          autoFocus
                        />
                        <div className="max-h-64 overflow-y-auto space-y-0.5">
                          {filteredTransferCandidates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-muted/50 truncate"
                              onClick={() => {
                                setLinkTxnId(t.id);
                                setTxnDropdownOpen(false);
                              }}
                            >
                              #{t.id} · {formatDate(t.date)} · {formatCurrency(t.amount)} · {t.merchant || "Unknown"} ·{" "}
                              {transferLikelyDirectionLabel(t.amount)}
                            </button>
                          ))}
                          {!txnLoading && filteredTransferCandidates.length === 0 && (
                            <p className="px-2 py-2 text-xs text-muted-foreground">
                              {transferCandidates.length === 0 ? "No transactions match. Try a different search." : "No matching transactions for this direction."}
                            </p>
                          )}
                          {txnLoading && (
                            <p className="px-2 py-2 text-xs text-muted-foreground">Loading…</p>
                          )}
                        </div>
                        {txnHasMore && !txnLoading && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => loadTransactionCandidates(txnSearch.trim(), txnPage + 1, true)}
                          >
                            Load more
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
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
