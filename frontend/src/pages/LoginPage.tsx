import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/PasswordInput";
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
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api
      .getAuthOptions()
      .then((res) => {
        setPeople(res.persons);
        if (!personId && res.persons.length > 0) setPersonId(res.persons[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load login options"))
      .finally(() => setOptionsLoaded(true));
  }, []);

  const selected = useMemo(
    () => people.find((p) => p.id === personId) ?? null,
    [people, personId]
  );

  const showCreateAccount = optionsLoaded && people.length === 0;

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

  if (showCreateAccount) {
    return (
      <CreateAccountForm
        onSuccess={() => {
          refreshAuth()
            .then(() => {
              const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
              navigate(from || "/", { replace: true });
            })
            .catch(() => {
              navigate("/login", { replace: true, state: { from: (location.state as { from?: { pathname?: string } } | null)?.from } });
            });
        }}
      />
    );
  }

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
            <div className="flex flex-col gap-2">
              <Link
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                to={`/set-password?person_id=${selected.id}`}
              >
                Set initial password
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">Password</div>
              <PasswordInput
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

function CreateAccountForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !password) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.setupFirstUser({ name: name.trim(), password, remember_me: rememberMe });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-12">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-muted-foreground">
        No users yet. Enter your name and set a password to get started.
      </p>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Your name</div>
          <input
            type="text"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="e.g. Benjamin"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Password</div>
          <PasswordInput
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Confirm password</div>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
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
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => void submit()}
            disabled={!name.trim() || !password || password !== confirmPassword || busy}
          >
            {busy ? "Creating..." : "Create account"}
          </Button>
        </div>
      </div>
    </div>
  );
}
