import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TOUR_STEP_IDS, useTourOptional } from "@/lib/tour";
import type { TourStepId } from "@/lib/tour";

const STEP_LABELS: Record<TourStepId, string> = {
  transactions: "Transactions",
  accounts: "Bank Accounts",
  categories: "Categories",
  classification: "Classification",
  "transfer-linking": "Transfer Linking Rules",
  ml: "ML Status",
  import: "Import",
  "transactions-after": "View Transactions",
  "external-accounts": "External Accounts",
  analytics: "Analytics",
  themes: "Themes",
};

const STEP_PATHS: Record<TourStepId, string> = {
  transactions: "/transactions",
  accounts: "/accounts",
  categories: "/categories",
  classification: "/classification",
  "transfer-linking": "/transfer-linking-rules",
  ml: "/ml",
  import: "/import",
  "transactions-after": "/transactions",
  "external-accounts": "/external-accounts",
  analytics: "/analytics",
  themes: "/", // theme is in sidebar
};

export default function TourGuideStrip() {
  const tour = useTourOptional();
  if (!tour?.tourActive) return null;

  const nextStep = TOUR_STEP_IDS.find((id) => !tour.isStepCompleted(id));

  if (!nextStep) return null;

  const label = STEP_LABELS[nextStep];
  const path = STEP_PATHS[nextStep];

  return (
    <div className="border-b border-border bg-muted/50 px-3 py-2 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          Tour: {label}
        </span>
        {path !== "/" ? (
          <Link to={path}>
            <Button size="sm" variant="outline">
              Go to {label}
            </Button>
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">
            Open the Theme panel in the sidebar (bottom)
          </span>
        )}
      </div>
    </div>
  );
}
