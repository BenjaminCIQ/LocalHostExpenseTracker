import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  AlertCircle,
  Brain,
  ChartColumnBig,
  ChevronDown,
  CreditCard,
  GitBranch,
  HelpCircle,
  Info,
  Landmark,
  LayoutDashboard,
  Link2,
  List,
  Palette,
  Plane,
  Pin,
  PinOff,
  Shield,
  Tags,
  Target,
  Upload,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getPageHint } from "@/lib/hints";
import { useHintsContext } from "@/lib/hints";
import { useTheme, type ThemeName } from "@/lib/theme";
import { useTourOptional } from "@/lib/tour";
import {
  TOUR_STEP_IDS,
  TOUR_STEP_LABELS,
  TOUR_STEP_PATHS,
  TOUR_STEP_DESCRIPTIONS,
} from "@/lib/tour";
import type { TourStepId } from "@/lib/tour";
import {
  HintTooltipCard,
  HintTooltipPortal,
  type HintTooltipPlacement,
} from "@/components/HintTooltip";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeCount?: number;
};

const MAIN_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/analytics", label: "Analytics", icon: ChartColumnBig },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/transactions", label: "Transactions", icon: List },
  { to: "/trips", label: "Trips", icon: Plane },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { to: "/accounts", label: "Bank Accounts", icon: CreditCard },
  { to: "/external-accounts", label: "External Accounts", icon: Landmark },
];

const CONFIG_ITEMS: NavItem[] = [
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/classification", label: "Classification", icon: GitBranch },
  { to: "/transfer-linking-rules", label: "Transfer Linking Rules", icon: Link2 },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/people", label: "People", icon: Users },
  { to: "/ml", label: "ML Status", icon: Brain },
];

const ADMIN_ITEMS: NavItem[] = [{ to: "/admin", label: "Admin Console", icon: Shield }];

const THEME_SWATCHES: Record<ThemeName, string[]> = {
  light: ["#4f46e5", "#0891b2", "#db2777"],
  rose: ["#e11d48", "#db2777", "#f43f5e"],
  ocean: ["#0ea5a8", "#2563eb", "#06b6d4"],
  sunset: ["#ea580c", "#f59e0b", "#f43f5e"],
  forest: ["#2f855a", "#4d7c0f", "#84cc16"],
  dark: ["#60a5fa", "#22d3ee", "#a78bfa"],
  midnight: ["#818cf8", "#c084fc", "#e879f9"],
  nord: ["#88c0d0", "#81a1c1", "#a3be8c"],
  dracula: ["#bd93f9", "#ff79c6", "#50fa7b"],
  ember: ["#f97316", "#f59e0b", "#fcd34d"],
};

type PageHintOrTour = {
  label: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
};

