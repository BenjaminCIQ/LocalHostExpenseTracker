import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Person } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function TopBar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { person, logout } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(() => {
    const raw = localStorage.getItem("selected_person_id");
    return raw ? Number(raw) : null;
  });

  useEffect(() => {
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (selectedPersonId) localStorage.setItem("selected_person_id", String(selectedPersonId));
    else localStorage.removeItem("selected_person_id");
    window.dispatchEvent(new Event("person-filter-changed"));
  }, [selectedPersonId]);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="min-h-14 px-3 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background lg:hidden"
            onClick={onToggleSidebar}
            aria-label="Open navigation menu"
            title="Menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-primary">Expense Tracker</h1>
        </div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1">
            <span className="text-xs text-muted-foreground">View</span>
            <select
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
              value={selectedPersonId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedPersonId(v ? Number(v) : null);
              }}
            >
              <option value="">Household</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Signed in: {person?.name ?? "Unknown"}
          </span>
          <Button size="sm" variant="outline" onClick={() => void onLogout()}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
