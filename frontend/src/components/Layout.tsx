import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  List,
  Brain,
  Shield,
  GitBranch,
  Tags,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: List },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/ml", label: "ML Status", icon: Brain },
  { to: "/import-profiles", label: "Import Profiles", icon: SlidersHorizontal },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/overrides", label: "Overrides", icon: Shield },
  { to: "/rules", label: "Rules", icon: GitBranch },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-primary">Expense Tracker</h1>
            <nav className="flex gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
