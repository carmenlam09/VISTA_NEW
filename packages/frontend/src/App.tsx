import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { AdverseMediaPage } from "@/pages/AdverseMediaPage";
import { IntakePage } from "@/pages/IntakePage";
import { KnowledgeRepositoryPage } from "@/pages/KnowledgeRepositoryPage";
import { KyvReportPage } from "@/pages/KyvReportPage";
import { ModulePage } from "@/pages/ModulePage";
import { ScreeningPage } from "@/pages/ScreeningPage";
import { TriagePage } from "@/pages/TriagePage";
import { VendorListPage } from "@/pages/VendorListPage";
import { VendorProfilePage } from "@/pages/VendorProfilePage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<VendorListPage />} />
        <Route path="/knowledge-repository" element={<KnowledgeRepositoryPage />} />
        <Route path="/vendor/:vendorId" element={<VendorProfilePage />} />
        <Route path="/vendor/:vendorId/intake" element={<IntakePage />} />
        <Route path="/vendor/:vendorId/screening" element={<ScreeningPage />} />
        <Route path="/vendor/:vendorId/adverse-media" element={<AdverseMediaPage />} />
        <Route path="/vendor/:vendorId/triage" element={<TriagePage />} />
        <Route path="/vendor/:vendorId/kyv-report" element={<KyvReportPage />} />
        <Route path="/vendor/:vendorId/:moduleSlug" element={<ModulePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
