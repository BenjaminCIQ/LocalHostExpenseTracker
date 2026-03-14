import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink } from "react-router-dom";
import {
  AlertCircle,
  Brain,
  ChartColumnBig,
  ChevronDown,
  CreditCard,
  GitBranch,
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
import { useTheme, type ThemeName } from "@/lib/theme";
import { useTourOptional } from "@/lib/tour";
import {
  getStepIdForPath,
  isTourNavPath,
  TOUR_STEP_IDS,
  TOUR_STEP_LABELS,
  TOUR_STEP_PATHS,
  TOUR_STEP_PROMPTS,
  TOUR_STEP_DESCRIPTIONS,
} from "@/lib/tour";
import type { TourStepId } from "@/lib/tour";

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

/** Rich tooltip card: title, body copy, and text-style action (matches reference design). */
function TourRichTooltipCard({
  title,
  description,
  actionLabel,
  actionTo,
  isNextStep,
  className,
  onActionClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionTo?: string;
  isNextStep?: boolean;
  className?: string;
  onActionClick?: () => void;
}) {
  const actionClass =
    "mt-4 block font-bold text-xs uppercase tracking-wider text-primary hover:underline cursor-pointer";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white text-gray-900 shadow-xl p-4 text-left min-w-[260px] max-w-[320px] dark:bg-gray-100 dark:text-gray-900 dark:border-gray-300",
        className
      )}
      role="tooltip"
    >
      <p className={cn("font-bold text-sm", isNextStep ? "text-primary" : "text-gray-900 dark:text-gray-900")}>{title}</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-700 leading-relaxed">{description}</p>
      {actionTo ? (
        <Link to={actionTo} className={cn(actionClass, "text-primary")} onClick={onActionClick}>
          {actionLabel}
        </Link>
      ) : onActionClick ? (
        <button type="button" className={cn(actionClass, "border-0 bg-transparent p-0")} onClick={onActionClick}>
          {actionLabel}
        </button>
      ) : (
        <span className={actionClass}>{actionLabel}</span>
      )}
    </div>
  );
}

const GAP = 8;
const PORTAL_Z = 9999;

/** Renders children in a portal, positioned to the right of the trigger (so sidebar overflow doesn't clip). */
function TourTooltipPortal({
  show,
  triggerRef,
  placement,
  children,
}: {
  show: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  placement: "right-center" | "right-bottom";
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const updatePosition = useMemo(
    () => () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = rect.right + GAP;
      const top =
        placement === "right-center"
          ? rect.top + rect.height / 2
          : rect.bottom + GAP;
      setPosition({ left, top });
    },
    [triggerRef, placement]
  );

  useLayoutEffect(() => {
    if (!show) {
      setPosition(null);
      return;
    }
    const measure = () => {
      updatePosition();
    };
    measure();
    const rafId = requestAnimationFrame(measure);
    const timeoutId = window.setTimeout(measure, 50);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [show, updatePosition]);

  if (!show || !position) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    left: position.left,
    top: position.top,
    zIndex: PORTAL_Z,
    transform: placement === "right-center" ? "translateY(-50%)" : undefined,
  };

  return createPortal(
    <div style={style} className="tour-tooltip-portal">
      {children}
    </div>,
    document.body
  );
}

