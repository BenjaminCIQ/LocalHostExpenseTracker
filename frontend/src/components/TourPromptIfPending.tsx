import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  clearTourPromptPending,
  getTourPromptDone,
  getTourPromptPending,
  setTourPromptDone,
  setTourStartNextLoad,
  useTourOptional,
} from "@/lib/tour";

export default function TourPromptIfPending() {
  const { person } = useAuth();
  const tour = useTourOptional();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [fromPath, setFromPath] = useState("/");

  useEffect(() => {
    const pendingFrom = getTourPromptPending();
    const personId = person?.id ?? null;
    const tourDone = personId !== null ? getTourPromptDone(personId) : false;
    // #region agent log
    const _logData = { pendingFrom, personId, tourDone, willReturnEarly: pendingFrom === null || !person || tourDone };
    const _logEffect = { sessionId: '14f1be', location: 'TourPromptIfPending.tsx:useEffect', message: 'Effect ran', data: _logData, timestamp: Date.now(), hypothesisId: 'H2_H3_H4' };
    console.log('[TourDebug]', _logEffect);
    fetch('http://127.0.0.1:7587/ingest/0bbc1a12-ca1b-43b3-92f0-6f91d46a2dfe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '14f1be' }, body: JSON.stringify(_logEffect) }).catch(() => {});
    // #endregion
    if (pendingFrom === null || !person) return;
    if (getTourPromptDone(person.id)) {
      clearTourPromptPending();
      return;
    }
    setFromPath(pendingFrom);
    setShow(true);
    // #region agent log
    const _logShow = { sessionId: '14f1be', location: 'TourPromptIfPending.tsx:useEffect:setShowTrue', message: 'Setting show=true for tour modal', data: { pendingFrom }, timestamp: Date.now(), hypothesisId: 'H2_H3_H4' };
    console.log('[TourDebug]', _logShow);
    fetch('http://127.0.0.1:7587/ingest/0bbc1a12-ca1b-43b3-92f0-6f91d46a2dfe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '14f1be' }, body: JSON.stringify(_logShow) }).catch(() => {});
    // #endregion
  }, [person?.id]);

  function handleChoice(takeTour: boolean) {
    if (!person) return;
    setTourPromptDone(person.id);
    clearTourPromptPending();
    setShow(false);
    if (takeTour) {
      setTourStartNextLoad();
      tour?.setTourActive(true);
      navigate("/transactions", { replace: true });
    } else {
      navigate(fromPath, { replace: true });
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">Would you like to take a short tour?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We can walk you through adding an account, importing demo data, and exploring the app.
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={() => handleChoice(true)} className="flex-1">
            Yes, take the tour
          </Button>
          <Button variant="outline" onClick={() => handleChoice(false)} className="flex-1">
            No, go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
