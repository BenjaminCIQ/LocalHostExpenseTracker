import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  api,
  type Account,
  type TransferLinkingRule,
  type TransferLinkingRuleCreate,
} from "@/lib/api";
import AccountIcon from "@/components/icons/AccountIcon";
import { useSelectedPersonId } from "@/lib/personFilter";
import { Play } from "lucide-react";

const DEFAULT_RULE: TransferLinkingRuleCreate = {
  name: "",
  source_account_id: 0,
  target_account_id: 0,
  source_keywords: "",
  target_keywords: "",
  date_window_days: 3,
  amount_tolerance_abs: 0.01,
  amount_tolerance_pct: 0.01,
  enabled: true,
};

export default function TransferLinkingRulesPage() {
  const selectedPersonId = useSelectedPersonId();
  const [rules, setRules] = useState<TransferLinkingRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState("");
  const [applyResult, setApplyResult] = useState<{
    pairs_linked: number;
    pairs_ambiguous: number;
    pairs_no_rule: number;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [form, setForm] = useState<TransferLinkingRuleCreate>(DEFAULT_RULE);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TransferLinkingRuleCreate | null>(null);

  const load = async () => {
    try {
      const [rulesRes, accountsRes] = await Promise.all([
        api.getTransferLinkingRules(),
        api.getAccounts(),
      ]);
      setRules(rulesRes);
      setAccounts(accountsRes);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    if (!form.source_account_id || !form.target_account_id) {
      setError("Select source and target accounts");
      return;
    }
    if (form.source_account_id === form.target_account_id) {
      setError("Source and target accounts must be different");
      return;
    }
    try {
      await api.createTransferLinkingRule(form);
      setForm({ ...DEFAULT_RULE, source_account_id: form.source_account_id, target_account_id: form.target_account_id });
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const startEdit = (r: TransferLinkingRule) => {
    setEditingId(r.id);
    setEditForm({
      name: r.name,
      source_account_id: r.source_account_id,
      target_account_id: r.target_account_id,
      source_keywords: r.source_keywords,
      target_keywords: r.target_keywords,
      date_window_days: r.date_window_days,
      amount_tolerance_abs: r.amount_tolerance_abs,
      amount_tolerance_pct: r.amount_tolerance_pct,
      enabled: r.enabled,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    if (!editForm.name.trim()) return;
    try {
      await api.updateTransferLinkingRule(editingId, editForm);
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await api.deleteTransferLinkingRule(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleApply = async () => {
    setApplying(true);
    setApplyResult(null);
    try {
      const result = await api.applyTransferLinkingRules(selectedPersonId ?? undefined);
      setApplyResult(result);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  const accountById = (id: number) => accounts.find((a) => a.id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transfer Linking Rules</h2>
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={handleApply}
            disabled={applying}
          >
            <Play className="h-4 w-4" />
            Apply rules
          </Button>
          <Link
            to="/transactions?tab=transfers"
            className={buttonVariants({ variant: "outline" })}
          >
            Transfer Review
          </Link>
        </div>
      </div>

      {error && <p className="text-destructive">{error}</p>}
      {applyResult && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          Linked {applyResult.pairs_linked} pair(s). {applyResult.pairs_ambiguous} ambiguous (multiple rules matched).
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Checking to Savings"
              />
            </div>
            <div />
            <div className="flex items-end gap-2">
              {form.source_account_id && (
                <AccountIcon
                  iconId={accounts.find((a) => a.id === form.source_account_id)?.icon_id}
                  title={accounts.find((a) => a.id === form.source_account_id)?.name}
                  className="h-4 w-4 shrink-0 mb-1"
                />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-sm text-muted-foreground">Source account (outflow)</label>
                <select
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.source_account_id || ""}
                onChange={(e) => setForm((s) => ({ ...s, source_account_id: Number(e.target.value) || 0 }))}
              >
                <option value="">Select...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              </div>
            </div>
            <div className="flex items-end gap-2">
              {form.target_account_id && (
                <AccountIcon
                  iconId={accounts.find((a) => a.id === form.target_account_id)?.icon_id}
                  title={accounts.find((a) => a.id === form.target_account_id)?.name}
                  className="h-4 w-4 shrink-0 mb-1"
                />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-sm text-muted-foreground">Target account (inflow)</label>
                <select
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.target_account_id || ""}
                onChange={(e) => setForm((s) => ({ ...s, target_account_id: Number(e.target.value) || 0 }))}
              >
                <option value="">Select...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Source keywords</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.source_keywords}
                onChange={(e) => setForm((s) => ({ ...s, source_keywords: e.target.value }))}
                placeholder="+ AND | OR () groups"
                title="Use + for AND, | for OR, () for grouping"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Target keywords</label>
              <input
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.target_keywords}
                onChange={(e) => setForm((s) => ({ ...s, target_keywords: e.target.value }))}
                placeholder="+ AND | OR () groups"
                title="Use + for AND, | for OR, () for grouping"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Date window (days)</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.date_window_days}
                onChange={(e) => setForm((s) => ({ ...s, date_window_days: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Amount tolerance (abs)</label>
              <input
                type="number"
                step={0.01}
                min={0}
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.amount_tolerance_abs}
                onChange={(e) => setForm((s) => ({ ...s, amount_tolerance_abs: Number(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Amount tolerance (%)</label>
              <input
                type="number"
                step={0.01}
                min={0}
                className="mt-1 w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={form.amount_tolerance_pct}
                onChange={(e) => setForm((s) => ({ ...s, amount_tolerance_pct: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-enabled"
                checked={form.enabled}
                onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))}
              />
              <label htmlFor="create-enabled" className="text-sm">Enabled</label>
            </div>
            <div>
              <Button onClick={handleCreate}>Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    <Badge variant={r.enabled ? "default" : "secondary"}>
                      {r.enabled ? "On" : "Off"}
                    </Badge>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <AccountIcon iconId={accountById(r.source_account_id)?.icon_id} className="h-3.5 w-3.5" />
                      {accountById(r.source_account_id)?.name ?? r.source_account_id}
                      {" → "}
                      <AccountIcon iconId={accountById(r.target_account_id)?.icon_id} className="h-3.5 w-3.5" />
                      {accountById(r.target_account_id)?.name ?? r.target_account_id}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {editingId === r.id ? (
                      <>
                        <Button size="sm" onClick={saveEdit}>Save</Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(r)}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}>Delete</Button>
                      </>
                    )}
                  </div>
                  {editingId === r.id && editForm && (
                    <div className="w-full mt-2 grid gap-2 md:grid-cols-2 text-sm">
                      <div>
                        <label className="text-muted-foreground">Source keywords</label>
                        <input
                          className="mt-1 w-full h-8 rounded border px-2 text-sm"
                          value={editForm.source_keywords}
                          onChange={(e) => setEditForm((s) => s ? { ...s, source_keywords: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground">Target keywords</label>
                        <input
                          className="mt-1 w-full h-8 rounded border px-2 text-sm"
                          value={editForm.target_keywords}
                          onChange={(e) => setEditForm((s) => s ? { ...s, target_keywords: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground">Date window (days)</label>
                        <input
                          type="number"
                          className="mt-1 w-full h-8 rounded border px-2 text-sm"
                          value={editForm.date_window_days}
                          onChange={(e) => setEditForm((s) => s ? { ...s, date_window_days: Number(e.target.value) } : null)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.enabled}
                          onChange={(e) => setEditForm((s) => s ? { ...s, enabled: e.target.checked } : null)}
                        />
                        <label>Enabled</label>
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
