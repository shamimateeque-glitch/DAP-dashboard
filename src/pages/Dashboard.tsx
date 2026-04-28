import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Hand, Upload, CheckCircle2, XCircle, Search, Gavel, Trash2,
  DollarSign, FileText, Clock, TrendingUp, AlertTriangle, Users,
  BarChart2, Loader2, GripVertical, CalendarDays,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { displayClientName } from "@/lib/clientUtils";
import { loadPreference, savePreference, loadPreferenceSync } from "@/lib/userPreferences";
import {
  Select, SelectContent, SelectItem,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  // Pipeline
  totalCasesCount: number;
  inHand: number;
  uploaded: number;
  approved: number;
  rejected: number;
  inDepth: number;
  enforcement: number;
  destruction: number;
  closed: number;
  totalActive: number;

  // Workflow health
  inDepthInProgress: number;
  inDepthDone: number;
  inDepthOverdue: number;
  enforcementInProgress: number;
  enforcementDone: number;
  enforcementOverdue: number;
  destructionInProgress: number;
  destructionDone: number;
  destructionOverdue: number;

  // Financial
  totalFeeUploaded: number;
  totalFeeApproved: number;
  totalDestruction: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  overdueAmount: number;

  // Upcoming deadlines (next 7 days)
  upcomingInDepth: number;
  upcomingEnforcement: number;
  upcomingDestruction: number;

  // Financial Values per Status
  valueInHand: number;
  valueUploaded: number;
  valueApproved: number;
  valueRejected: number;
  valueUploadedTotal: number;
  uploadedTotalCount: number;
  valueTotal: number;
  valueActive: number;
  valueClosed: number;

  // Client performance
  clientBreakdown: { client: string; cases: number; approved: number; revenue: number; rejected: number }[];

  // Cases by city
  byCity: { city: string; cases: number }[];

  // Status distribution
  statusDist: { name: string; value: number; color: string }[];

  // Monthly trend (last 6 months)
  monthlyTrend: { month: string; cases: number; closed: number }[];

  // Invoice aging
  invoiceAging: { range: string; count: number; amount: number }[];

  // Final Reports
  finalReportsSubmitted: number;
  finalReportsPending: number;

  // Attention required
  attentionItems: { label: string; count: number; severity: "high" | "medium" | "low" }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  IN_HAND: "hsl(215, 16%, 47%)",
  UPLOADED: "hsl(217, 91%, 60%)",
  APPROVED: "hsl(142, 71%, 45%)",
  REJECTED: "hsl(0, 84%, 60%)",
  IN_DEPTH: "hsl(38, 92%, 50%)",
  ENFORCEMENT: "hsl(263, 70%, 55%)",
  DESTRUCTION: "hsl(330, 80%, 55%)",
  CLOSED: "hsl(215, 20%, 35%)",
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(222, 47%, 9%)",
    border: "1px solid hsl(217, 33%, 20%)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(210, 40%, 96%)",
  },
  itemStyle: { color: "hsl(210, 40%, 96%)" },
  labelStyle: { color: "hsl(215, 20%, 55%)" },
};

function usd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

// ─── Date-range view helpers ─────────────────────────────────────────────────

