import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, AlertCircle, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Account, type ImportProfile, type ImportResult, type PotentialDuplicate } from "@/lib/api";
import AccountIcon from "@/components/icons/AccountIcon";
import { useTourOptional } from "@/lib/tour";

export default function UploadPage({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tour = useTourOptional();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [selectedDuplicateKeys, setSelectedDuplicateKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    api.getAccounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0].id);
    });
    api
      .getImportProfiles()
      .then((ps) => setProfiles(ps.filter((p) => p.enabled)))
      .catch(() => setProfiles([]));
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!selectedAccount) return;
      setUploading(true);
      setError("");
      setResult(null);
      try {
        const res = await api.uploadFile(file, selectedAccount, selectedProfile);
        setLastFile(file);
        setResult(res);
        setSelectedDuplicateKeys(new Set(res.potential_duplicates.map((d) => d.duplicate_key)));
        const msg =
          res.duplicates_skipped > 0 || res.duplicate_overrides_applied > 0
            ? `${res.transactions_imported} transactions imported from ${res.filename}${res.duplicates_skipped > 0 ? ` (${res.duplicates_skipped} duplicates skipped)` : ""}${res.duplicate_overrides_applied > 0 ? ` · ${res.duplicate_overrides_applied} overrides applied` : ""}`
            : `${res.transactions_imported} transactions imported from ${res.filename}`;
        toast.success(msg, { duration: 5000 });
        if (tour?.tourActive) {
          tour.markStepCompleted("import");
          navigate("/transactions", { replace: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed";
        if (selectedProfile == null) {
          setError(
            `${msg} Auto-detect could not parse this file. Create an import profile with the correct column mapping (Profiles tab), or check the file format.`
          );
        } else {
          setError(
            `${msg} The selected import profile did not work for this file. Edit the profile or create a new one in the Profiles tab.`
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [selectedAccount, selectedProfile, tour, navigate]
  );

  const importSelectedDuplicates = useCallback(async () => {
    if (!selectedAccount || !lastFile || selectedDuplicateKeys.size === 0) return;
    setUploading(true);
    setError("");
      try {
        const res = await api.uploadFile(
          lastFile,
          selectedAccount,
          selectedProfile,
          Array.from(selectedDuplicateKeys)
        );
        setResult(res);
        setSelectedDuplicateKeys(new Set(res.potential_duplicates.map((d) => d.duplicate_key)));
        toast.success(
          `${res.duplicate_overrides_applied} duplicate overrides imported from ${res.filename}`,
          { duration: 5000 }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Duplicate override import failed";
        if (selectedProfile == null) {
          setError(`${msg} Try creating an import profile (Profiles tab) with the correct column mapping.`);
        } else {
          setError(`${msg} Edit the selected profile or create a new one in the Profiles tab.`);
        }
    } finally {
      setUploading(false);
    }
  }, [lastFile, selectedAccount, selectedDuplicateKeys, selectedProfile]);

  function toggleDup(item: PotentialDuplicate) {
    setSelectedDuplicateKeys((prev) => {
      const next = new Set(prev);
      if (next.has(item.duplicate_key)) next.delete(item.duplicate_key);
      else next.add(item.duplicate_key);
      return next;
    });
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload]
  );

  const isOnImportPage = location.pathname === "/import";
  const showSampleButtons = Boolean(tour?.tourActive && isOnImportPage);
  const [uploadingSample, setUploadingSample] = useState<"main" | "savings" | null>(null);

  const uploadSample = useCallback(
    async (which: "main" | "savings") => {
      if (!selectedAccount) return;
      setUploadingSample(which);
      setError("");
      setResult(null);
      try {
        const file = await api.getExampleCsv(which);
        const res = await api.uploadFile(file, selectedAccount, null);
        setLastFile(file);
        setResult(res);
        setSelectedDuplicateKeys(new Set(res.potential_duplicates.map((d) => d.duplicate_key)));
        const label = which === "main" ? "Main account sample" : "Savings account sample";
        toast.success(`${res.transactions_imported} transactions imported from ${label}`);
        if (tour?.tourActive) {
          tour.markStepCompleted("import");
          navigate("/transactions", { replace: true });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sample upload failed");
      } finally {
        setUploadingSample(null);
      }
    },
    [selectedAccount, tour, navigate]
  );

  return (
    <div className="space-y-6">
      {!embedded && <h2 className="text-2xl font-bold">Upload Bank Statement</h2>}

      {showSampleButtons && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="font-medium mb-2">Upload sample transactions (tour)</p>
            <p className="text-sm text-muted-foreground mb-4">
              Select the account above, then click to upload the main or savings sample. Auto-detect is used; no import profile needed.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                disabled={!selectedAccount || uploading !== false || uploadingSample !== null}
                onClick={() => void uploadSample("main")}
              >
                <FileUp className="h-4 w-4" />
                {uploadingSample === "main" ? "Uploading…" : "Upload main account sample"}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                disabled={!selectedAccount || uploading !== false || uploadingSample !== null}
                onClick={() => void uploadSample("savings")}
              >
                <FileUp className="h-4 w-4" />
                {uploadingSample === "savings" ? "Uploading…" : "Upload savings account sample"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Account</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <Button
                  key={acc.id}
                  variant={selectedAccount === acc.id ? "default" : "outline"}
                  onClick={() => setSelectedAccount(acc.id)}
                  title={acc.name}
                  className="flex items-center gap-2"
                >
                  <AccountIcon iconId={acc.icon_id} className="h-4 w-4 shrink-0" />
                  {acc.name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-muted-foreground">
              No import profiles found. Upload will use automatic header detection.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">Profile</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProfile ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedProfile(v ? Number(v) : null);
                }}
              >
                <option value="">Auto-detect</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={async () => {
                  const ps = await api.getImportProfiles();
                  setProfiles(ps.filter((p) => p.enabled));
                }}
              >
                Refresh
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`
              border-2 border-dashed rounded-lg p-12
              flex flex-col items-center justify-center gap-4
              transition-colors cursor-pointer
              ${dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50"}
            `}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <Upload
              className={`h-12 w-12 ${dragOver ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-center">
              <p className="text-lg font-medium">
                {uploading
                  ? "Uploading..."
                  : "Drop your bank statement here"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports CSV files. MT940 and CAMT coming soon.
              </p>
            </div>
            <Button variant="outline" disabled={uploading || !selectedAccount}>
              Browse Files
            </Button>
            <input
              id="file-input"
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>
        </CardContent>
      </Card>

      {result && result.potential_duplicates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Potential duplicates ({result.potential_duplicates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These rows were skipped to avoid duplicate imports. Select any that are true positives to include anyway.
            </p>
            <div className="max-h-80 overflow-auto space-y-2">
              {result.potential_duplicates.map((dup) => (
                <label key={dup.duplicate_key} className="flex gap-3 rounded-md border border-border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDuplicateKeys.has(dup.duplicate_key)}
                    onChange={() => toggleDup(dup)}
                  />
                  <div className="space-y-1">
                    <div>
                      <span className="font-medium">Rating {(dup.rating * 100).toFixed(0)}%</span>
                      <span className="text-muted-foreground"> · {dup.reason}</span>
                    </div>
                    <div className="text-xs">
                      Incoming: {dup.incoming_date} · {dup.incoming_amount.toFixed(2)} {dup.incoming_currency} · {dup.incoming_merchant || dup.incoming_description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Existing #{dup.existing_transaction_id}: {dup.existing_date} · {dup.existing_amount.toFixed(2)} {dup.existing_currency} · {dup.existing_merchant || dup.existing_description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => void importSelectedDuplicates()}
                disabled={uploading || selectedDuplicateKeys.size === 0 || !lastFile}
              >
                Import selected duplicates anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium">Upload Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
