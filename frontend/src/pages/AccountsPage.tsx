import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api, type Account, type Person } from "@/lib/api";
import AccountIcon from "@/components/icons/AccountIcon";
import { ACCOUNT_ICONS } from "@/lib/accountIcons";
import { TOUR_STEP_IDS, useTourOptional } from "@/lib/tour";
import { ButtonHint } from "@/components/HintTooltip";

function personLabel(people: Person[], id?: number | null) {
  if (!id) return "(unassigned)";
  return people.find((p) => p.id === id)?.name ?? `#${id}`;
}

export default function AccountsPage() {
  const tour = useTourOptional();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");

  const [newAcc, setNewAcc] = useState<Partial<Account>>({
    name: "",
    bank_name: "",
    account_type: "checking",
    currency: "EUR",
    owner: "",
    person_id: null,
    icon_id: null,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAcc, setEditAcc] = useState<Partial<Account> | null>(null);

  const load = async () => {
    try {
      const [accs, ps] = await Promise.all([api.getAccounts(), api.getPersons()]);
      setAccounts(accs);
      setPeople(ps);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  const create = async () => {
    if (!newAcc.name?.trim()) return;
    if (tour?.tourActive) {
      const nextStep = TOUR_STEP_IDS.find((id) => !tour.isStepCompleted(id));
      if (nextStep !== "accounts") {
        const ok = window.confirm(
          "You're in the demo. Anything you create during the demo can be removed when you end the tour. Continue?"
        );
        if (!ok) return;
      }
    }
    try {
      const created = await api.createAccount({
        ...newAcc,
        name: newAcc.name.trim(),
      });
      if (tour?.tourActive) tour.addDemoAccountId(created.id);
      setNewAcc({
        name: "",
        bank_name: "",
        account_type: "checking",
        currency: "EUR",
        owner: "",
        person_id: null,
        icon_id: null,
      });
      await load();
      window.dispatchEvent(new Event("accounts-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setEditAcc({ ...a });
  };

  const save = async () => {
    if (!editingId || !editAcc) return;
    if (!editAcc.name?.trim()) return;
    try {
      await api.updateAccount(editingId, {
        ...editAcc,
        name: editAcc.name.trim(),
      });
      setEditingId(null);
      setEditAcc(null);
      await load();
      window.dispatchEvent(new Event("accounts-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const removeAccount = async (a: Account) => {
    if (!confirm(`Delete account "${a.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteAccount(a.id);
      setError("");
      await load();
      window.dispatchEvent(new Event("accounts-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Accounts</h2>
      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-1">
            <CardTitle>Add account</CardTitle>
            <ButtonHint buttonId="add-account" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6 items-end">
            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                placeholder="e.g. Joint Checking"
                value={newAcc.name ?? ""}
                onChange={(e) => setNewAcc((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Bank</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={newAcc.bank_name ?? ""}
                onChange={(e) =>
                  setNewAcc((s) => ({ ...s, bank_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Type</label>
              <Select
                className="mt-1"
                value={newAcc.account_type ?? "checking"}
                onChange={(e) =>
                  setNewAcc((s) => ({ ...s, account_type: e.target.value }))
                }
              >
                <option value="checking">checking</option>
                <option value="savings">savings</option>
                <option value="credit">credit</option>
                <option value="cash">cash</option>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Currency</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={newAcc.currency ?? "EUR"}
                onChange={(e) =>
                  setNewAcc((s) => ({ ...s, currency: e.target.value.toUpperCase() }))
                }
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Person</label>
              <Select
                className="mt-1"
                value={newAcc.person_id ?? ""}
                onChange={(e) =>
                  setNewAcc((s) => ({
                    ...s,
                    person_id: Number(e.target.value) || null,
                  }))
                }
              >
                <option value="">(unassigned)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-6">
              <Button onClick={create} disabled={!newAcc.name?.trim()}>
                Add account
              </Button>
            </div>
            <div className="md:col-span-6">
              <label className="text-sm text-muted-foreground">Icon</label>
              <div className="mt-1 flex flex-wrap gap-1">
                {ACCOUNT_ICONS.map(({ id, emoji, label }) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    onClick={() =>
                      setNewAcc((s) => ({ ...s, icon_id: newAcc.icon_id === id ? null : id }))
                    }
                    className={`rounded-md p-1.5 text-lg transition-colors ${
                      newAcc.icon_id === id ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedAccounts.length === 0 ? (
            <p className="text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              {sortedAccounts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border p-3 space-y-2"
                >
                  {editingId === a.id && editAcc ? (
                    <div className="grid gap-2 md:grid-cols-6 items-end">
                      <div className="md:col-span-2">
                        <label className="text-sm text-muted-foreground">Name</label>
                        <input
                          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                          value={editAcc.name ?? ""}
                          onChange={(e) =>
                            setEditAcc((s) => ({ ...(s ?? {}), name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Bank</label>
                        <input
                          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                          value={editAcc.bank_name ?? ""}
                          onChange={(e) =>
                            setEditAcc((s) => ({ ...(s ?? {}), bank_name: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Type</label>
                        <Select
                          className="mt-1"
                          value={editAcc.account_type ?? "checking"}
                          onChange={(e) =>
                            setEditAcc((s) => ({ ...(s ?? {}), account_type: e.target.value }))
                          }
                        >
                          <option value="checking">checking</option>
                          <option value="savings">savings</option>
                          <option value="credit">credit</option>
                          <option value="cash">cash</option>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Currency</label>
                        <input
                          className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                          value={editAcc.currency ?? "EUR"}
                          onChange={(e) =>
                            setEditAcc((s) => ({ ...(s ?? {}), currency: e.target.value.toUpperCase() }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Person</label>
                        <Select
                          className="mt-1"
                          value={editAcc.person_id ?? ""}
                          onChange={(e) =>
                            setEditAcc((s) => ({
                              ...(s ?? {}),
                              person_id: Number(e.target.value) || null,
                            }))
                          }
                        >
                          <option value="">(unassigned)</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-6">
                        <label className="text-sm text-muted-foreground">Icon</label>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ACCOUNT_ICONS.map(({ id, emoji, label }) => (
                            <button
                              key={id}
                              type="button"
                              title={label}
                              onClick={() =>
                                setEditAcc((s) => ({
                                  ...(s ?? {}),
                                  icon_id: editAcc?.icon_id === id ? null : id,
                                }))
                              }
                              className={`rounded-md p-1.5 text-lg transition-colors ${
                                editAcc?.icon_id === id ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted"
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-6 flex gap-2 justify-end">
                        <Button onClick={save} disabled={!editAcc.name?.trim()}>
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditAcc(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AccountIcon iconId={a.icon_id} className="h-5 w-5 shrink-0" />
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.bank_name ? `${a.bank_name} • ` : ""}
                            {a.account_type} • {a.currency} • {personLabel(people, a.person_id)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => startEdit(a)}>
                          Edit
                        </Button>
                        <Button variant="destructive" onClick={() => void removeAccount(a)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

