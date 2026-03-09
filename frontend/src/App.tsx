import { Routes, Route } from "react-router-dom";
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
import { ThemeProvider } from "@/lib/theme";

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<Layout />}>
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
          <Route path="/import" element={<ImportPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
