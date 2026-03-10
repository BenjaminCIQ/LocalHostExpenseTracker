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
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

function RequireAuthLayout() {
  const { authenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Layout />;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const { authenticated, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Checking session...</div>;
  if (authenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
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