function SidebarLink({
  item,
  expanded,
  onNavigate,
  tourTarget,
  pageHint,
  showHintsForNav,
  hintsOnly,
}: {
  item: NavItem;
  expanded: boolean;
  onNavigate?: () => void;
  tourTarget?: PageHintOrTour;
  pageHint?: PageHintOrTour | null;
  showHintsForNav: boolean;
  hintsOnly: boolean;
}) {
  const { pathname } = useLocation();
  const [infoHovered, setInfoHovered] = useState(false);
  const [currentTargetHovered, setCurrentTargetHovered] = useState(false);
  const [currentPageTooltipDismissed, setCurrentPageTooltipDismissed] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const Icon = item.icon;
  const isNextStep = Boolean(tourTarget);
  const isCurrentPage = !hintsOnly && pathname === item.to;
  const showInfoIcon =
    showHintsForNav && Boolean(pageHint) && !isNextStep && !isCurrentPage;
  const placement: HintTooltipPlacement =
    expanded ? "right-center" : "right-bottom";

  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={!expanded && !tourTarget && !showInfoIcon && !isCurrentPage ? item.label : undefined}
      aria-label={item.label}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-md border border-transparent text-sm font-medium transition-colors",
          expanded ? "gap-2 px-3 py-2" : "justify-center px-0 py-2",
          isActive
            ? "border-border/60 bg-accent text-accent-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {expanded && <span className="truncate">{item.label}</span>}
      {isNextStep && (
        <span className="ml-auto flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Click this next">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      {showInfoIcon && pageHint && (
        <span
          className={cn(
            "ml-auto flex shrink-0 inline-flex",
            hintsOnly ? "hint-info-icon-subdued" : "tour-info-icon"
          )}
          style={{
            animation: hintsOnly
              ? "hint-info-pulse-subdued 2.5s ease-in-out infinite"
              : "tour-info-pulse 1.8s ease-in-out infinite",
            willChange: "transform",
          }}
          aria-label={`Info: ${pageHint.label}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      {item.badgeCount && item.badgeCount > 0 ? (
        <span
          className={cn(
            "ml-auto inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground",
            expanded ? "min-w-5 px-1.5 py-0.5 text-[10px]" : "h-2.5 w-2.5"
          )}
          title={`${item.badgeCount} security warning${item.badgeCount === 1 ? "" : "s"}`}
        >
          {expanded ? item.badgeCount : null}
        </span>
      ) : null}
    </NavLink>
  );

  const hintForCard = pageHint ?? tourTarget;

  /* Current page in tour: tooltip open by default with X, then hover-only */
  if (isCurrentPage && pageHint) {
    const showTooltip = infoHovered || !currentPageTooltipDismissed;
    return (
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={() => setInfoHovered(true)}
        onMouseLeave={() => setInfoHovered(false)}
      >
        {link}
        <HintTooltipPortal show={showTooltip} triggerRef={triggerRef} placement={placement}>
          <HintTooltipCard
            hint={pageHint}
            titleOverride={`You're here: ${item.label}`}
            showCloseButton={!currentPageTooltipDismissed}
            onClose={() => setCurrentPageTooltipDismissed(true)}
          />
        </HintTooltipPortal>
      </div>
    );
  }

  /* Next step in tour: pulse ring, tooltip on hover only */
  if (tourTarget && hintForCard) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setCurrentTargetHovered(true)}
        onMouseLeave={() => setCurrentTargetHovered(false)}
      >
        <div
          ref={triggerRef}
          className={cn("relative rounded-md ring-2 ring-primary/60 ring-offset-2 ring-offset-card", expanded ? "mr-1" : "")}
        >
          <span className="absolute inset-0 rounded-md pointer-events-none" aria-hidden>
            <span className="tour-pulse-ring" />
            <span className="tour-pulse-ring tour-pulse-ring-delay" />
          </span>
          {link}
        </div>
        <HintTooltipPortal show={currentTargetHovered} triggerRef={triggerRef} placement={placement}>
          <HintTooltipCard
            hint={hintForCard}
            titleOverride={`Go here next: ${tourTarget.label}`}
            isNextStep
          />
        </HintTooltipPortal>
      </div>
    );
  }

  if (showInfoIcon && pageHint) {
    return (
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={() => setInfoHovered(true)}
        onMouseLeave={() => setInfoHovered(false)}
      >
        {link}
        <HintTooltipPortal show={infoHovered} triggerRef={triggerRef} placement={placement}>
          <HintTooltipCard hint={pageHint} />
        </HintTooltipPortal>
      </div>
    );
  }

  return link;
}

function getTourTargetForPath(
  path: string,
  tourActive: boolean,
  nextStep: TourStepId | undefined
): PageHintOrTour | undefined {
  if (!tourActive || !nextStep || nextStep === "themes") return undefined;
  if (TOUR_STEP_PATHS[nextStep] !== path) return undefined;
  return {
    label: TOUR_STEP_LABELS[nextStep],
    description: TOUR_STEP_DESCRIPTIONS[nextStep],
    actionLabel: `Go to ${TOUR_STEP_LABELS[nextStep]}`,
    actionTo: path,
  };
}

function NavGroup({
  title,
  items,
  expanded,
  showDivider,
  onNavigate,
  nextTourStep,
  tourActive,
  showHintsForNav,
  hintsOnly,
}: {
  title: string;
  items: NavItem[];
  expanded: boolean;
  showDivider?: boolean;
  onNavigate?: () => void;
  nextTourStep?: TourStepId;
  tourActive?: boolean;
  showHintsForNav: boolean;
  hintsOnly: boolean;
}) {
  return (
    <div className={cn("space-y-1", showDivider && "pt-3")}>
      {expanded ? (
        <div
          className={cn(
            "px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            showDivider && "border-t border-border pt-3"
          )}
        >
          {title}
        </div>
      ) : (
        showDivider && <div className="mx-2 my-2 border-t border-border" />
      )}
      {items.map((item) => (
        <SidebarLink
          key={item.to}
          item={item}
          expanded={expanded}
          onNavigate={onNavigate}
          tourTarget={tourActive && nextTourStep ? getTourTargetForPath(item.to, tourActive, nextTourStep) : undefined}
          pageHint={showHintsForNav ? getPageHint(item.to) : null}
          showHintsForNav={showHintsForNav}
          hintsOnly={hintsOnly}
        />
      ))}
    </div>
  );
}

