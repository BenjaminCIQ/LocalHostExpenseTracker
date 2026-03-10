import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  api,
  type AdminPerson,
  type AdminSecurityEvent,
  type AdminSession,
  type Transaction,
} from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [people, setPeople] = useState<AdminPerson[]>([]);
  const [events, setEvents] = useState<AdminSecurityEvent[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [deletedTxns, setDeletedTxns] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [p, e, s, d] = await Promise.all([
        api.getAdminPersons(),
        api.getAdminSecurityEvents(80),
        api.getAdminSessions(false),
        api.getDeletedTransactions(200),
      ]);
      setPeople(p);
      setEvents(e);
      setSessions(s);
      setDeletedTxns(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load admin data");
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="text-sm text-muted-foreground">Admin access required.</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Admin Console</h2>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>People And Admin Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {people.map((person) => (
            <div key={person.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <div>
                <div className="font-medium">{person.name}</div>
                <div className="text-xs text-muted-foreground">
                  {person.has_password ? "Password set" : "No password"}{person.lockout_until ? ` • Locked until ${person.lockout_until}` : ""}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={person.is_admin}
                  onChange={async (e) => {
                    await api.setAdminForPerson(person.id, e.target.checked);
                    await load();
                  }}
                />
                admin
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {events.slice(0, 30).map((event) => (
            <div key={event.id} className="rounded-md border border-border p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">
                  [{event.severity}] {event.event_type}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</div>
              </div>
              <div>{event.message}</div>
              <div className="text-xs text-muted-foreground">
                {event.person_name ?? "Unknown"} • {event.ip_address || "-"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
              <div>
                <div className="font-medium">{session.person_name}</div>
                <div className="text-xs text-muted-foreground">
                  {session.ip_address || "-"} • last seen {new Date(session.last_seen_at).toLocaleString()}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await api.revokeAdminSession(session.id);
                  await load();
                }}
              >
                Revoke
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deleted Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deletedTxns.length === 0 ? (
            <div className="text-sm text-muted-foreground">No deleted transactions.</div>
          ) : (
            deletedTxns.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div>
                  <div className="font-medium">
                    {formatDate(txn.date)} • {formatCurrency(txn.amount)} • {txn.merchant || "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">{txn.delete_reason || "No reason"}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await api.restoreTransaction(txn.id);
                    await load();
                  }}
                >
                  Restore
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
