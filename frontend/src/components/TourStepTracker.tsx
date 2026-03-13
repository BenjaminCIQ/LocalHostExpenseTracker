import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTourOptional } from "@/lib/tour";
import type { TourStepId } from "@/lib/tour";

const PATH_TO_STEP: Record<string, TourStepId> = {
  "/transactions": "transactions",
  "/accounts": "accounts",
  "/categories": "categories",
  "/classification": "classification",
  "/transfer-linking-rules": "transfer-linking",
  "/ml": "ml",
  "/import": "import",
  "/external-accounts": "external-accounts",
  "/analytics": "analytics",
};

export default function TourStepTracker() {
  const location = useLocation();
  const tour = useTourOptional();

  useEffect(() => {
    if (!tour?.tourActive) return;
    const path = location.pathname;
    const step = PATH_TO_STEP[path];
    if (step) {
      tour.markStepCompleted(step);
      if (path === "/transactions" && tour.isStepCompleted("import")) {
        tour.markStepCompleted("transactions-after");
      }
    }
  }, [location.pathname, tour]);

  return null;
}
