import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, type Person } from "@/lib/api";
import PersonIcon from "@/components/icons/PersonIcon";
import { useAuth } from "@/lib/auth";
import { useTourOptional } from "@/lib/tour";
import { END_TOUR_CLICK_EVENT } from "@/components/TourGuideStrip";

export default function TopBar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { person, logout } = useAuth();
  const navigate = useNavigate();
  const tour = useTourOptional();
  const [showEndTourModal, setShowEndTourModal] = useState(false);
  const [endingTour, setEndingTour] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(() => {
    const raw = localStorage.getItem("selected_person_id");
    return raw ? Number(raw) : null;
  });

  useEffect(() => {
    api.getPersons().then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    const handler = () => api.getPersons().then(setPeople).catch(() => setPeople([]));
    window.addEventListener("people-updated", handler);
    return () => window.removeEventListener("people-updated", handler);
  }, []);

  useEffect(() => {
    if (selectedPersonId) localStorage.setItem("selected_person_id", String(selectedPersonId));
    else localStorage.removeItem("selected_person_id");
    window.dispatchEvent(new Event("person-filter-changed"));
  }, [selectedPersonId]);

  useEffect(() => {
    const handler = () => setShowEndTourModal(true);
    window.addEventListener(END_TOUR_CLICK_EVENT, handler);
    return () => window.removeEventListener(END_TOUR_CLICK_EVENT, handler);
  }, []);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  async function handleEndTour(deleteDemoData: boolean) {
    if (!tour) return;
    setEndingTour(true);
    try {
      await tour.endTour(deleteDemoData);
      setShowEndTourModal(false);
      navigate("/", { replace: true });
    } finally {
      setEndingTour(false);
    }
  }

  return (
    <>
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="min-h-14 px-3 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {tour?.tourActive ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEndTourModal(true)}
              className="gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              End tour
            </Button>
          ) : null}
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
            {selectedPersonId && (
              <PersonIcon
                iconId={people.find((p) => p.id === selectedPersonId)?.icon_id}
                title={people.find((p) => p.id === selectedPersonId)?.name}
                className="h-4 w-4 shrink-0"
              />
            )}
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
    {showEndTourModal && tour ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
          <h2 className="text-lg font-semibold">End tour</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Would you like to remove all demo data (accounts and transactions created during the tour) and start with a fresh slate? Your login account will not be affected.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-3">
              <Button
                onClick={() => handleEndTour(true)}
                disabled={endingTour}
                variant="default"
                className="flex-1"
              >
                {endingTour ? "Removing…" : "Delete demo data and start fresh"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleEndTour(false)}
                disabled={endingTour}
                className="flex-1"
              >
                Keep data and exit
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => setShowEndTourModal(false)}
              disabled={endingTour}
              className="w-full"
            >
              Cancel — continue tour
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