function getDateRange(
  viewMode: string,
  customFrom?: string,
  customTo?: string
): { from: string | null; to: string | null } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-based

  switch (viewMode) {
    case "current-month-view": {
      // First day of current month → today
      const monthStr = String(month + 1).padStart(2, "0");
      return {
        from: `${year}-${monthStr}-01`,
        to: today.toISOString().split("T")[0],
      };
    }
    case "current-year-view":
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`,
      };
    case "quarterly": {
      const qStart = new Date(year, Math.floor(month / 3) * 3, 1);
      const qEnd = new Date(year, Math.floor(month / 3) * 3 + 3, 0);
      return {
        from: qStart.toISOString().split("T")[0],
        to: qEnd.toISOString().split("T")[0],
      };
    }
    case "semi-annual": {
      const half = month < 6 ? 0 : 6;
      const sStart = new Date(year, half, 1);
      const sEnd = new Date(year, half + 6, 0);
      return {
        from: sStart.toISOString().split("T")[0],
        to: sEnd.toISOString().split("T")[0],
      };
    }
    case "all":
      return { from: null, to: null };
    case "custom":
      return { from: customFrom || null, to: customTo || null };
    default: {
      // Individual month format: "2026-02"
      if (/^\d{4}-\d{2}$/.test(viewMode)) {
        const [y, m] = viewMode.split("-").map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        return {
          from: start.toISOString().split("T")[0],
          to: end.toISOString().split("T")[0],
        };
      }
      return { from: null, to: null };
    }
  }
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDashboardData(
  dateFrom?: string | null,
  dateTo?: string | null
): Promise<DashboardData> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Fetch all cases
  const { data: cases } = await supabase.from("cases").select("id, case_status, province, city, created_at, case_reported_date, brand_name");

  // Fetch case_uploads (client, fee, decision)
  const { data: uploads } = await supabase.from("case_uploads").select("case_id, client, our_fee_usd, decision_status");

  // Fetch workflow stages
  const { data: inDepthRows } = await supabase.from("in_depth_stages").select("case_id, status, due_date");
  const { data: enforcementRows } = await supabase.from("enforcement_stages").select("case_id, status, due_date");
  const { data: destructionRows } = await supabase.from("destruction_stages").select("case_id, status, due_date");

  // Fetch invoices
  const { data: invoices } = await supabase.from("invoices").select("case_id, status, issue_date, due_date");

  // Fetch final reports
  const { data: finalReportRows } = await supabase.from("final_reports").select("case_id, status");

  // Fetch case_uploads fee joined to cases for revenue per client
  const { data: caseUploadsWithClient } = await supabase
    .from("case_uploads")
    .select("client, our_fee_usd, decision_status, case_id");

  let allCases = cases || [];
  let allUploads = uploads || [];
  let allInvoices = invoices || [];
  let allInDepth = inDepthRows || [];
  let allEnforcement = enforcementRows || [];
  let allDestruction = destructionRows || [];
  let allFinalReports = finalReportRows || [];
  let allClientUploads = caseUploadsWithClient || [];

  // ── Apply date-range filter ────────────────────────────────────────────────
  if (dateFrom || dateTo) {
    allCases = allCases.filter(c => {
      const d = (c.case_reported_date || c.created_at)?.split("T")[0];
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
    const filteredIds = new Set(allCases.map(c => c.id));
    allUploads = allUploads.filter(u => filteredIds.has(u.case_id));
    allInvoices = allInvoices.filter(i => filteredIds.has(i.case_id));
    allInDepth = allInDepth.filter(r => filteredIds.has(r.case_id));
    allEnforcement = allEnforcement.filter(r => filteredIds.has(r.case_id));
    allDestruction = allDestruction.filter(r => filteredIds.has(r.case_id));
    allFinalReports = allFinalReports.filter(r => filteredIds.has(r.case_id));
    allClientUploads = allClientUploads.filter(u => filteredIds.has(u.case_id));
  }

  // ── Pipeline counts ──────────────────────────────────────────────────────
  const totalCasesCount = allCases.length; // Every row in the Cases table
  const countIn = (statusList: string[]) => {
    const statusSet = new Set(statusList);
    return allCases.filter((c) => statusSet.has(c.case_status)).length;
  };

  const inHand = countIn(["IN_HAND"]);

  // Awaiting Decision: Cases with 'UPLOADED' status strictly awaiting a decision
  const decidedCaseIds = new Set(
    allUploads
      .filter((u) => u.decision_status === "APPROVED" || u.decision_status === "REJECTED")
      .map((u) => u.case_id)
  );
  const uploaded = allCases.filter((c) => c.case_status === "UPLOADED" && !decidedCaseIds.has(c.id)).length;

  const rejected = countIn(["REJECTED"]);

  // Cumulative Counts: Each stage includes all subsequent stages
  const inDepthCnt = countIn(["IN_DEPTH", "ENFORCEMENT", "DESTRUCTION", "CLOSED"]);
  const enforcement = countIn(["ENFORCEMENT", "DESTRUCTION", "CLOSED"]);
  const destruction = countIn(["DESTRUCTION", "CLOSED"]);
  const closed = countIn(["CLOSED"]);

  // totalActive defined later

  // ── Workflow health ──────────────────────────────────────────────────────
  const wfCount = (rows: any[], status: string) => rows.filter((r) => r.status === status).length;
  const wfOverdue = (rows: any[], dateKey: string) =>
    rows.filter((r) => r.status === "IN_PROGRESS" && r[dateKey] && r[dateKey] < todayStr).length;

  const inDepthInProgress = wfCount(allInDepth, "IN_PROGRESS");
  const inDepthDone = wfCount(allInDepth, "DONE");
  const inDepthOverdue = wfOverdue(allInDepth, "due_date");
  const enforcementInProgress = wfCount(allEnforcement, "IN_PROGRESS");
  const enforcementDone = wfCount(allEnforcement, "DONE");
  const enforcementOverdue = wfOverdue(allEnforcement, "due_date");
  const destructionInProgress = wfCount(allDestruction, "IN_PROGRESS");
  const destructionDone = wfCount(allDestruction, "DONE");
  const destructionOverdue = wfOverdue(allDestruction, "due_date");

  // ── Final Reports ──────────────────────────────────────────────────────
  const finalReportsSubmitted = allFinalReports.filter((r) => r.status === "DONE").length;
  const finalReportsPending = allFinalReports.filter((r) => r.status !== "DONE").length;

  // ── Financial ────────────────────────────────────────────────────────────
  const totalFeeUploaded = allUploads.reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  const approvedCaseIds = new Set(allCases.filter((c) => c.case_status !== "IN_HAND" && c.case_status !== "UPLOADED" && c.case_status !== "REJECTED").map((c) => c.id));
  const totalFeeApproved = allUploads
    .filter((u) => u.decision_status === "APPROVED")
    .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  const destructionCaseIds = new Set(allCases.filter((c) => c.case_status === "DESTRUCTION" || c.case_status === "CLOSED").map((c) => c.id));
  const totalDestruction = allUploads
    .filter((u) => destructionCaseIds.has(u.case_id))
    .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  const paidInvoiceIds = new Set(allInvoices.filter((i) => i.status === "PAID").map((i) => i.case_id));
  const totalPaid = allUploads
    .filter((u) => paidInvoiceIds.has(u.case_id))
    .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  const totalOutstanding = totalDestruction - totalPaid;

  const overdueInvoices = allInvoices.filter((i) => i.status !== "PAID" && i.due_date && i.due_date < todayStr);
  const overdueCount = overdueInvoices.length;
  const overdueInvoiceCaseIds = new Set(overdueInvoices.map((i) => i.case_id));
  const overdueAmount = allUploads
    .filter((u) => overdueInvoiceCaseIds.has(u.case_id))
    .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);

  // ── Financial Values per Status ──────────────────────────────────────────
  const BASE_VALUE = 1500;

  // In-Hand: Count * Base Value
  const valueInHand = inHand * BASE_VALUE;

  // Helper to calc sum of fees for given statuses
  const calcFeeSum = (statusList: string[]) => {
    const statusSet = new Set(statusList);
    const caseStatusMap = new Map(allCases.map(c => [c.id, c.case_status]));
    return allUploads
      .filter(u => statusSet.has(caseStatusMap.get(u.case_id) || ""))
      .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  };

  // Rejected: Part of Uploaded Cases, uses "Our Fee"
  const valueRejected = calcFeeSum(["REJECTED"]);

  // Uploaded Amount = Sum of fees for ALL cases that have been uploaded
  const allUploadedStatuses = ["UPLOADED", "APPROVED", "REJECTED", "IN_DEPTH", "ENFORCEMENT", "DESTRUCTION", "CLOSED"];
  const valueUploadedTotal = calcFeeSum(allUploadedStatuses);
  const uploadedTotalCount = allCases.filter((c) => allUploadedStatuses.includes(c.case_status)).length;

  // Awaiting Decision Value = Fees for UPLOADED cases without a final decision
  const valueUploaded = allUploads
    .filter((u) =>
      !decidedCaseIds.has(u.case_id) &&
      allCases.find((c) => c.id === u.case_id)?.case_status === "UPLOADED"
    )
    .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
  // Approved = Strictly approved + actively in workflow stages. 
  // It is the REMAINING bucket after excluding Rejected.
  const APPROVED_STATUSES = ["APPROVED", "IN_DEPTH", "ENFORCEMENT", "DESTRUCTION", "CLOSED"];
  const approved = allCases.filter((c) => APPROVED_STATUSES.includes(c.case_status)).length;
  const valueApproved = calcFeeSum(APPROVED_STATUSES);

  const valueClosed = calcFeeSum(["CLOSED"]);

  // Active = Cases currently in active workflow stages (In-Depth, Enforcement, Final Report, Invoiced)
  // Excluding 'UPLOADED' (Awaiting) and 'APPROVED' (Just approved, not yet in specific workflow?) 
  // User request: "active cases should calculated according to the approved cases" -> implies Active is a subset of Approved?
  // Or "Active" means "Approved and NOT Closed"?
  // If Approved = [APPROVED, IN_DEPTH, ENFORCEMENT, DESTRUCTION, CLOSED]
  // Then Active should probably be Approved - Closed.
  // Let's define Active as strictly WIP.
  const ACTIVE_STATUSES = ["APPROVED", "IN_DEPTH", "ENFORCEMENT", "DESTRUCTION"];
  const totalActive = allCases.filter((c) => ACTIVE_STATUSES.includes(c.case_status)).length;
  const valueActive = calcFeeSum(ACTIVE_STATUSES);

  // Total Value = In-Hand Value + Uploaded Amount
  const valueTotal = valueInHand + valueUploadedTotal;

  // ── Upcoming deadlines (next 7 days) ─────────────────────────────────────
  const in7Days = new Date(today);
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toISOString().split("T")[0];
  const isUpcoming = (dateStr: string) => dateStr >= todayStr && dateStr <= in7DaysStr;
  const upcomingInDepth = allInDepth.filter((r) => r.status === "IN_PROGRESS" && r.due_date && isUpcoming(r.due_date)).length;
  const upcomingEnforcement = allEnforcement.filter((r) => r.status === "IN_PROGRESS" && r.due_date && isUpcoming(r.due_date)).length;
  const upcomingDestruction = allDestruction.filter((r) => r.status === "IN_PROGRESS" && r.due_date && isUpcoming(r.due_date)).length;

  // ── Client breakdown ─────────────────────────────────────────────────────
  const clients = ["ONEWORLD", "A.A ASSOCIATES", "SAFEMARK"];
  const clientBreakdown = clients.map((key) => {
    const clientUploads = allClientUploads.filter((u) => u.client === key);
    return {
      client: displayClientName(key),
      cases: clientUploads.length,
      approved: clientUploads.filter((u) => u.decision_status === "APPROVED").length,
      rejected: clientUploads.filter((u) => u.decision_status === "REJECTED").length,
      revenue: clientUploads.reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0),
    };
  });

  // ── By city ──────────────────────────────────────────────────────────
  const cityMap: Record<string, number> = {};
  allCases.forEach((c) => {
    if (c.city) cityMap[c.city] = (cityMap[c.city] || 0) + 1;
  });
  const byCity = Object.entries(cityMap)
    .map(([city, cases]) => ({ city, cases }))
    .sort((a, b) => b.cases - a.cases)
    .slice(0, 8);

  // ── Status distribution ──────────────────────────────────────────────────
  const statusDist = [
    { name: "In Hand", value: inHand, color: STATUS_COLORS.IN_HAND },
    { name: "Uploaded", value: uploaded, color: STATUS_COLORS.UPLOADED },
    { name: "Approved", value: approved, color: STATUS_COLORS.APPROVED },
    { name: "Rejected", value: rejected, color: STATUS_COLORS.REJECTED },
    { name: "In-Depth", value: inDepthCnt, color: STATUS_COLORS.IN_DEPTH },
    { name: "Enforcement", value: enforcement, color: STATUS_COLORS.ENFORCEMENT },
    { name: "Destruction", value: destruction, color: STATUS_COLORS.DESTRUCTION },
    { name: "Closed", value: closed, color: STATUS_COLORS.CLOSED },
  ].filter((s) => s.value > 0);

  // ── Monthly trend (last 6 months) ────────────────────────────────────────
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleString("default", { month: "short" });
    const monthCases = allCases.filter((c) => {
      const cd = new Date(c.created_at);
      return cd.getFullYear() === year && cd.getMonth() === month;
    });
    return {
      month: label,
      cases: monthCases.length,
      closed: monthCases.filter((c) => c.case_status === "CLOSED").length,
    };
  });

  // ── Invoice aging ────────────────────────────────────────────────────────
  const aging = [
    { range: "Current", min: -Infinity, max: 0 },
    { range: "1–30 days", min: 0, max: 30 },
    { range: "31–60 days", min: 30, max: 60 },
    { range: "61–90 days", min: 60, max: 90 },
    { range: "90+ days", min: 90, max: Infinity },
  ];
  const invoiceAging = aging.map(({ range, min, max }) => {
    const matched = allInvoices.filter((inv) => {
      if (inv.status === "PAID") return false;
      const days = inv.due_date
        ? Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000)
        : 0;
      return days > min && days <= max;
    });
    const matchedCaseIds = new Set(matched.map((i) => i.case_id));
    const amount = allUploads
      .filter((u) => matchedCaseIds.has(u.case_id))
      .reduce((sum, u) => sum + (Number(u.our_fee_usd) || 0), 0);
    return { range, count: matched.length, amount };
  });

  // ── Attention required ───────────────────────────────────────────────────
  const attentionItems = [
    { label: "Overdue In-Depth stages", count: inDepthOverdue, severity: "high" as const },
    { label: "Overdue Enforcement stages", count: enforcementOverdue, severity: "high" as const },
    { label: "Overdue Destruction stages", count: destructionOverdue, severity: "medium" as const },
    { label: "Unpaid overdue invoices", count: overdueCount, severity: "high" as const },
    { label: "Rejected cases", count: rejected, severity: "medium" as const },
  ].filter((a) => a.count > 0);

  return {
    totalCasesCount,
    inHand, uploaded, approved, rejected,
    inDepth: inDepthCnt, enforcement, destruction, closed, totalActive,
    inDepthInProgress, inDepthDone, inDepthOverdue,
    enforcementInProgress, enforcementDone, enforcementOverdue,
    destructionInProgress, destructionDone, destructionOverdue,
    totalFeeUploaded, totalFeeApproved, totalDestruction, totalPaid, totalOutstanding, overdueCount, overdueAmount,
    upcomingInDepth, upcomingEnforcement, upcomingDestruction,
    clientBreakdown, byCity, statusDist, monthlyTrend, invoiceAging, attentionItems,
    valueInHand, valueUploaded, valueApproved, valueRejected, valueUploadedTotal, uploadedTotalCount, valueTotal, valueActive, valueClosed,
    finalReportsSubmitted, finalReportsPending,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PipelineGradientCard({
  title, value, subtitle, gradient, href
}: {
  title: string; value: number | string; subtitle?: string; gradient: string; href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  // Theme-adaptive styles
  const edgeBg = isDark
    ? "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)"
    : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.08) 100%)";
  const borderColor = isDark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.18)";
  const shadowDefault = isDark
    ? "0 8px 28px -6px rgba(0,0,0,0.35), 0 4px 10px -4px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.15)"
    : "0 8px 28px -6px rgba(0,0,0,0.12), 0 4px 10px -4px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.2)";
  const shadowHover = isDark
    ? "0 16px 40px -8px rgba(0,0,0,0.45), 0 6px 16px -4px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.2)"
    : "0 16px 40px -8px rgba(0,0,0,0.18), 0 6px 16px -4px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.25)";

  return (
    <motion.div
      variants={item}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onClick={() => href && navigate(href)}
      style={{ position: "relative" as const, cursor: href ? "pointer" : undefined }}
    >
      {/* 3D bottom edge — adapts to theme */}
      <div
        style={{
          position: "absolute",
          left: "4px",
          right: "4px",
          bottom: "-6px",
          height: "14px",
          background: edgeBg,
          borderRadius: "0 0 20px 20px",
          zIndex: 0,
        }}
      />

      {/* Main card */}
      <div
        style={{
          position: "relative" as const,
          zIndex: 1,
          transition: "transform 0.4s ease, box-shadow 0.4s ease",
          transform: hovered ? "translateY(-4px)" : "translateY(0px)",
          borderRadius: "22px",
          background: gradient,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${borderColor}`,
          boxShadow: hovered ? shadowHover : shadowDefault,
          padding: "32px 24px",
          overflow: "hidden",
          minHeight: "160px",
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center" as const,
        }}
      >
        {/* Glossy light reflection — soft top-left glow */}
        <div
          style={{
            position: "absolute",
            top: "-30%",
            left: "-20%",
            width: "80%",
            height: "80%",
            background: isDark
              ? "radial-gradient(ellipse at center, rgba(255,255,255,0.12) 0%, transparent 70%)"
              : "radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Subtle inner glow along top edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: isDark
              ? "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 100%)",
            borderRadius: "22px 22px 0 0",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Pattern Circle (New) */}
        <div className="absolute top-0 right-0 p-3 opacity-[0.1]" style={{ zIndex: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" fill="white">
            <circle cx="50" cy="50" r="40" />
          </svg>
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <p className="text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,0.9)" }}>{title}</p>
          <p className="text-5xl font-extrabold tracking-tight" style={{ color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>{value}</p>
          {subtitle && (
            <p className="text-sm font-semibold mt-1 px-4 py-1"
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                borderRadius: "20px",
                color: "white",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function WorkflowCard({
  title, inProgress, done, overdue, showPattern = false, showGavel = false, showDestruction = false, href,
}: {
  title: string;
  inProgress: number; done: number; overdue: number; showPattern?: boolean; showGavel?: boolean; showDestruction?: boolean; href?: string;
}) {
  const navigate = useNavigate();
  const fingerprintSvg = (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.22, pointerEvents: "none" }}>
      {/* Core center loop */}
      <path d="M50,52 C47,49 44,47 44,44 C44,40 47,38 50,38 C53,38 56,40 56,44 C56,47 53,49 50,52 Z" fill="none" stroke="white" strokeWidth="0.9" />
      {/* Ridge lines flowing outward like a real fingerprint */}
      <path d="M50,55 C45,51 40,47 39,42 C38,36 43,32 50,32 C57,32 62,36 61,42 C60,47 55,51 50,55 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,59 C43,54 36,49 34,42 C32,33 39,27 50,27 C61,27 68,33 66,42 C64,49 57,54 50,59 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,64 C41,58 32,51 29,42 C26,30 35,22 50,22 C65,22 74,30 71,42 C68,51 59,58 50,64 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,69 C39,62 28,53 24,42 C20,27 31,17 50,17 C69,17 80,27 76,42 C72,53 61,62 50,69 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,74 C37,66 24,55 19,42 C14,24 27,12 50,12 C73,12 86,24 81,42 C76,55 63,66 50,74 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,80 C35,71 20,58 14,42 C8,21 23,7 50,7 C77,7 92,21 86,42 C80,58 65,71 50,80 Z" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M50,87 C33,76 16,61 9,42 C2,17 19,2 50,2 C81,2 98,17 91,42 C84,61 67,76 50,87 Z" fill="none" stroke="white" strokeWidth="0.9" />
      {/* Bottom arch lines */}
      <path d="M28,80 C35,90 43,95 50,96 C57,95 65,90 72,80" fill="none" stroke="white" strokeWidth="0.9" />
      <path d="M18,74 C27,88 38,97 50,99 C62,97 73,88 82,74" fill="none" stroke="white" strokeWidth="0.9" />
    </svg>
  );
  const destructionSvg = (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.18, pointerEvents: "none" }}>
      {/* Crumpled paper — jagged broken lines across the card like a scrunched document */}
      {/* Top crumple fold lines */}
      <polyline points="5,12 14,8 22,14 31,7 40,13 50,6 60,11 70,5 80,10 90,6 98,12" fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,22 12,18 20,24 28,17 38,22 47,16 57,21 66,15 76,20 85,14 98,20" fill="none" stroke="white" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
      {/* Middle crumple — more chaotic folds */}
      <polyline points="5,33 10,29 18,36 25,28 33,35 42,27 50,34 59,26 67,33 75,25 83,31 92,24 98,30" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,44 13,40 21,47 30,39 39,46 48,38 56,45 65,37 73,43 82,36 90,42 98,38" fill="none" stroke="white" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
      {/* Center deep crumple crease */}
      <polyline points="5,55 11,51 19,58 27,50 36,57 44,49 53,56 62,48 70,55 79,47 88,53 98,48" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Lower crumple folds */}
      <polyline points="5,66 13,62 22,69 31,61 40,67 49,60 58,66 67,59 76,65 85,58 98,63" fill="none" stroke="white" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,77 14,73 23,80 32,72 41,78 51,71 60,77 69,70 78,76 87,69 98,74" fill="none" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      {/* Bottom torn edge */}
      <polyline points="5,88 12,84 20,91 29,83 38,89 47,82 56,88 65,81 74,87 83,80 92,86 98,82" fill="none" stroke="white" strokeWidth="1.0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const gavelSvg = (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.15, pointerEvents: "none" }}>
      {/* Gavel head — angled block */}
      <rect x="20" y="18" width="36" height="16" rx="3" fill="white" transform="rotate(-40 38 26)" />
      {/* Gavel head band stripe */}
      <rect x="20" y="24" width="36" height="4" rx="1" fill="rgba(0,0,0,0.18)" transform="rotate(-40 38 26)" />
      {/* Gavel handle — long diagonal rod */}
      <line x1="48" y1="42" x2="82" y2="78" stroke="white" strokeWidth="6" strokeLinecap="round" />
      {/* Handle grip ring */}
      <line x1="70" y1="66" x2="76" y2="73" stroke="rgba(0,0,0,0.2)" strokeWidth="5" strokeLinecap="round" />
      {/* Sound block — flat rectangle at bottom */}
      <rect x="10" y="80" width="50" height="10" rx="3" fill="white" />
      {/* Sound block band */}
      <rect x="10" y="84" width="50" height="3" rx="1" fill="rgba(0,0,0,0.15)" />
    </svg>
  );
  return (
    <motion.div variants={item} className="glass-card rounded-xl p-5 flex flex-col gap-4 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" style={{ backgroundColor: '#333333' }} onClick={() => href && navigate(href)}>
      <span className="font-semibold text-foreground text-base">{title}</span>
      <div className="grid grid-cols-3 gap-3">
        {/* Overdue */}
        <div className="rounded-xl p-3 text-center overflow-hidden" style={{ background: "linear-gradient(135deg, #d12526 0%, #e84545 50%, #ffcdd2 90%, #fff5f5 100%)", position: "relative" }}>
          {showPattern && fingerprintSvg}
          {showGavel && gavelSvg}
          {showDestruction && destructionSvg}
          <p className="text-2xl font-bold" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>{overdue}</p>
          <p className="text-xs mt-1" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>Overdue</p>
        </div>
        {/* In-Progress */}
        <div className="rounded-xl p-3 text-center overflow-hidden" style={{ background: "linear-gradient(135deg, #ea640f 0%, #f28444 50%, #ffd4b0 90%, #fff5ee 100%)", position: "relative" }}>
          {showPattern && fingerprintSvg}
          {showGavel && gavelSvg}
          {showDestruction && destructionSvg}
          <p className="text-2xl font-bold" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>{inProgress}</p>
          <p className="text-xs mt-1" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>In-Progress</p>
        </div>
        {/* Done */}
        <div className="rounded-xl p-3 text-center overflow-hidden" style={{ background: "linear-gradient(135deg, #18a84a 0%, #34c76f 50%, #a8f0c6 90%, #f0fff6 100%)", position: "relative" }}>
          {showPattern && fingerprintSvg}
          {showGavel && gavelSvg}
          {showDestruction && destructionSvg}
          <p className="text-2xl font-bold" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>{done}</p>
          <p className="text-xs mt-1" style={{ color: "#ffffff", position: "relative", zIndex: 1 }}>Done</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Sortable Section Wrapper ─────────────────────────────────────────────────

const SECTION_ORDER_KEY = "dashboard-section-order";
const DEFAULT_ORDER = ["pipeline", "workflow", "financial", "reports", "clients-province", "aging-attention"];

const CARD_ORDER_KEY = "dashboard-card-order";
const ALL_CARDS = [
  { id: "totalCases", title: "Total Cases", color: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)", href: "/all-cases" },
  { id: "awaitingDecision", title: "Awaiting Decision", color: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)", href: "/awaiting-decision" },
  { id: "uploaded", title: "Cases Uploaded", color: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)", href: "/uploaded" },
  { id: "rejected", title: "Rejected Cases", color: "linear-gradient(135deg, #f87171 0%, #dc2626 100%)", href: "/rejected" },
  { id: "totalActive", title: "Active Cases", color: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)", href: "/approved" },
  { id: "closed", title: "Closed Cases", color: "linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)", href: "/closed" },
  { id: "approved", title: "Approved Cases", color: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)", href: "/approved" },
] as const;

const SORTABLE_CARD_IDS = ["approved", "rejected", "awaitingDecision", "totalActive", "closed"];

type CardId = typeof ALL_CARDS[number]["id"];

function SortableCard({ id, title, color, value, amount, href }: {
  id: string; title: string; color: string; value: number; amount?: number; href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const hasDragged = useRef(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const hoverBorder = isDark
    ? "1.5px solid rgba(255, 255, 255, 0.35)"
    : "1.5px solid rgba(255, 255, 255, 0.5)";
  const hoverShadow = isDark
    ? "0 0 14px 3px rgba(255,255,255,0.12), 0 0 5px 1px rgba(255,255,255,0.08)"
    : "0 0 12px 2px rgba(255,255,255,0.2), 0 0 4px 1px rgba(255,255,255,0.15)";
  const baseShadow = isDark
    ? "0 4px 14px -4px rgba(0,0,0,0.3)"
    : "none";

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onPointerDown={() => { hasDragged.current = false; }}
      onPointerMove={() => { hasDragged.current = true; }}
      onPointerUp={() => {
        if (!hasDragged.current && href && !isDragging) navigate(href);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        border: "1px solid transparent",
        backgroundImage: isDark
          ? `linear-gradient(rgba(10, 15, 30, 0.95), rgba(10, 15, 30, 0.95)), ${color}`
          : "none",
        backgroundColor: isDark ? "transparent" : "white",
        borderColor: isDark ? "transparent" : color.includes("gradient") ? color.match(/#[0-9a-fA-F]{6}/)?.[0] : color,
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
        transform: CSS.Transform.toString(transform),
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
        borderRadius: "16px",
        // Premium offset glow effect
        boxShadow: hovered && !isDragging
          ? (isDark
            ? `0 12px 30px -10px ${color.includes("gradient") ? (color.match(/#[0-9a-fA-F]{6}/)?.[0] || "#ffffff") : color}80, 0 0 10px ${color.includes("gradient") ? (color.match(/#[0-9a-fA-F]{6}/)?.[0] || "#ffffff") : color}30`
            : `0 15px 25px -10px rgba(0, 0, 0, 0.15), 0 5px 10px -5px ${color.includes("gradient") ? (color.match(/#[0-9a-fA-F]{6}/)?.[0] || "#000") : color}40`)
          : (isDark ? "0 4px 20px -10px rgba(0,0,0,0.5)" : "0 4px 6px -1px rgba(0, 0, 0, 0.05)"),
      }}
      className="relative cursor-pointer active:cursor-grabbing select-none flex flex-col group overflow-hidden"
    >
      <div
        className="flex flex-col items-center justify-center text-center h-full w-full p-6 transition-colors duration-300"
      >
        <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 h-full w-full">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] transition-colors"
            style={{ color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)" }}
          >
            {title}
          </p>
          <p className="text-4xl font-black tracking-tight transition-all duration-300"
            style={{
              color: isDark ? "white" : "rgba(10, 15, 30, 0.9)",
              textShadow: isDark ? "0 2px 10px rgba(0,0,0,0.3)" : "none",
              transform: hovered ? "scale(1.05)" : "scale(1)"
            }}
          >
            {value}
          </p>
          {amount !== undefined && (
            <p className="text-[11px] font-bold mt-2 px-3 py-0.5 rounded-full transition-all"
              style={{
                color: isDark ? "white" : "rgba(0,0,0,0.7)",
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
                opacity: hovered ? 1 : 0.8
              }}
            >
              {usd(amount)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:text-foreground"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Date-range view filter
  const [viewMode, setViewMode] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Section & card order: load from localStorage instantly, then sync from Supabase
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    const saved = loadPreferenceSync<string[]>(SECTION_ORDER_KEY, DEFAULT_ORDER);
    if (saved && DEFAULT_ORDER.every((id) => saved.includes(id))) return saved;
    return DEFAULT_ORDER;
  });

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const saved = loadPreferenceSync<string[]>(CARD_ORDER_KEY, SORTABLE_CARD_IDS);
    if (saved && saved.length === SORTABLE_CARD_IDS.length && saved.every(id => SORTABLE_CARD_IDS.includes(id))) return saved;
    return SORTABLE_CARD_IDS;
  });

  // On mount: load persisted order from Supabase (per-user, survives logout)
  useEffect(() => {
    if (!appUser?.id) return;
    let cancelled = false;

    const syncFromSupabase = async () => {
      const [savedSections, savedCards] = await Promise.all([
        loadPreference<string[]>(appUser.id, SECTION_ORDER_KEY, DEFAULT_ORDER),
        loadPreference<string[]>(appUser.id, CARD_ORDER_KEY, SORTABLE_CARD_IDS),
      ]);

      if (cancelled) return;

      if (savedSections && DEFAULT_ORDER.every((id) => savedSections.includes(id))) {
        setSectionOrder(savedSections);
      }
      if (savedCards && savedCards.length === SORTABLE_CARD_IDS.length && savedCards.every(id => SORTABLE_CARD_IDS.includes(id))) {
        setCardOrder(savedCards);
      }
    };

    syncFromSupabase();
    return () => { cancelled = true; };
  }, [appUser?.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleCardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setCardOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(activeId), prev.indexOf(overId));
      // Save to Supabase (persistent) + localStorage (fast cache)
      if (appUser?.id) {
        savePreference(appUser.id, CARD_ORDER_KEY, next);
      }
      return next;
    });
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setSectionOrder((prev) => {
      const next = arrayMove(prev, prev.indexOf(activeId), prev.indexOf(overId));
      // Save to Supabase (persistent) + localStorage (fast cache)
      if (appUser?.id) {
        savePreference(appUser.id, SECTION_ORDER_KEY, next);
      }
      return next;
    });
  };

  // For custom mode, only fetch when the user clicks Apply (via appliedCustom)
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });

  useEffect(() => {
    // Skip fetch for custom mode — it waits for the Apply button
    if (viewMode === "custom") {
      const { from, to } = getDateRange(viewMode, appliedCustom.from, appliedCustom.to);
      if (!from && !to) return;          // nothing applied yet
      setLoading(true);
      fetchDashboardData(from, to)
        .then(setData)
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    const { from, to } = getDateRange(viewMode);
    fetchDashboardData(from, to)
      .then(setData)
      .finally(() => setLoading(false));
  }, [viewMode, appliedCustom]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const firstName = appUser?.full_name?.split(" ")[0] || "there";

  // ── Section render map ───────────────────────────────────────────────────
  const cardValueMap: Record<CardId, number> = {
    totalCases: data.totalCasesCount,            // Every row in the Cases table
    awaitingDecision: data.uploaded,              // UPLOADED status = awaiting decision
    uploaded: data.uploadedTotalCount,            // All cases that have been uploaded
    approved: data.approved,                      // APPROVED + IN_DEPTH + ENFORCEMENT + DESTRUCTION + CLOSED
    rejected: data.rejected,                      // REJECTED status
    totalActive: data.totalActive,                // Approved and NOT closed
    closed: data.closed,                          // CLOSED status
  };

  const cardAmountMap: Record<CardId, number> = {
    totalCases: data.valueTotal,                  // InHand × $1500 + SUM(Our_Fee) all uploaded
    awaitingDecision: data.valueUploaded,          // SUM(Our_Fee) of UPLOADED status cases
    uploaded: data.valueUploadedTotal,             // SUM(Our_Fee) of all uploaded cases
    approved: data.valueApproved,                  // SUM(Our_Fee) where approved
    rejected: data.valueRejected,                  // SUM(Our_Fee) where rejected (pipeline value lost)
    totalActive: data.valueActive,                 // SUM(Our_Fee) where approved & not closed
    closed: data.valueClosed,                      // SUM(Our_Fee) where closed (earned revenue)
  };

  const sections: Record<string, React.ReactNode> = {
    pipeline: (
      <motion.div variants={item} key="pipeline" className="space-y-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <BarChart2 className="w-4 h-4" /> Case Pipeline Summary
        </h3>

        {/* Top Row: 3 Gradient Cards — equal width & height */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", alignItems: "stretch" }}>
          <PipelineGradientCard
            title="Total Cases"
            value={data.totalCasesCount}
            subtitle={usd(data.valueTotal)}
            gradient="linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)"
            href="/all-cases"
          />
          <PipelineGradientCard
            title="Uploaded Cases"
            value={data.uploadedTotalCount}
            subtitle={usd(data.valueUploadedTotal)}
            gradient="linear-gradient(135deg, #34d399 0%, #059669 100%)"
            href="/uploaded"
          />
          <PipelineGradientCard
            title="In-Hand Cases"
            value={data.inHand}
            subtitle={usd(data.valueInHand)}
            gradient="linear-gradient(135deg, #fde047 0%, #eab308 100%)"
            href="/in-hand"
          />
        </div>

        {/* Bottom Row: 5 Sortable Cards */}
        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-xs text-muted-foreground opacity-60">(drag cards to reorder)</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
            <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {cardOrder.map((cardId) => {
                  const card = ALL_CARDS.find((c) => c.id === cardId)!;
                  return (
                    <SortableCard
                      key={card.id}
                      id={card.id}
                      title={card.title}
                      color={card.color}
                      value={cardValueMap[cardId as CardId]}
                      amount={cardAmountMap[cardId as CardId]}
                      href={card.href}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </motion.div>
    ),
    workflow: (
      <motion.div variants={item} key="workflow">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Workflow Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WorkflowCard title="In-Depth" inProgress={data.inDepthInProgress} done={data.inDepthDone} overdue={data.inDepthOverdue} showPattern={true} href="/in-depth" />
          <WorkflowCard title="Enforcement" inProgress={data.enforcementInProgress} done={data.enforcementDone} overdue={data.enforcementOverdue} showGavel={true} href="/enforcement" />
          <WorkflowCard title="Destruction" inProgress={data.destructionInProgress} done={data.destructionDone} overdue={data.destructionOverdue} showDestruction={true} href="/destruction" />
        </div>
      </motion.div>
    ),
    financial: (
      <motion.div variants={item} key="financial" className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Financial Overview
        </h3>

        {/* Row 1 — 4 individual cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass-card rounded-xl p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Total Fee — Approved</p>
            <p className="text-2xl font-bold text-foreground">{usd(data.totalFeeApproved)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all" style={{ backgroundColor: "rgba(59,130,246,0.10)" }} onClick={() => navigate("/all-invoices")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Total Invoiced</p>
            <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>{usd(data.totalDestruction)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-green-500/50 transition-all" style={{ backgroundColor: "rgba(34,197,94,0.10)" }} onClick={() => navigate("/invoices-paid")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Total Paid</p>
            <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{usd(data.totalPaid)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all" style={{ backgroundColor: "rgba(245,158,11,0.10)" }} onClick={() => navigate("/invoices-unpaid")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Outstanding</p>
            <p className="text-2xl font-bold" style={{ color: "#f59e0b" }}>{usd(data.totalOutstanding)}</p>
          </div>
        </div>

        {/* Row 2 — Overdue / Not Yet Due */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all" style={{ backgroundColor: "rgba(239,68,68,0.10)" }} onClick={() => navigate("/invoices-over-due")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Overdue Invoices</p>
            <p className="text-4xl font-bold" style={{ color: "#ef4444" }}>{data.overdueCount}</p>
            <p className="text-sm text-muted-foreground mt-2">{usd(data.overdueAmount)}</p>
          </div>
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all" style={{ backgroundColor: "rgba(59,130,246,0.10)" }} onClick={() => navigate("/invoices-unpaid")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Not Yet Due</p>
            <p className="text-4xl font-bold" style={{ color: "#3b82f6" }}>{Math.max(0, data.destruction)}</p>
            <p className="text-sm text-muted-foreground mt-2">{usd(Math.max(0, data.totalOutstanding - data.overdueAmount))}</p>
          </div>
        </div>

      </motion.div>
    ),
    reports: (
      <motion.div variants={item} key="reports" className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4" /> Report Analysis
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-green-500/50 transition-all" onClick={() => navigate("/pending-work/final-report")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Final Reports Submitted</p>
            <p className="text-4xl font-bold" style={{ color: "#22c55e" }}>{data.finalReportsSubmitted}</p>
          </div>
          <div className="glass-card rounded-xl p-5 cursor-pointer hover:ring-2 hover:ring-yellow-500/50 transition-all" onClick={() => navigate("/pending-work/final-report")}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Final Reports Pending</p>
            <p className="text-4xl font-bold" style={{ color: "#f59e0b" }}>{data.finalReportsPending}</p>
          </div>
        </div>
      </motion.div>
    ),
    "clients-province": (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" key="clients-province">
        <motion.div variants={item} className="glass-card rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Client Performance
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-2">Metric</th>
                {data.clientBreakdown.map((c) => <th key={c.client} className="text-center pb-2 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/client-reports?client=${encodeURIComponent(c.client.toUpperCase())}`)}>{c.client}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[
                { label: "Case Volume", values: data.clientBreakdown.map((c) => c.cases), format: (v: number) => v.toString(), color: () => "text-foreground" },
                { label: "Approved", values: data.clientBreakdown.map((c) => c.approved), format: (v: number) => v.toString(), color: () => "text-stat-green" },
                { label: "Rejected", values: data.clientBreakdown.map((c) => c.rejected), format: (v: number) => v.toString(), color: (v: number) => v > 0 ? "text-destructive" : "text-foreground" },
                { label: "Approval Rate", values: data.clientBreakdown.map((c) => c.cases > 0 ? Math.round((c.approved / c.cases) * 100) : 0), format: (v: number) => `${v}%`, color: (v: number) => v >= 70 ? "text-stat-green" : v >= 40 ? "text-stat-yellow" : "text-destructive" },
                { label: "Fee Total", values: data.clientBreakdown.map((c) => c.revenue), format: (v: number) => usd(v), color: () => "text-stat-blue" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-2.5 text-muted-foreground text-xs">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`py-2.5 text-center font-semibold text-xs ${row.color(v)}`}>{row.format(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-2">
            {data.clientBreakdown.map((c) => {
              const rate = c.cases > 0 ? Math.round((c.approved / c.cases) * 100) : 0;
              return (
                <div key={c.client}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{c.client}</span><span>{rate}%</span></div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
        <motion.div variants={item} className="glass-card rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Cases by City
          </h3>
          {data.byCity.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byCity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" horizontal={false} />
                <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} />
                <YAxis dataKey="city" type="category" stroke="hsl(215, 20%, 55%)" fontSize={11} tickLine={false} width={110} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="cases" radius={[0, 6, 6, 0]} fill="url(#barG)" activeBar={{ fill: "url(#barGHover)", stroke: "hsl(199, 89%, 48%)", strokeWidth: 1 }} />
                <defs>
                  <linearGradient id="barG" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(217, 91%, 55%)" />
                    <stop offset="100%" stopColor="hsl(199, 89%, 48%)" />
                  </linearGradient>
                  <linearGradient id="barGHover" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(217, 91%, 65%)" />
                    <stop offset="100%" stopColor="hsl(199, 89%, 58%)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No data yet</div>
          )}
        </motion.div>
      </div>
    ),
    "aging-attention": (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" key="aging-attention">
        <motion.div variants={item} className="glass-card rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-stat-yellow" /> Invoice Aging Breakdown
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left pb-2">Age</th>
                <th className="text-center pb-2">Count</th>
                <th className="text-right pb-2">Amount</th>
                <th className="text-right pb-2">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.invoiceAging.map((row) => {
                const totalAging = data.invoiceAging.reduce((s, r) => s + r.amount, 0);
                const pct = totalAging > 0 ? Math.round((row.amount / totalAging) * 100) : 0;
                const isOverdue = row.range !== "Current" && row.count > 0;
                const targetRoute = row.range === "Current" ? "/invoices-unpaid" : "/invoices-over-due";
                return (
                  <tr key={row.range} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 text-foreground">{row.range}</td>
                    <td className={`py-2.5 text-center font-semibold ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                      {row.count > 0 ? (
                        <span className="cursor-pointer hover:underline text-blue-600" onClick={() => navigate(targetRoute)}>{row.count}</span>
                      ) : row.count}
                    </td>
                    <td className={`py-2.5 text-right ${isOverdue ? "text-destructive font-medium" : "text-foreground"}`}>{usd(row.amount)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate("/invoices-over-due")}>
            <span className="text-muted-foreground">Total Overdue</span>
            <span className="text-destructive">{usd(data.overdueAmount)}</span>
          </div>
        </motion.div>
        <motion.div variants={item} className="glass-card rounded-xl p-5 border border-destructive/30 bg-destructive/5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Attention Required
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg p-4 text-center" style={{ background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 40%, #f87171 85%, #fecaca 100%)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>Overdue Tasks</p>
              <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>{data.inDepthOverdue + data.enforcementOverdue + data.destructionOverdue}</p>
              <div className="mt-2 space-y-1 text-xs text-left">
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.8)" }}>In-Depth</span><span style={{ color: "#ffffff" }} className="font-medium">{data.inDepthOverdue}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.8)" }}>Enforcement</span><span style={{ color: "#ffffff" }} className="font-medium">{data.enforcementOverdue}</span></div>
                <div className="flex justify-between"><span style={{ color: "rgba(255,255,255,0.8)" }}>Destruction</span><span style={{ color: "#ffffff" }} className="font-medium">{data.destructionOverdue}</span></div>
              </div>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 40%, #f87171 85%, #fecaca 100%)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>Overdue Invoices</p>
              <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>{data.overdueCount}</p>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.8)" }}>Total overdue</p>
              <p className="text-sm font-bold mt-1" style={{ color: "#ffffff" }}>{usd(data.overdueAmount)}</p>
            </div>
            <div className="rounded-lg p-4 text-center" style={{ background: "linear-gradient(135deg, #ea640f 0%, #f28444 50%, #ffd4b0 90%, #fff5ee 100%)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>Due Next 7 Days</p>
              <p className="text-3xl font-bold" style={{ color: "#ffffff" }}>{data.upcomingInDepth + data.upcomingEnforcement + data.upcomingDestruction}</p>
              <div className="mt-2 space-y-1 text-xs text-left" style={{ color: "rgba(255,255,255,0.85)" }}>
                <div className="flex justify-between"><span>In-Depth</span><span className="font-medium" style={{ color: "#ffffff" }}>{data.upcomingInDepth}</span></div>
                <div className="flex justify-between"><span>Enforcement</span><span className="font-medium" style={{ color: "#ffffff" }}>{data.upcomingEnforcement}</span></div>
                <div className="flex justify-between"><span>Destruction</span><span className="font-medium" style={{ color: "#ffffff" }}>{data.upcomingDestruction}</span></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    ),
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 pl-6">

      {/* Welcome */}
      <motion.div variants={item}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Welcome back, <span className="gradient-text">{firstName}</span>
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Here's your operations overview for today.
              </p>
            </div>
            {/* Date-range view selector */}
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="w-[220px] h-10 text-sm border-primary/30 focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month-view">Current Month View</SelectItem>
                  <SelectItem value="current-year-view">Current Year View</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectSeparator />
                  <SelectItem value="all">All available</SelectItem>
                  <SelectItem value="quarterly">Quarterly View</SelectItem>
                  <SelectItem value="semi-annual">Semi-Annual View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Custom date range — separate row below */}
          {viewMode === "custom" && (
            <div className="flex items-center gap-3 justify-end">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:dark]"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer [color-scheme:dark]"
              />
              <button
                onClick={() => {
                  if (customFrom && customTo) {
                    setAppliedCustom({ from: customFrom, to: customTo });
                  }
                }}
                disabled={!customFrom || !customTo}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Sortable sections */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {sectionOrder.map((id) => (
              <SortableSection key={id} id={id}>
                {sections[id]}
              </SortableSection>
            ))}
          </div>
        </SortableContext>
      </DndContext>

    </motion.div>
  );
};

export default Dashboard;
