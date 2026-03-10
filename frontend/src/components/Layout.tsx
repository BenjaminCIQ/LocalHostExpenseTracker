import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
      <div className="min-w-0 flex-1 flex flex-col">
        <TopBar onToggleSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
