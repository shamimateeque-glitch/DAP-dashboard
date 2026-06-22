import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages (code splitting)
const Index = React.lazy(() => import("./pages/Dashboard"));
const Login = React.lazy(() => import("./pages/Login"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const CaseList = React.lazy(() => import("./pages/Cases/CaseList"));
const NewCaseForm = React.lazy(() => import("./pages/Cases/NewCaseForm"));
const CaseDetail = React.lazy(() => import("./pages/Cases/CaseDetail"));
const EditCaseForm = React.lazy(() => import("./pages/Cases/EditCaseForm"));
const InvoiceList = React.lazy(() => import("./pages/Invoices/InvoiceList"));
const AlertsPage = React.lazy(() => import("./pages/Alerts/AlertsPage"));
const WorkflowListView = React.lazy(() => import("./pages/Workflow/WorkflowListView"));
const TeamPendingWork = React.lazy(() => import("./pages/Workflow/TeamPendingWork"));
const UsersPage = React.lazy(() => import("./pages/Admin/UsersPage"));
const AdminSettingsPage = React.lazy(() => import("./pages/Admin/SettingsPage"));

// Lazy-loaded reports
const FinanceReport = React.lazy(() => import("./pages/Reports/FinanceReport"));
const ClientReportsPage = React.lazy(() => import("./pages/Reports/ClientReportsPage"));
const CustomReport = React.lazy(() => import("./pages/Reports/CustomReport"));
const PendingWorkPage = React.lazy(() => import("./pages/Reports/PendingWorkPage"));
const PendingWorkReport = React.lazy(() => import("./pages/Reports/PendingWorkReport"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// The Investigation & Enforcement (field) team is locked to their financial-free area:
// only "My Pending Work" and individual case detail pages. Any other route (dashboard,
// invoices, reports, cases lists, admin) redirects them back to /my-pending-work. This
// is the route-level enforcement; the sidebar also hides those entries.
const TEAM_ALLOWED_PREFIXES = ["/my-pending-work", "/cases/"];

const InvestigationTeamGuard = ({ children }: { children: React.ReactNode }) => {
  const { isInvestigationTeam } = usePermissions();
  const location = useLocation();

  if (isInvestigationTeam) {
    const allowed = TEAM_ALLOWED_PREFIXES.some(
      (p) => location.pathname === p || location.pathname.startsWith(p)
    );
    if (!allowed) return <Navigate to="/my-pending-work" replace />;
  }

  return <>{children}</>;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner position="top-right" />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<Login />} />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute><InvestigationTeamGuard><MainLayout /></InvestigationTeamGuard></ProtectedRoute>}>
                    <Route path="/" element={<Index />} />

                    {/* Investigation & Enforcement team — financial-free pending work */}
                    <Route path="/my-pending-work" element={<TeamPendingWork />} />

                    {/* Cases */}
                    <Route path="/all-cases" element={<CaseList />} />
                    <Route path="/cases/:id" element={<CaseDetail />} />
                    <Route path="/cases/:id/edit" element={<EditCaseForm />} />
                    <Route path="/new-case" element={<NewCaseForm />} />
                    <Route path="/in-hand" element={<CaseList status="IN_HAND" />} />
                    <Route path="/uploaded" element={<CaseList status="UPLOADED" />} />
                    <Route path="/awaiting-decision" element={<CaseList status="AWAITING_DECISION" />} />
                    <Route path="/approved" element={<CaseList status="APPROVED" />} />
                    <Route path="/rejected" element={<CaseList status="REJECTED" />} />
                    <Route path="/closed" element={<CaseList status="CLOSED" />} />

                    {/* Workflow */}
                    <Route path="/in-depth" element={<WorkflowListView stage="in_depth" title="In-Depth Stage" />} />
                    <Route path="/enforcement" element={<WorkflowListView stage="enforcement" title="Enforcement Stage" />} />
                    <Route path="/destruction" element={<WorkflowListView stage="destruction" title="Destruction Stage" />} />

                    {/* Invoices */}
                    <Route path="/all-invoices" element={<InvoiceList />} />
                    <Route path="/invoices-unpaid" element={<InvoiceList status="NOT_PAID" />} />
                    <Route path="/invoices-due" element={<InvoiceList status="NOT_PAID" />} />
                    <Route path="/invoices-issued" element={<InvoiceList status="NOT_PAID" />} />
                    <Route path="/invoices-paid" element={<InvoiceList status="PAID" />} />
                    <Route path="/invoices-over-due" element={<InvoiceList status="OVERDUE" />} />

                    {/* Reports */}
                    <Route path="/finance"           element={<FinanceReport />} />
                    <Route path="/client-reports"    element={<ClientReportsPage />} />
                    <Route path="/custom-report"     element={<CustomReport />} />

                    {/* Pending Work Status Reports */}
                    <Route path="/pending-work"             element={<PendingWorkPage />} />
                    <Route path="/pending-work/upload"      element={<PendingWorkReport reportType="upload" />} />
                    <Route path="/pending-work/decision"    element={<PendingWorkReport reportType="decision" />} />
                    <Route path="/pending-work/in-depth"    element={<PendingWorkReport reportType="in-depth" />} />
                    <Route path="/pending-work/enforcement" element={<PendingWorkReport reportType="enforcement" />} />
                    <Route path="/pending-work/final-report" element={<PendingWorkReport reportType="final-report" />} />
                    <Route path="/pending-work/invoices"    element={<PendingWorkReport reportType="invoices" />} />
                    <Route path="/pending-work/destruction" element={<PendingWorkReport reportType="destruction" />} />

                    {/* Others */}
                    <Route path="/alerts-reminders" element={<AlertsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/settings" element={<AdminSettingsPage />} />
                  </Route>

                  {/* Catch-all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
