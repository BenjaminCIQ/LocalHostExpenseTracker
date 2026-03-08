import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import TransactionsPage from "@/pages/TransactionsPage";
import UploadPage from "@/pages/UploadPage";
import MlStatusPage from "@/pages/MlStatusPage";
import OverridesPage from "@/pages/OverridesPage";
import RulesPage from "@/pages/RulesPage";
import CategoriesPage from "@/pages/CategoriesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/ml" element={<MlStatusPage />} />
        <Route path="/overrides" element={<OverridesPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Route>
    </Routes>
  );
}