function SidebarLink({
  item,
  expanded,
  onNavigate,
  tourTarget,
  tourInfo,
}: {
  item: NavItem;
  expanded: boolean;
  onNavigate?: () => void;
  tourTarget?: TourStepCopy;
  tourInfo?: TourStepCopy;
}) {
  const [infoHovered, setInfoHovered] = useState(false);
  const [currentTargetHovered, setCurrentTargetHovered] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const Icon = item.icon;
  const isCurrentTarget = Boolean(tourTarget);
  const showInfoIcon = Boolean(tourInfo) && !isCurrentTarget;

  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={!expanded && !tourTarget && !showInfoIcon ? item.label : undefined}
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
      {isCurrentTarget && (
        <span className="ml-auto flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Click this next">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}
      {showInfoIcon && (
        <span
          className="tour-info-icon ml-auto flex shrink-0 inline-flex"
          style={{ animation: "tour-info-pulse 1.8s ease-in-out infinite", willChange: "transform" }}
          aria-label={`Info: ${tourInfo?.label}`}
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

  if (tourTarget) {
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
        <TourTooltipPortal show={currentTargetHovered} triggerRef={triggerRef} placement={expanded ? "right-center" : "right-bottom"}>
          <TourRichTooltipCard
            title={`Go here next: ${tourTarget.label}`}
            description={tourTarget.description}
            actionLabel={`Go to ${tourTarget.label}`}
            actionTo={item.to}
            isNextStep
            onActionClick={onNavigate}
          />
        </TourTooltipPortal>
      </div>
    );
  }

  if (showInfoIcon && tourInfo) {
    return (
      <div
        ref={triggerRef}
        className="relative"
        onMouseEnter={() => setInfoHovered(true)}
        onMouseLeave={() => setInfoHovered(false)}
      >
        {link}
        <TourTooltipPortal show={infoHovered} triggerRef={triggerRef} placement={expanded ? "right-center" : "right-bottom"}>
          <TourRichTooltipCard
            title={tourInfo.label}
            description={tourInfo.description}
            actionLabel={`Go to ${tourInfo.label}`}
            actionTo={item.to}
            onActionClick={onNavigate}
          />
        </TourTooltipPortal>
      </div>
    );
  }

  return link;
}

type TourStepCopy = { label: string; what: string; why: string; description: string };

function getTourTargetForPath(
  path: string,
  tourActive: boolean,
  nextStep: TourStepId | undefined
): TourStepCopy | undefined {
  if (!tourActive || !nextStep || nextStep === "themes") return undefined;
  if (TOUR_STEP_PATHS[nextStep] !== path) return undefined;
  return {
    label: TOUR_STEP_LABELS[nextStep],
    ...TOUR_STEP_PROMPTS[nextStep],
    description: TOUR_STEP_DESCRIPTIONS[nextStep],
  };
}

function getTourInfoForPath(
  path: string,
  tourActive: boolean,
  nextStep: TourStepId | undefined
): TourStepCopy | undefined {
  if (!tourActive || !isTourNavPath(path)) return undefined;
  if (getTourTargetForPath(path, tourActive, nextStep)) return undefined;
  const stepId = getStepIdForPath(path);
  if (!stepId) return undefined;
  return {
    label: TOUR_STEP_LABELS[stepId],
    ...TOUR_STEP_PROMPTS[stepId],
    description: TOUR_STEP_DESCRIPTIONS[stepId],
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
}: {
  title: string;
  items: NavItem[];
  expanded: boolean;
  showDivider?: boolean;
  onNavigate?: () => void;
  nextTourStep?: TourStepId;
  tourActive?: boolean;
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
          tourInfo={tourActive && nextTourStep ? getTourInfoForPath(item.to, tourActive, nextTourStep) : undefined}
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
  const navContent = (expanded: boolean, onNavigate?: () => void) => (
    <>
      <NavGroup title="Main" items={MAIN_ITEMS} expanded={expanded} onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} />
      <NavGroup title="Accounts" items={ACCOUNT_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} />
      <NavGroup title="Configuration" items={CONFIG_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} nextTourStep={nextTourStep} tourActive={tourActive} />
      {isAdmin ? (
        <NavGroup
          title="Admin"
          items={ADMIN_ITEMS.map((item) => ({ ...item, badgeCount: adminWarningCount }))}
          expanded={expanded}
          showDivider
          onNavigate={onNavigate}
          nextTourStep={nextTourStep}
          tourActive={tourActive}
        />
      ) : null}
    </>
  );

  return (
    <>
    <aside
      className={cn(
        "hidden lg:block h-screen sticky top-0 z-30 shrink-0 overflow-y-auto border-r border-border bg-card/90 backdrop-blur transition-all duration-200",
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
                else if (tourActive && nextTourStep !== "themes") setThemeInfoHovered(true);
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
              <TourTooltipPortal
                show={tourActive && nextTourStep !== "themes" && themeInfoHovered}
                triggerRef={themePanelRef}
                placement="right-center"
              >
                <TourRichTooltipCard
                  title="Themes"
                  description={TOUR_STEP_DESCRIPTIONS.themes}
                  actionLabel="Open theme panel below"
                  onActionClick={() => setThemePanelOpen(true)}
                />
              </TourTooltipPortal>
              {tourActive && nextTourStep === "themes" && (
                <TourTooltipPortal show={themeCurrentTargetHovered} triggerRef={themePanelRef} placement="right-center">
                  <TourRichTooltipCard
                    title="Go here next: Themes"
                    description={TOUR_STEP_DESCRIPTIONS.themes}
                    actionLabel="Open theme panel below"
                    isNextStep
                    onActionClick={() => setThemePanelOpen(true)}
                  />
                </TourTooltipPortal>
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
                  {tourActive && nextTourStep !== "themes" && (
                    <span
                      className="tour-info-icon flex shrink-0 inline-flex"
                      style={{ animation: "tour-info-pulse 1.8s ease-in-out infinite", willChange: "transform" }}
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
                else if (tourActive && nextTourStep !== "themes") setThemeInfoHovered(true);
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
              {!expanded && (
                <>
                  <TourTooltipPortal
                    show={tourActive && nextTourStep !== "themes" && themeInfoHovered}
                    triggerRef={themePanelCollapsedRef as RefObject<HTMLElement | null>}
                    placement="right-bottom"
                  >
                    <TourRichTooltipCard
                      title="Themes"
                      description={TOUR_STEP_DESCRIPTIONS.themes}
                      actionLabel="Open theme panel below"
                      onActionClick={() => setThemePanelOpen(true)}
                    />
                  </TourTooltipPortal>
                  {tourActive && nextTourStep === "themes" && (
                    <TourTooltipPortal show={themeCurrentTargetHovered} triggerRef={themePanelCollapsedRef as RefObject<HTMLElement | null>} placement="right-bottom">
                      <TourRichTooltipCard
                        title="Go here next: Themes"
                        description={TOUR_STEP_DESCRIPTIONS.themes}
                        actionLabel="Open theme panel below"
                        isNextStep
                        onActionClick={() => setThemePanelOpen(true)}
                      />
                    </TourTooltipPortal>
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
                {tourActive && nextTourStep !== "themes" && (
                  <span
                    className="tour-info-icon absolute -top-0.5 -right-0.5 inline-flex"
                    style={{ animation: "tour-info-pulse 1.8s ease-in-out infinite", willChange: "transform" }}
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
        <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto border-r border-border bg-card p-2 shadow-xl">
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
