import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type ImportProfile } from "@/lib/api";

function splitCols(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinCols(cols: string[]): string {
  return cols.join(", ");
}

export default function ImportProfilesPage({ embedded = false }: { embedded?: boolean }) {
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [delimiter, setDelimiter] = useState<string>("");
  const [dateColumn, setDateColumn] = useState("Buchungstag");
  const [amountColumn, setAmountColumn] = useState("Betrag");
  const [currencyColumn, setCurrencyColumn] = useState("Waehrung");
  const [merchantColumns, setMerchantColumns] = useState(
    "Verwendungszweck, Beguenstigter/Zahlungspflichtiger"
  );
  const [descriptionColumns, setDescriptionColumns] = useState(
    "Buchungstext, Verwendungszweck, Info"
  );

  const canCreate = useMemo(() => {
    return (
      name.trim().length > 0 &&
      dateColumn.trim().length > 0 &&
      amountColumn.trim().length > 0
    );
  }, [name, dateColumn, amountColumn]);

  const load = async () => {
    const ps = await api.getImportProfiles();
    setProfiles(ps);
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const create = async () => {
    if (!canCreate) return;
    try {
      await api.createImportProfile({
        name: name.trim(),
        format: "csv",
        delimiter: delimiter.trim() ? delimiter.trim() : null,
        date_column: dateColumn.trim(),
        amount_column: amountColumn.trim(),
        currency_column: currencyColumn.trim() ? currencyColumn.trim() : null,
        merchant_columns: splitCols(merchantColumns),
        description_columns: splitCols(descriptionColumns),
        enabled: true,
      });
      setName("");
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const update = async (p: ImportProfile, patch: Partial<ImportProfile>) => {
    try {
      await api.updateImportProfile(p.id, patch);
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (p: ImportProfile) => {
    if (!confirm(`Delete import profile "${p.name}"?`)) return;
    try {
      await api.deleteImportProfile(p.id);
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!embedded && <h2 className="text-2xl font-bold">Import Profiles</h2>}
        <Button variant="outline" onClick={() => load().catch(() => {})}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Create profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Name</div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Bank CSV"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Delimiter (optional)
              </div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                placeholder="; , | or tab"
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Date column</div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Amount column</div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={amountColumn}
                onChange={(e) => setAmountColumn(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Currency column (optional)
              </div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={currencyColumn}
                onChange={(e) => setCurrencyColumn(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Merchant+Description columns (combined)
              </div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={merchantColumns}
                onChange={(e) => setMerchantColumns(e.target.value)}
                placeholder="Comma-separated header names"
              />
              <div className="text-xs text-muted-foreground">
                This influences merchant extraction.
              </div>
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="text-sm text-muted-foreground">
                Description columns (combined)
              </div>
              <input
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={descriptionColumns}
                onChange={(e) => setDescriptionColumns(e.target.value)}
                placeholder="Comma-separated header names"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={create} disabled={!canCreate}>
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profiles.length === 0 ? (
            <p className="text-muted-foreground">No profiles yet.</p>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="border border-border rounded-md p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => update(p, { enabled: !p.enabled })}
                      >
                        {p.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Date column</div>
                      <div className="font-mono">{p.date_column}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Amount column</div>
                      <div className="font-mono">{p.amount_column}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Merchant columns</div>
                      <div className="font-mono">
                        {joinCols(p.merchant_columns)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">
                        Description columns
                      </div>
                      <div className="font-mono">
                        {joinCols(p.description_columns)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Delimiter</div>
                      <div className="font-mono">{p.delimiter ?? "(auto)"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Currency column</div>
                      <div className="font-mono">
                        {p.currency_column ?? "(default EUR)"}
                      </div>
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