export default function Sidebar({
  mobileOpen = false,
  onCloseMobile,
}: {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const { isAdmin } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const tour = useTourOptional();
  const nextTourStep = tour?.tourActive
    ? TOUR_STEP_IDS.find((id) => !tour.isStepCompleted(id))
    : undefined;
  const [adminWarningCount, setAdminWarningCount] = useState(0);
  const [pinned, setPinned] = useState<boolean>(() => localStorage.getItem("sidebar_pinned") === "1");
  const [hovered, setHovered] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [themeInfoHovered, setThemeInfoHovered] = useState(false);
  const [themeCurrentTargetHovered, setThemeCurrentTargetHovered] = useState(false);
  const themePanelRef = useRef<HTMLDivElement>(null);
  const themePanelCollapsedRef = useRef<HTMLDetailsElement>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("sidebar_pinned", pinned ? "1" : "0");
  }, [pinned]);

  useEffect(() => {
    return () => {
      if (openTimer.current) window.clearTimeout(openTimer.current);
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const expanded = useMemo(() => pinned || hovered, [pinned, hovered]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminWarningCount(0);
      return;
    }
    let cancelled = false;
    async function loadSecurityCount() {
      try {
        const events = await api.getAdminSecurityEvents(120);
        if (cancelled) return;
        const count = events.filter((event) => {
          const severity = (event.severity || "").toLowerCase();
          return severity === "warning" || severity === "critical";
        }).length;
        setAdminWarningCount(count);
      } catch {
        if (!cancelled) setAdminWarningCount(0);
      }
    }
    void loadSecurityCount();
    const timer = window.setInterval(() => {
      void loadSecurityCount();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAdmin]);

  const tourActive = Boolean(tour?.tourActive);
  const hintsContext = useHintsContext();
  const hintsEnabled = hintsContext?.hintsEnabled ?? false;
  const showHintsForNav = hintsEnabled || tourActive;
  const hintsOnly = hintsEnabled && !tourActive;
  const themeHint = getPageHint("theme");

  const navContent = (expanded: boolean, onNavigate?: () => void) => (
    <>
      <NavGroup title="Main" items={MAIN_ITEMS} expanded={expanded} onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} showHintsForNav={showHintsForNav} hintsOnly={hintsOnly} />
      <NavGroup title="Accounts" items={ACCOUNT_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} showHintsForNav={showHintsForNav} hintsOnly={hintsOnly} />
      <NavGroup title="Configuration" items={CONFIG_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} showHintsForNav={showHintsForNav} hintsOnly={hintsOnly} />
      {isAdmin ? (
        <NavGroup
          title="Admin"
          items={ADMIN_ITEMS.map((item) => ({ ...item, badgeCount: adminWarningCount }))}
          expanded={expanded}
          showDivider
          onNavigate={onNavigate}
          nextTourStep={nextTourStep}
          tourActive={tourActive}
          showHintsForNav={showHintsForNav}
          hintsOnly={hintsOnly}
        />
      ) : null}
    </>
  );

  return (
    <>
    <aside
      className={cn(
        "hidden lg:block h-screen sticky top-0 z-30 shrink-0 overflow-y-auto border-r border-border bg-card/90 backdrop-blur transition-all duration-200 sidebar-scroll-hide",
        expanded ? "w-56" : "w-14"
      )}
      onMouseEnter={() => {
        if (pinned) return;
        if (closeTimer.current) {
          window.clearTimeout(closeTimer.current);
          closeTimer.current = null;
        }
        if (openTimer.current) window.clearTimeout(openTimer.current);
        openTimer.current = window.setTimeout(() => setHovered(true), 150);
      }}
      onMouseLeave={() => {
        if (openTimer.current) {
          window.clearTimeout(openTimer.current);
          openTimer.current = null;
        }
        if (!pinned) {
          closeTimer.current = window.setTimeout(() => setHovered(false), 120);
        }
      }}
    >
      <div className="flex h-full flex-col p-2">
        <div className={cn("mb-2 flex items-center rounded-md", expanded ? "px-3 py-2" : "justify-center py-2")}>
          <div className="h-7 w-7 rounded-md bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">
            ET
          </div>
          {expanded && <span className="ml-2 text-sm font-semibold text-foreground">Expense Tracker</span>}
        </div>

        {navContent(expanded)}

        <div className="mt-auto space-y-2 pt-2">
          {expanded ? (
            <div
              ref={themePanelRef}
              className={cn(
                "rounded-md border border-border bg-background/80 p-2 relative",
                tourActive && nextTourStep === "themes" && "ring-2 ring-primary/60 ring-offset-2 ring-offset-card"
              )}
              onMouseEnter={() => {
                if (tourActive && nextTourStep === "themes") setThemeCurrentTargetHovered(true);
                else if (showHintsForNav) setThemeInfoHovered(true);
              }}
              onMouseLeave={() => {
                setThemeInfoHovered(false);
                setThemeCurrentTargetHovered(false);
              }}
            >
              {tourActive && nextTourStep === "themes" && (
                <span className="absolute inset-0 rounded-md pointer-events-none" aria-hidden>
                  <span className="tour-pulse-ring" />
                  <span className="tour-pulse-ring tour-pulse-ring-delay" />
                </span>
              )}
              {themeHint && (
                <>
                  <HintTooltipPortal
                    show={showHintsForNav && !(tourActive && nextTourStep === "themes") && themeInfoHovered}
                    triggerRef={themePanelRef}
                    placement="right-center"
                  >
                    <HintTooltipCard hint={themeHint} />
                  </HintTooltipPortal>
                  {tourActive && nextTourStep === "themes" && (
                    <HintTooltipPortal show={themeCurrentTargetHovered} triggerRef={themePanelRef} placement="right-center">
                      <HintTooltipCard hint={themeHint} titleOverride="Go here next: Themes" isNextStep />
                    </HintTooltipPortal>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => setThemePanelOpen((prev) => !prev)}
                className="relative flex w-full items-center justify-between rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" />
                  Theme
                  {tourActive && nextTourStep === "themes" && (
                    <span className="flex shrink-0 items-center rounded-full bg-primary text-primary-foreground" aria-label="Click this next">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  {showHintsForNav && !(tourActive && nextTourStep === "themes") && themeHint && (
                    <span
                      className={cn("flex shrink-0 inline-flex", hintsOnly ? "hint-info-icon-subdued" : "tour-info-icon")}
                      style={{
                        animation: hintsOnly ? "hint-info-pulse-subdued 2.5s ease-in-out infinite" : "tour-info-pulse 1.8s ease-in-out infinite",
                        willChange: "transform",
                      }}
                      aria-label="Info: Themes"
                    >
                      <Info className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  <span className="capitalize text-[11px] font-medium text-muted-foreground">
                    {theme}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      themePanelOpen && "rotate-180"
                    )}
                  />
                </span>
              </button>
              <div className={cn("mt-2 space-y-1", !themePanelOpen && "hidden")}>
                {themes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                      theme === option.id
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>{option.label}</span>
                    <span className="flex items-center gap-1">
                      {THEME_SWATCHES[option.id].map((swatch) => (
                        <span
                          key={`${option.id}-${swatch}`}
                          className="h-2.5 w-2.5 rounded-full border border-border/60"
                          style={{ backgroundColor: swatch }}
                        />
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <details
              ref={themePanelCollapsedRef}
              className={cn(
                "group relative",
                tourActive && nextTourStep === "themes" && "rounded-md ring-2 ring-primary/60 ring-offset-2 ring-offset-card"
              )}
              onMouseEnter={() => {
                if (tourActive && nextTourStep === "themes") setThemeCurrentTargetHovered(true);
                else if (showHintsForNav) setThemeInfoHovered(true);
              }}
              onMouseLeave={() => {
                setThemeInfoHovered(false);
                setThemeCurrentTargetHovered(false);
              }}
            >
              {tourActive && nextTourStep === "themes" && (
                <span className="absolute inset-0 rounded-md pointer-events-none" aria-hidden>
                  <span className="tour-pulse-ring" />
                  <span className="tour-pulse-ring tour-pulse-ring-delay" />
                </span>
              )}
              {!expanded && themeHint && (
                <>
                  <HintTooltipPortal
                    show={showHintsForNav && !(tourActive && nextTourStep === "themes") && themeInfoHovered}
                    triggerRef={themePanelCollapsedRef as RefObject<HTMLElement | null>}
                    placement="right-bottom"
                  >
                    <HintTooltipCard hint={themeHint} />
                  </HintTooltipPortal>
                  {tourActive && nextTourStep === "themes" && (
                    <HintTooltipPortal show={themeCurrentTargetHovered} triggerRef={themePanelCollapsedRef as RefObject<HTMLElement | null>} placement="right-bottom">
                      <HintTooltipCard hint={themeHint} titleOverride="Go here next: Themes" isNextStep />
                    </HintTooltipPortal>
                  )}
                </>
              )}
              <summary className="relative flex cursor-pointer list-none items-center justify-center rounded-md px-0 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Palette className="h-4 w-4" />
                {tourActive && nextTourStep === "themes" && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <AlertCircle className="h-2.5 w-2.5" aria-hidden />
                  </span>
                )}
                {showHintsForNav && !(tourActive && nextTourStep === "themes") && themeHint && (
                  <span
                    className={cn("absolute -top-0.5 -right-0.5 inline-flex", hintsOnly ? "hint-info-icon-subdued" : "tour-info-icon")}
                    style={{
                      animation: hintsOnly ? "hint-info-pulse-subdued 2.5s ease-in-out infinite" : "tour-info-pulse 1.8s ease-in-out infinite",
                      willChange: "transform",
                    }}
                  >
                    <Info className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </summary>
              <div className="absolute bottom-10 left-10 z-40 w-44 rounded-md border border-border bg-card p-2 shadow-lg">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Theme
                </div>
                <div className="space-y-1">
                  {themes.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1 text-xs",
                        theme === option.id
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{option.label}</span>
                      <span className="flex items-center gap-1">
                        {THEME_SWATCHES[option.id].map((swatch) => (
                          <span
                            key={`${option.id}-compact-${swatch}`}
                            className="h-2.5 w-2.5 rounded-full border border-border/60"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </details>
          )}
          <button
            type="button"
            title={hintsEnabled ? "Turn off Helpful hints" : "Turn on Helpful hints"}
            aria-label={hintsEnabled ? "Turn off Helpful hints" : "Turn on Helpful hints"}
            className={cn(
              "flex w-full items-center rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              expanded ? "gap-2 px-3 py-2" : "justify-center px-0 py-2"
            )}
            onClick={() => hintsContext?.setHintsEnabled(!hintsEnabled)}
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            {expanded && (
              <span className="flex-1 text-left">Helpful hints</span>
            )}
            {expanded && (
              <span className={cn("text-xs font-medium", hintsEnabled ? "text-primary" : "text-muted-foreground")}>
                {hintsEnabled ? "On" : "Off"}
              </span>
            )}
          </button>
          <button
            type="button"
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={cn(
              "flex w-full items-center rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              expanded ? "gap-2 px-3 py-2" : "justify-center px-0 py-2"
            )}
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              if (!next) setHovered(false);
            }}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {expanded && <span>{pinned ? "Unpin" : "Pin Open"}</span>}
          </button>
        </div>
      </div>
    </aside>
    {mobileOpen ? (
      <div className="fixed inset-0 z-40 lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Close navigation menu"
          onClick={onCloseMobile}
        />
        <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto overflow-x-hidden border-r border-border bg-card p-2 shadow-xl sidebar-scroll-hide">
          <div className="mb-2 flex items-center justify-between rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">
                ET
              </div>
              <span className="text-sm font-semibold text-foreground">Expense Tracker</span>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {navContent(true, onCloseMobile)}
          <div className="mt-3 rounded-md border border-border bg-background/80 p-2">
            <div className="mb-2 flex items-center justify-between rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="flex items-center gap-2">
                <Palette className="h-3.5 w-3.5" />
                Theme
              </span>
              <span className="capitalize text-[11px] font-medium">{theme}</span>
            </div>
            <div className="space-y-1">
              {themes.map((option) => (
                <button
                  key={`mobile-theme-${option.id}`}
                  type="button"
                  onClick={() => {
                    setTheme(option.id);
                    onCloseMobile?.();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs",
                    theme === option.id
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{option.label}</span>
                  <span className="flex items-center gap-1">
                    {THEME_SWATCHES[option.id].map((swatch) => (
                      <span
                        key={`mobile-${option.id}-${swatch}`}
                        className="h-2.5 w-2.5 rounded-full border border-border/60"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    ) : null}
    </>
  );
}
