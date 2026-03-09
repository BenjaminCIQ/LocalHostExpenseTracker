import { useEffect, useState } from "react";
import { api, type Person } from "@/lib/api";

export default function TopBar() {
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

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <h1 className="text-base sm:text-lg font-semibold text-primary">Expense Tracker</h1>
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
      </div>
    </header>
  );
}
