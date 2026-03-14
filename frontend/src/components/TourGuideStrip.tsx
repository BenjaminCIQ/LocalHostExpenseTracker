import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_STEP_IDS, TOUR_STEP_LABELS, useTourOptional } from "@/lib/tour";

export const END_TOUR_CLICK_EVENT = "tour-open-end-modal";

export function openEndTourModal() {
  window.dispatchEvent(new CustomEvent(END_TOUR_CLICK_EVENT));
}

export default function TourGuideStrip() {
  const tour = useTourOptional();
  if (!tour?.tourActive) return null;

  const nextStep = TOUR_STEP_IDS.find((id) => !tour.isStepCompleted(id));
  const label = nextStep ? TOUR_STEP_LABELS[nextStep] : null;

  return (
    <div className="border-b border-border bg-primary/5 px-3 py-2.5 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-medium text-primary">Guided tour</span>
          {nextStep ? (
            <span className="text-muted-foreground">Next: {label}</span>
          ) : (
            <span className="text-muted-foreground">All steps done</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openEndTourModal()}
          className="gap-1.5 shrink-0"
        >
          <XCircle className="h-4 w-4" />
          End tour
        </Button>
      </div>
    </div>
  );
}
