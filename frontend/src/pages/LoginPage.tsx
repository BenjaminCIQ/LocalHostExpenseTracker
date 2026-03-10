import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { api, type AuthPersonOption } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { authenticated, loading, refreshAuth } = useAuth();
  const [people, setPeople] = useState<AuthPersonOption[]>([]);
  const [personId, setPersonId] = useState<number | "">("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api
      .getAuthOptions()
      .then((res) => {
        setPeople(res.persons);
        if (!personId && res.persons.length > 0) setPersonId(res.persons[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load login options"));
  }, []);

  const selected = useMemo(
    () => people.find((p) => p.id === personId) ?? null,
    [people, personId]
  );

  async function submit() {
    if (!personId || !password.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api.login({ person_id: Number(personId), password, remember_me: rememberMe });
      await refreshAuth();
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from || "/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (authenticated) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md space-y-4 py-12">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Person</div>
          <select
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            value={personId}
            onChange={(e) => setPersonId(e.target.value ? Number(e.target.value) : "")}
          >
            {people.length === 0 ? <option value="">No people found</option> : null}
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {selected?.requires_password_setup ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">This person does not have a password yet.</p>
            <Link
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
              to={`/set-password?person_id=${selected.id}`}
            >
              Set initial password
            </Link>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Password</div>
              <input
                type="password"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
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
            <Button onClick={() => void submit()} disabled={!personId || !password.trim() || busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
