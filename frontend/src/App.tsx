import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import BudgetPage from "@/pages/BudgetPage";
import TransactionsPage from "@/pages/TransactionsPage";
import TripsPage from "@/pages/TripsPage";
import MlStatusPage from "@/pages/MlStatusPage";
import CategoriesPage from "@/pages/CategoriesPage";
import PeoplePage from "@/pages/PeoplePage";
import AccountsPage from "@/pages/AccountsPage";
import ExternalAccountsPage from "@/pages/ExternalAccountsPage";
import ImportPage from "@/pages/ImportPage";
import ClassificationPage from "@/pages/ClassificationPage";
import TransferLinkingRulesPage from "@/pages/TransferLinkingRulesPage";
import AdminPage from "@/pages/AdminPage";
import LoginPage from "@/pages/LoginPage";
import SetPasswordPage from "@/pages/SetPasswordPage";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { TourProvider } from "@/lib/tour";

function RequireAuthLayout() {
  const { authenticated, loading, person } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <TourProvider personId={person?.id ?? null}>
      <Layout />
    </TourProvider>
  );
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { authenticated, loading } = useAuth();
  // #region agent log
  if (authenticated) {
    const _logAuth = { sessionId: '14f1be', location: 'App.tsx:PublicOnlyRoute', message: 'Rendering with authenticated=true, will redirect', data: { authenticated }, timestamp: Date.now(), hypothesisId: 'H5' };
    console.log('[TourDebug]', _logAuth);
    fetch('http://127.0.0.1:7587/ingest/0bbc1a12-ca1b-43b3-92f0-6f91d46a2dfe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '14f1be' }, body: JSON.stringify(_logAuth) }).catch(() => {});
  }
  // #endregion
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (authenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <Toaster position="top-center" richColors closeButton />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/set-password" element={<PublicOnlyRoute><SetPasswordPage /></PublicOnlyRoute>} />

          <Route element={<RequireAuthLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/budgets" element={<BudgetPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/trips" element={<TripsPage />} />
            <Route path="/ml" element={<MlStatusPage />} />
            <Route path="/people" element={<PeoplePage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/external-accounts" element={<ExternalAccountsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/classification" element={<ClassificationPage />} />
            <Route path="/transfer-linking-rules" element={<TransferLinkingRulesPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
