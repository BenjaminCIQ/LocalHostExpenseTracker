import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  Brain,
  ChartColumnBig,
  ChevronDown,
  CreditCard,
  GitBranch,
  Landmark,
  LayoutDashboard,
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

function SidebarLink({
  item,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={!expanded ? item.label : undefined}
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
}

function NavGroup({
  title,
  items,
  expanded,
  showDivider,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  expanded: boolean;
  showDivider?: boolean;
  onNavigate?: () => void;
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
        <SidebarLink key={item.to} item={item} expanded={expanded} onNavigate={onNavigate} />
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
  const [adminWarningCount, setAdminWarningCount] = useState(0);
  const [pinned, setPinned] = useState<boolean>(() => localStorage.getItem("sidebar_pinned") === "1");
  const [hovered, setHovered] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
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

  const navContent = (expanded: boolean, onNavigate?: () => void) => (
    <>
      <NavGroup title="Main" items={MAIN_ITEMS} expanded={expanded} onNavigate={onNavigate} />
      <NavGroup title="Accounts" items={ACCOUNT_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} />
      <NavGroup title="Configuration" items={CONFIG_ITEMS} expanded={expanded} showDivider onNavigate={onNavigate} />
      {isAdmin ? (
        <NavGroup
          title="Admin"
          items={ADMIN_ITEMS.map((item) => ({ ...item, badgeCount: adminWarningCount }))}
          expanded={expanded}
          showDivider
          onNavigate={onNavigate}
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
            <div className="rounded-md border border-border bg-background/80 p-2">
              <button
                type="button"
                onClick={() => setThemePanelOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" />
                  Theme
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
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center justify-center rounded-md px-0 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Palette className="h-4 w-4" />
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
