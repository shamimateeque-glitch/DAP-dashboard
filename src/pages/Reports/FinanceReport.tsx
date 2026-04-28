import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, TrendingUp, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import {
  classifyDueDate, DUE_DATE_ROW_CLASSES, DUE_DATE_BADGE_CLASSES,
  getAgingBucket, AGING_BUCKET_LABELS, AGING_BUCKET_ORDER,
  buildExportRows, fmtDate, fmtUSD, daysFromToday, fmtDaysToDue,
  AgingBucket, ChartTooltip,
} from "@/lib/reportUtils";
import { ColumnSelector, useColumnState, ColumnDef, DraggableHeader } from "@/components/reports/ColumnSelector";
import { normalizeClientName } from "@/lib/paymentTerms";

const R24_COLS: ColumnDef[] = [
  { key: "matter_code", label: "Matter Code", defaultVisible: true },
  { key: "brand_name", label: "Brand Name", defaultVisible: true },
  { key: "client", label: "Client", defaultVisible: true },
  { key: "target_name", label: "Target Name", defaultVisible: true },
  { key: "invoice_number", label: "Invoice #", defaultVisible: true },
  { key: "issue_date", label: "Invoice Issue Date", defaultVisible: true },
  { key: "due_date", label: "Invoice Due Date", defaultVisible: true },
  { key: "amount_usd", label: "Amount (USD)", defaultVisible: true },
  { key: "status", label: "Invoice Status", defaultVisible: true },
  { key: "days_to_due", label: "Days to Due / Overdue", defaultVisible: true },
  { key: "aging_bucket", label: "Aging Bucket", defaultVisible: true },
];

const R25_COLS: ColumnDef[] = [
  { key: "invoice_number", label: "Invoice #", defaultVisible: true },
  { key: "client", label: "Client", defaultVisible: true },
  { key: "target_name", label: "Target Name", defaultVisible: true },
  { key: "brand_name", label: "Brand Name", defaultVisible: true },
  { key: "issue_date", label: "Issue Date", defaultVisible: true },
  { key: "due_date", label: "Due Date", defaultVisible: true },
  { key: "paid_date", label: "Paid Date", defaultVisible: true },
  { key: "amount_usd", label: "Amount (USD)", defaultVisible: true },
];

type FlatInvoice = {
  id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  amount_usd: number;
  status: string;
  status_date?: string;
  case_id: string;
  case_uuid: string;
  matter_code?: string;
  target_name: string;
  brand_name: string;
  city: string;
  province: string;
  client: string;
  days_to_due: number | null;
  aging_bucket: AgingBucket;
  paid_date?: string;
};

