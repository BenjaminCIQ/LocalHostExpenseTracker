import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { NavLink } from "react-router-dom";
import {
  Brain,
  ChartColumnBig,
  CreditCard,
  GitBranch,
  Landmark,
  LayoutDashboard,
  List,
  Plane,
  Pin,
  PinOff,
  Tags,
  Target,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [pinned, setPinned] = useState<boolean>(() => localStorage.getItem("sidebar_pinned") === "1");
  const [hovered, setHovered] = useState(false);
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
        "h-screen sticky top-0 z-30 shrink-0 border-r border-border bg-card/90 backdrop-blur transition-all duration-200",
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

        <div className="mt-auto pt-2">
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
