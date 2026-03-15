import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api, type AuthPersonOption } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { clearTourPromptPending, clearTourLocalStorageOnLogin, setTourPromptPending } from "@/lib/tour";

export default function SetPasswordPage() {
  const { authenticated, loading, refreshAuth } = useAuth();
  const [people, setPeople] = useState<AuthPersonOption[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const personId = Number(params.get("person_id") || 0);

  useEffect(() => {
    api
      .getAuthOptions()
      .then((res) => setPeople(res.persons))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load people"));
  }, []);

  const selected = useMemo(
    () => people.find((p) => p.id === personId) ?? null,
    [people, personId]
  );

  async function submit() {
    if (!personId || !password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    setTourPromptPending("/");
    try {
      await api.bootstrapAuth({ person_id: personId, password, remember_me: rememberMe });
      clearTourLocalStorageOnLogin(personId);
      await refreshAuth();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set password");
      clearTourPromptPending();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (authenticated) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md space-y-4 py-12">
      <h1 className="text-2xl font-bold">Set initial password</h1>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="text-sm text-muted-foreground">
            Person: <span className="font-medium text-foreground">{selected?.name ?? "Unknown"}</span>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Password</div>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Confirm password</div>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={!personId || !password || !confirmPassword || busy}>
              {busy ? "Saving..." : "Set password"}
            </Button>
            <Link className="text-sm text-muted-foreground underline" to="/login">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