export default function FinanceReport() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("not-paid");
  const [filterClient, setFilterClient] = useState("all");
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterProvince, setFilterProvince] = useState("All");
  const [filterCity, setFilterCity] = useState("All");
  const [filterAgingBucket, setFilterAgingBucket] = useState("all");
  const [filterIssueDateFrom, setFilterIssueDateFrom] = useState("");
  const [filterIssueDateTo, setFilterIssueDateTo] = useState("");
  const [filterDueDateFrom, setFilterDueDateFrom] = useState("");
  const [filterDueDateTo, setFilterDueDateTo] = useState("");

  const r24Cols = useColumnState(R24_COLS, "fin-r24");
  const r25Cols = useColumnState(R25_COLS, "fin-r25");

  const { data: rawInvoices = [], isLoading } = useQuery({
    queryKey: ["finance-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, cases!inner(id, case_id, matter_code, target_name, brand_name, city, province, case_uploads(client))");
      if (error) throw error;
      return data || [];
    },
  });

  const invoices: FlatInvoice[] = useMemo(() => {
    return rawInvoices.map((inv: any) => {
      const c = inv.cases || {};
      const upload = Array.isArray(c.case_uploads) ? c.case_uploads[0] : c.case_uploads;
      const client = normalizeClientName(upload?.client) || "—";
      const days = daysFromToday(inv.due_date);
      const aging = getAgingBucket(inv.due_date);
      return {
        id: inv.id,
        invoice_number: inv.invoice_number || "—",
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        amount_usd: inv.amount_usd || 0,
        status: inv.status || "—",
        status_date: inv.status_date,
        case_id: c.case_id || inv.case_id || "—",
        case_uuid: c.id || "",
        matter_code: c.matter_code,
        target_name: c.target_name || "—",
        brand_name: c.brand_name || "—",
        city: c.city || "—",
        province: c.province || "—",
        client,
        days_to_due: days,
        aging_bucket: aging,
        paid_date: inv.status_date,
      };
    });
  }, [rawInvoices]);

  const totalIssued = useMemo(() => invoices.reduce((s, i) => s + i.amount_usd, 0), [invoices]);
  const totalCollected = useMemo(() => invoices.filter(i => i.status === "PAID").reduce((s, i) => s + i.amount_usd, 0), [invoices]);
  const totalOutstanding = useMemo(() => invoices.filter(i => i.status !== "PAID").reduce((s, i) => s + i.amount_usd, 0), [invoices]);
  const collectionRate = totalIssued > 0 ? ((totalCollected / totalIssued) * 100).toFixed(1) : "0.0";

  const clients = useMemo(() => Array.from(new Set(invoices.map(i => i.client).filter(c => c !== "—"))).sort(), [invoices]);
  const brandOptions = useMemo(() => Array.from(new Set(invoices.map(i => i.brand_name).filter(b => b && b !== "—"))).sort(), [invoices]);
  const provinceOptions = useMemo(() => Array.from(new Set(invoices.map(i => i.province).filter(p => p && p !== "—"))).sort(), [invoices]);
  const cityOptions = useMemo(() => Array.from(new Set(invoices.map(i => i.city).filter(c => c && c !== "—"))).sort(), [invoices]);

  const notPaidInvoices = useMemo(() => {
    return invoices
      .filter(i => i.status !== "PAID")
      .filter(i => filterClient === "all" || i.client === filterClient)
      .filter(i => filterBrand === "All" || i.brand_name === filterBrand)
      .filter(i => filterProvince === "All" || i.province === filterProvince)
      .filter(i => filterCity === "All" || i.city === filterCity)
      .filter(i => filterAgingBucket === "all" || i.aging_bucket === filterAgingBucket)
      .filter(i => !filterIssueDateFrom || i.issue_date >= filterIssueDateFrom)
      .filter(i => !filterIssueDateTo || i.issue_date <= filterIssueDateTo)
      .filter(i => !filterDueDateFrom || i.due_date >= filterDueDateFrom)
      .filter(i => !filterDueDateTo || i.due_date <= filterDueDateTo)
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
  }, [invoices, filterClient, filterBrand, filterProvince, filterCity, filterAgingBucket, filterIssueDateFrom, filterIssueDateTo, filterDueDateFrom, filterDueDateTo]);

  const paidInvoices = useMemo(() =>
    invoices.filter(i => i.status === "PAID").sort((a, b) => (b.status_date || "").localeCompare(a.status_date || "")),
    [invoices]
  );

  const agingData = useMemo(() => {
    const bucketMap: Record<AgingBucket, { count: number; amount: number }> = {} as any;
    for (const b of AGING_BUCKET_ORDER) bucketMap[b] = { count: 0, amount: 0 };
    invoices.filter(i => i.status !== "PAID").forEach(i => {
      bucketMap[i.aging_bucket].count++;
      bucketMap[i.aging_bucket].amount += i.amount_usd;
    });
    return AGING_BUCKET_ORDER.map(b => ({
      bucket: b,
      label: AGING_BUCKET_LABELS[b],
      count: bucketMap[b].count,
      amount: bucketMap[b].amount,
    }));
  }, [invoices]);

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.filter(i => i.status === "PAID").forEach(i => {
      if (!i.issue_date) return;
      try {
        const d = new Date(i.issue_date);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        map[key] = (map[key] || 0) + i.amount_usd;
      } catch { /* skip invalid dates */ }
    });
    return Object.entries(map)
      .sort((a, b) => new Date("01 " + a[0]).getTime() - new Date("01 " + b[0]).getTime())
      .map(([name, amount]) => ({ name, amount }));
  }, [invoices]);

  const revenueByClient = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    invoices.filter(i => i.status === "PAID").forEach(i => {
      if (!map[i.client]) map[i.client] = { count: 0, total: 0 };
      map[i.client].count++;
      map[i.client].total += i.amount_usd;
    });
    return Object.entries(map).map(([client, { count, total }]) => ({
      client, count, total, avg: count > 0 ? total / count : 0,
    })).sort((a, b) => b.total - a.total);
  }, [invoices]);

  const revenueByBrand = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    invoices.filter(i => i.status === "PAID").forEach(i => {
      if (!map[i.brand_name]) map[i.brand_name] = { count: 0, total: 0 };
      map[i.brand_name].count++;
      map[i.brand_name].total += i.amount_usd;
    });
    return Object.entries(map).map(([brand, { count, total }]) => ({ brand, count, total }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  const revenueByProvince = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    invoices.filter(i => i.status === "PAID").forEach(i => {
      if (!map[i.province]) map[i.province] = { count: 0, total: 0 };
      map[i.province].count++;
      map[i.province].total += i.amount_usd;
    });
    return Object.entries(map).map(([province, { count, total }]) => ({ province, count, total }))
      .sort((a, b) => b.total - a.total);
  }, [invoices]);

  const r24VisibleCols = useMemo(() =>
    R24_COLS.filter(c => r24Cols.visibleKeys.has(c.key)).sort((a, b) => {
      const ai = r24Cols.columns.findIndex(x => x.key === a.key);
      const bi = r24Cols.columns.findIndex(x => x.key === b.key);
      return ai - bi;
    }), [r24Cols]);

  const r25VisibleCols = useMemo(() =>
    R25_COLS.filter(c => r25Cols.visibleKeys.has(c.key)).sort((a, b) => {
      const ai = r25Cols.columns.findIndex(x => x.key === a.key);
      const bi = r25Cols.columns.findIndex(x => x.key === b.key);
      return ai - bi;
    }), [r25Cols]);

  const getCellValue = (row: FlatInvoice, key: string): string => {
    switch (key) {
      case "case_id": return row.case_id;
      case "invoice_number": return row.invoice_number;
      case "matter_code": return row.matter_code || "—";
      case "brand_name": return row.brand_name;
      case "client": return row.client;
      case "target_name": return row.target_name;
      case "issue_date": return fmtDate(row.issue_date);
      case "due_date": return fmtDate(row.due_date);
      case "amount_usd": return fmtUSD(row.amount_usd);
      case "status": return row.status;
      case "days_to_due": return fmtDaysToDue(row.days_to_due);
      case "aging_bucket": return AGING_BUCKET_LABELS[row.aging_bucket] || row.aging_bucket;
      case "paid_date": return fmtDate(row.paid_date);
      default: return "—";
    }
  };

  function handleExportR24(format: "csv" | "excel" | "pdf") {
    const rows = buildExportRows(
      notPaidInvoices.map(r => {
        const out: Record<string, any> = {};
        for (const c of r24VisibleCols) out[c.key] = getCellValue(r, c.key);
        return out;
      }),
      r24VisibleCols
    );
    const filename = `finance-not-paid-${new Date().toISOString().split("T")[0]}`;
    if (format === "csv") exportToCSV(rows, filename);
    else if (format === "excel") exportToExcel(rows, filename);
    else exportToPDF(rows, filename, "Finance — Not Paid Invoices");
    toast.success("Export started");
  }

  function handleExportR25(format: "csv" | "excel" | "pdf") {
    const rows = buildExportRows(
      paidInvoices.map(r => {
        const out: Record<string, any> = {};
        for (const c of r25VisibleCols) out[c.key] = getCellValue(r, c.key);
        return out;
      }),
      r25VisibleCols
    );
    const filename = `finance-paid-${new Date().toISOString().split("T")[0]}`;
    if (format === "csv") exportToCSV(rows, filename);
    else if (format === "excel") exportToExcel(rows, filename);
    else exportToPDF(rows, filename, "Finance — Paid Invoices");
    toast.success("Export started");
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">R24–R29 · Invoice management and revenue analysis</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Total Issued
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold">{fmtUSD(totalIssued)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-green-500">{fmtUSD(totalCollected)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" /> Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-red-500">{fmtUSD(totalOutstanding)}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Collection Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-blue-500">{collectionRate}%</p>}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="not-paid">Not Paid <Badge variant="secondary" className="ml-1">{notPaidInvoices.length}</Badge></TabsTrigger>
          <TabsTrigger value="paid">Paid <Badge variant="secondary" className="ml-1">{paidInvoices.length}</Badge></TabsTrigger>
          <TabsTrigger value="aging">Invoice Aging</TabsTrigger>
          <TabsTrigger value="by-client">Revenue by Client</TabsTrigger>
          <TabsTrigger value="by-brand">Revenue by Brand</TabsTrigger>
          <TabsTrigger value="by-province">Revenue by Province</TabsTrigger>
        </TabsList>

        {/* R24 — Not Paid */}
        <TabsContent value="not-paid" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <CardTitle className="text-base">R24 — Not Paid Invoices</CardTitle>
                <div className="flex items-center gap-2">
                  <ColumnSelector defs={R24_COLS} storageKey="fin-r24" onChange={() => {}} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExportR24("csv")}>CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportR24("excel")}>Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportR24("pdf")}>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterBrand} onValueChange={setFilterBrand}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Brand Name" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Brands</SelectItem>
                    {brandOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterProvince} onValueChange={setFilterProvince}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Province" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Provinces</SelectItem>
                    {provinceOptions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="City" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Cities</SelectItem>
                    {cityOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterAgingBucket} onValueChange={setFilterAgingBucket}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Aging Bucket" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buckets</SelectItem>
                    {AGING_BUCKET_ORDER.map(b => <SelectItem key={b} value={b}>{AGING_BUCKET_LABELS[b]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={filterIssueDateFrom} onChange={e => setFilterIssueDateFrom(e.target.value)} className="w-36 h-8 text-xs" title="Issue Date From" />
                <Input type="date" value={filterIssueDateTo} onChange={e => setFilterIssueDateTo(e.target.value)} className="w-36 h-8 text-xs" title="Issue Date To" />
                <Input type="date" value={filterDueDateFrom} onChange={e => setFilterDueDateFrom(e.target.value)} className="w-36 h-8 text-xs" title="Due Date From" />
                <Input type="date" value={filterDueDateTo} onChange={e => setFilterDueDateTo(e.target.value)} className="w-36 h-8 text-xs" title="Due Date To" />
                {(filterClient !== "all" || filterBrand !== "All" || filterProvince !== "All" || filterCity !== "All" || filterAgingBucket !== "all" || filterIssueDateFrom || filterIssueDateTo || filterDueDateFrom || filterDueDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                    setFilterClient("all"); setFilterBrand("All"); setFilterProvince("All"); setFilterCity("All");
                    setFilterAgingBucket("all"); setFilterIssueDateFrom(""); setFilterIssueDateTo("");
                    setFilterDueDateFrom(""); setFilterDueDateTo("");
                  }}>Clear</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <DraggableHeader cols={r24VisibleCols} allColumns={r24Cols.columns} onReorder={r24Cols.reorder} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notPaidInvoices.length === 0 ? (
                        <TableRow><TableCell colSpan={r24VisibleCols.length} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
                      ) : notPaidInvoices.map(row => {
                        const dc = classifyDueDate(row.due_date);
                        return (
                          <TableRow key={row.id} className={DUE_DATE_ROW_CLASSES[dc]}>
                            {r24VisibleCols.map(c => (
                              <TableCell key={c.key} className="text-xs whitespace-nowrap">
                                {c.key === "matter_code" ? (
                                  <span
                                    className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                                    onClick={() => navigate(`/cases/${row.case_uuid}`)}
                                  >
                                    {row.matter_code || "—"}
                                  </span>
                                ) : c.key === "aging_bucket" ? (
                                  <Badge variant="outline" className={`text-xs ${DUE_DATE_BADGE_CLASSES[dc]}`}>
                                    {AGING_BUCKET_LABELS[row.aging_bucket]}
                                  </Badge>
                                ) : c.key === "status" ? (
                                  <Badge variant="outline" className="text-xs">{row.status === "PAID" ? "PAID" : row.status === "—" ? "—" : "UNPAID"}</Badge>
                                ) : c.key === "amount_usd" ? (
                                  <span className="font-mono">{fmtUSD(row.amount_usd)}</span>
                                ) : c.key === "days_to_due" ? (
                                  <span className={dc !== "normal" ? "font-medium" : ""}>{fmtDaysToDue(row.days_to_due)}</span>
                                ) : getCellValue(row, c.key)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{notPaidInvoices.length}</span> not paid invoices
              </p>
              <p className="text-sm text-muted-foreground">
                Amount: <span className="font-semibold text-foreground font-mono">{fmtUSD(notPaidInvoices.reduce((s, i) => s + i.amount_usd, 0))}</span>
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* R25 — Paid */}
        <TabsContent value="paid" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">R25 — Paid Invoices</CardTitle>
                <div className="flex items-center gap-2">
                  <ColumnSelector defs={R25_COLS} storageKey="fin-r25" onChange={() => {}} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExportR25("csv")}>CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportR25("excel")}>Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportR25("pdf")}>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <DraggableHeader cols={r25VisibleCols} allColumns={r25Cols.columns} onReorder={r25Cols.reorder} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidInvoices.length === 0 ? (
                        <TableRow><TableCell colSpan={r25VisibleCols.length} className="text-center text-muted-foreground py-8">No paid invoices</TableCell></TableRow>
                      ) : paidInvoices.map(row => (
                        <TableRow key={row.id}>
                          {r25VisibleCols.map(c => (
                            <TableCell key={c.key} className="text-xs whitespace-nowrap">
                              {c.key === "matter_code" ? (
                                <span
                                  className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                                  onClick={() => navigate(`/cases/${row.case_uuid}`)}
                                >
                                  {row.matter_code || "—"}
                                </span>
                              ) : c.key === "amount_usd" ? <span className="font-mono">{fmtUSD(row.amount_usd)}</span> : getCellValue(row, c.key)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* R26 — Invoice Aging */}
        <TabsContent value="aging" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">R26 — Invoice Aging Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aging Bucket</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Amount (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData.map(row => (
                      <TableRow key={row.bucket} className={
                        row.bucket.startsWith("OVR") ? "bg-red-950/20" :
                        row.bucket === "DUE_TODAY" ? "bg-amber-950/20" :
                        row.bucket === "DUE_7" ? "bg-orange-950/20" : ""
                      }>
                        <TableCell className="text-xs font-medium">{row.label}</TableCell>
                        <TableCell className="text-right text-xs">
                          {row.count > 0 ? (
                            <span
                              className="text-blue-600 cursor-pointer hover:underline font-semibold"
                              onClick={() => { setFilterAgingBucket(row.bucket); setTab("not-paid"); }}
                            >
                              {row.count}
                            </span>
                          ) : row.count}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{fmtUSD(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell className="text-xs">TOTAL</TableCell>
                      <TableCell className="text-right text-xs">
                        <span
                          className="text-blue-600 cursor-pointer hover:underline font-semibold"
                          onClick={() => { setFilterAgingBucket("all"); setTab("not-paid"); }}
                        >
                          {agingData.reduce((s, r) => s + r.count, 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">{fmtUSD(agingData.reduce((s, r) => s + r.amount, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Monthly Revenue (Paid)</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48 w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={monthlyRevenue}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                      <Tooltip content={<ChartTooltip formatter={(v: any) => fmtUSD(v)} />} cursor={{ stroke: "hsl(215, 20%, 55%)", strokeDasharray: "3 3" }} />
                      <Area type="monotone" dataKey="amount" name="Revenue" stroke="#3b82f6" fill="url(#revenueGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* R27 — Revenue by Client */}
        <TabsContent value="by-client" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">R27 — Revenue by Client</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total (USD)</TableHead>
                      <TableHead className="text-right">Avg (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueByClient.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No paid invoices</TableCell></TableRow>
                    ) : revenueByClient.map(row => (
                      <TableRow key={row.client}>
                        <TableCell className="text-sm font-medium">{row.client}</TableCell>
                        <TableCell className="text-right text-sm">{row.count}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{fmtUSD(row.total)}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{fmtUSD(row.avg)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Client (Chart)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueByClient}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                    <XAxis dataKey="client" tick={{ fontSize: 11 }} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                    <Tooltip content={<ChartTooltip formatter={(v: any) => fmtUSD(v)} />} cursor={{ fill: "hsl(217, 33%, 17%)", opacity: 0.3 }} />
                    <Bar dataKey="total" name="Revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* R28 — Revenue by Brand */}
        <TabsContent value="by-brand" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">R28 — Revenue by Brand</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand Name</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Total (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByBrand.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No paid invoices</TableCell></TableRow>
                  ) : revenueByBrand.map(row => (
                    <TableRow key={row.brand}>
                      <TableCell className="text-sm font-medium">{row.brand}</TableCell>
                      <TableCell className="text-right text-sm">{row.count}</TableCell>
                      <TableCell className="text-right text-sm font-mono">{fmtUSD(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* R29 — Revenue by Province */}
        <TabsContent value="by-province" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">R29 — Revenue by Province</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Province</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Total (USD)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenueByProvince.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">No paid invoices</TableCell></TableRow>
                    ) : revenueByProvince.map(row => (
                      <TableRow key={row.province}>
                        <TableCell className="text-sm font-medium">{row.province}</TableCell>
                        <TableCell className="text-right text-sm">{row.count}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{fmtUSD(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Province (Chart)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueByProvince} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                    <YAxis type="category" dataKey="province" tick={{ fontSize: 11 }} width={80} stroke="hsl(215, 20%, 55%)" tickLine={false} />
                    <Tooltip content={<ChartTooltip formatter={(v: any) => fmtUSD(v)} />} cursor={{ fill: "hsl(217, 33%, 17%)", opacity: 0.3 }} />
                    <Bar dataKey="total" name="Revenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
