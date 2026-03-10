import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type AuthMe } from "@/lib/api";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  person: AuthMe["person"];
  isAdmin: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [person, setPerson] = useState<AuthMe["person"]>(null);

  async function refreshAuth() {
    try {
      const me = await api.getAuthMe();
      setAuthenticated(Boolean(me.authenticated));
      setPerson(me.person ?? null);
      if (me.authenticated && me.person) {
        const current = localStorage.getItem("selected_person_id");
        if (!current) {
          localStorage.setItem("selected_person_id", String(me.person.id));
          window.dispatchEvent(new Event("person-filter-changed"));
        }
      }
    } catch {
      setAuthenticated(false);
      setPerson(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setAuthenticated(false);
      setPerson(null);
      localStorage.removeItem("selected_person_id");
      window.dispatchEvent(new Event("person-filter-changed"));
    }
  }

  useEffect(() => {
    void refreshAuth();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      authenticated,
      person,
      isAdmin: Boolean(person?.is_admin),
      refreshAuth,
      logout,
    }),
    [authenticated, loading, person]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
