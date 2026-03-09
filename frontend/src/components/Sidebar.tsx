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
  Tags,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme, type ThemeName } from "@/lib/theme";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
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

const THEME_SWATCHES: Record<ThemeName, string[]> = {
  light: ["#4f46e5", "#0891b2", "#db2777"],
  dark: ["#60a5fa", "#22d3ee", "#a78bfa"],
  ocean: ["#0ea5a8", "#2563eb", "#06b6d4"],
  sunset: ["#ea580c", "#f59e0b", "#f43f5e"],
  forest: ["#2f855a", "#4d7c0f", "#84cc16"],
};

function SidebarLink({
  item,
  expanded,
}: {
  item: NavItem;
  expanded: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={!expanded ? item.label : undefined}
      aria-label={item.label}
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
    </NavLink>
  );
}

function NavGroup({
  title,
  items,
  expanded,
  showDivider,
}: {
  title: string;
  items: NavItem[];
  expanded: boolean;
  showDivider?: boolean;
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
        <SidebarLink key={item.to} item={item} expanded={expanded} />
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { theme, setTheme, themes } = useTheme();
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

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 z-30 shrink-0 overflow-y-auto border-r border-border bg-card/90 backdrop-blur transition-all duration-200",
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

        <NavGroup title="Main" items={MAIN_ITEMS} expanded={expanded} />
        <NavGroup title="Accounts" items={ACCOUNT_ITEMS} expanded={expanded} showDivider />
        <NavGroup title="Configuration" items={CONFIG_ITEMS} expanded={expanded} showDivider />

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
  );
}
