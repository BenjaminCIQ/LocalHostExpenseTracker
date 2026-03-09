import { useCallback, useEffect, useState } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Account, type ImportProfile, type ImportResult } from "@/lib/api";

export default function UploadPage({ embedded = false }: { embedded?: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
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
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [selectedAccount, selectedProfile]
  );

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

  return (
    <div className="space-y-6">
      {!embedded && <h2 className="text-2xl font-bold">Upload Bank Statement</h2>}

      <Card>
        <CardHeader>
          <CardTitle>Select Account</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="flex gap-2">
              {accounts.map((acc) => (
                <Button
                  key={acc.id}
                  variant={selectedAccount === acc.id ? "default" : "outline"}
                  onClick={() => setSelectedAccount(acc.id)}
                >
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

      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="font-medium">Import Successful</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>{result.transactions_imported}</strong> transactions
                  imported from <strong>{result.filename}</strong>
                  {result.duplicates_skipped > 0 && (
                    <span>
                      {" "}
                      ({result.duplicates_skipped} duplicates skipped)
                    </span>
                  )}
                </p>
              </div>
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
