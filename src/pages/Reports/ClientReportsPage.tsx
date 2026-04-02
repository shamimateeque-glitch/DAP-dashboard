import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, Users, CheckCircle, XCircle, Activity, DollarSign } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { fmtDate, fmtUSD } from "@/lib/reportUtils";

const CLIENTS = [
  { value: "ONEWORLD", label: "OneWorld" },
  { value: "A.A ASSOCIATES", label: "A.A Associates" },
  { value: "SAFEMARK", label: "SafeMark" },
];

type FlatCase = {
  id: string;
  case_id: string;
  matter_code?: string;
  target_name: string;
  brand_name: string;
  target_category?: string;
  city: string;
  province: string;
  case_status: string;
  case_reported_date: string;
  client: string;
  decision_status?: string;
  decision_date?: string;
  upload_date?: string;
  our_fee_usd?: number;
  enforcement_status?: string;
  enforcement_done_date?: string;
  final_report_date?: string;
  invoice_status?: string;
  invoice_amount?: number;
  invoice_issue_date?: string;
  invoice_due_date?: string;
  invoice_paid_date?: string;
};

export default function ClientReportsPage() {
  const [searchParams] = useSearchParams();
  const [selectedClient, setSelectedClient] = useState<string>(() => {
    const param = searchParams.get("client");
    return param && CLIENTS.some(c => c.value === param) ? param : "";
  });
  const [tab, setTab] = useState("all-submitted");

  const { data: rawCases = [], isLoading } = useQuery({
    queryKey: ["client-reports", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const { data, error } = await supabase
        .from("cases")
        .select("*, case_uploads!inner(*), invoices(*), enforcement_stages(*), final_reports(*)")
        .eq("case_uploads.client", selectedClient);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClient,
  });

  const cases: FlatCase[] = useMemo(() => {
    // Helper: Supabase may return a single object or an array depending on relationship type
    const toArray = (rel: any): any[] => {
      if (!rel) return [];
      return Array.isArray(rel) ? rel : [rel];
    };
    return rawCases.map((c: any) => {
      const uploads = toArray(c.case_uploads);
      const upload = uploads.find((u: any) => u.client === selectedClient) || uploads[0];
      const invoices = toArray(c.invoices);
      const invoice = invoices[0];
      const enforcement = toArray(c.enforcement_stages);
      const enf = enforcement.find((e: any) => e.status === "DONE") || enforcement[0];
      const finalReports = toArray(c.final_reports);
      const fr = finalReports[0];
      return {
        id: c.id,
        case_id: c.case_id || "—",
        matter_code: c.matter_code,
        target_name: c.target_name || "—",
        brand_name: c.brand_name || "—",
        target_category: c.target_category,
        city: c.city || "—",
        province: c.province || "—",
        case_status: c.case_status || "—",
        case_reported_date: c.case_reported_date,
        client: selectedClient,
        decision_status: upload?.decision_status,
        decision_date: upload?.decision_date,
        upload_date: upload?.upload_date,
        our_fee_usd: upload?.our_fee_usd,
        enforcement_status: enf?.status,
        enforcement_done_date: enf?.status_date,
        final_report_status: fr?.status || '',
        final_report_due_date: fr?.due_date,
        final_report_date: fr?.submission_date,
        invoice_status: invoice?.status,
        invoice_amount: invoice?.amount_usd,
        invoice_issue_date: invoice?.issue_date,
        invoice_due_date: invoice?.due_date,
        invoice_paid_date: invoice?.status_date,
      };
    });
  }, [rawCases, selectedClient]);

  const allCases = useMemo(() => [...cases].sort((a, b) => (a.case_reported_date || "").localeCompare(b.case_reported_date || "")), [cases]);
  const approved = useMemo(() => cases.filter(c => c.decision_status === "APPROVED"), [cases]);
  const rejected = useMemo(() => cases.filter(c => c.decision_status === "REJECTED"), [cases]);
  const active = useMemo(() => cases.filter(c => c.case_status !== "CLOSED"), [cases]);
  const enfCompleted = useMemo(() => cases.filter(c => c.enforcement_status === "DONE"), [cases]);

  const invoicedTotal = useMemo(() => cases.reduce((s, c) => s + (c.invoice_amount || 0), 0), [cases]);
  const invoicedPaid = useMemo(() => cases.filter(c => c.invoice_status === "PAID").reduce((s, c) => s + (c.invoice_amount || 0), 0), [cases]);
  const invoicedOutstanding = useMemo(() => cases.filter(c => c.invoice_status === "NOT_PAID").reduce((s, c) => s + (c.invoice_amount || 0), 0), [cases]);
  const invoiceList = useMemo(() => cases.filter(c => c.invoice_status), [cases]);

  const clientLabel = CLIENTS.find(c => c.value === selectedClient)?.label || "";

  function handleExport(data: FlatCase[], reportTitle: string, format: "excel" | "pdf") {
    const rows = data.map(c => ({
      "Brand Name": c.brand_name,
      "Target Name": c.target_name,
      "Province": c.province,
      "City": c.city,
      "Status": c.case_status,
      "Matter Code": c.matter_code || "—",
      "Reported Date": fmtDate(c.case_reported_date),
      "Decision Status": c.decision_status || "—",
      "Decision Date": fmtDate(c.decision_date),
    }));
    const filename = `client-${selectedClient.toLowerCase()}-${reportTitle.toLowerCase().replace(/ /g, "-")}-${new Date().toISOString().split("T")[0]}`;
    if (format === "excel") exportToExcel(rows, filename);
    else exportToPDF(rows, Object.keys(rows[0] || {}), filename, `${clientLabel} — ${reportTitle}`);
    toast.success("Export started");
  }

  function CaseTable({ data, showDecision = false, showEnforcement = false, reportTitle }: {
    data: FlatCase[];
    showDecision?: boolean;
    showEnforcement?: boolean;
    reportTitle: string;
  }) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{reportTitle}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{data.length} records · {clientLabel}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport(data, reportTitle, "excel")}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport(data, reportTitle, "pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                    <TableHead className="text-xs">Brand Name</TableHead>
                    <TableHead className="text-xs">Target Name</TableHead>
                    <TableHead className="text-xs">Province</TableHead>
                    <TableHead className="text-xs">City</TableHead>
                    <TableHead className="text-xs">Case Status</TableHead>
                    <TableHead className="text-xs">Reported Date</TableHead>
                    {showDecision && (
                      <>
                        <TableHead className="text-xs">Decision</TableHead>
                        <TableHead className="text-xs">Decision Date</TableHead>
                      </>
                    )}
                    {showEnforcement && <TableHead className="text-xs">Enforcement Done</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showDecision ? 8 : showEnforcement ? 7 : 6} className="text-center text-muted-foreground py-8">
                        No records found for {clientLabel}
                      </TableCell>
                    </TableRow>
                  ) : data.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{row.brand_name}</TableCell>
                      <TableCell className="text-xs">{row.target_name}</TableCell>
                      <TableCell className="text-xs">{row.province}</TableCell>
                      <TableCell className="text-xs">{row.city}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">{row.case_status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{fmtDate(row.case_reported_date)}</TableCell>
                      {showDecision && (
                        <>
                          <TableCell className="text-xs">
                            {row.decision_status ? (
                              <Badge variant="outline" className={`text-xs ${row.decision_status === "APPROVED" ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30"}`}>
                                {row.decision_status}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(row.decision_date)}</TableCell>
                        </>
                      )}
                      {showEnforcement && <TableCell className="text-xs">{fmtDate(row.enforcement_done_date)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Client Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">R30–R35 · Per-client case and invoice summaries</p>
      </div>

      {/* Client Selector — required, no "All" option */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-foreground whitespace-nowrap">Select Client:</label>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose a client to view reports..." />
              </SelectTrigger>
              <SelectContent>
                {CLIENTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedClient && (
              <Badge variant="secondary" className="text-xs">{cases.length} total cases</Badge>
            )}
          </div>
          {!selectedClient && (
            <p className="text-xs text-muted-foreground mt-2">
              Please select a client to view their reports. Each client's data is kept strictly separate.
            </p>
          )}
        </CardContent>
      </Card>

      {!selectedClient ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Select a client above to view their reports</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Cases</CardTitle></CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{allCases.length}</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />Approved
                </CardTitle>
              </CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-green-500">{approved.length}</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />Rejected
                </CardTitle>
              </CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-red-500">{rejected.length}</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-blue-500" />Active
                </CardTitle>
              </CardHeader>
              <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-blue-500">{active.length}</p>}</CardContent>
            </Card>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all-submitted">All Submitted <Badge variant="secondary" className="ml-1">{allCases.length}</Badge></TabsTrigger>
              <TabsTrigger value="approved">Approved Summary <Badge variant="secondary" className="ml-1">{approved.length}</Badge></TabsTrigger>
              <TabsTrigger value="rejected">Rejected Summary <Badge variant="secondary" className="ml-1">{rejected.length}</Badge></TabsTrigger>
              <TabsTrigger value="active">Active Status <Badge variant="secondary" className="ml-1">{active.length}</Badge></TabsTrigger>
              <TabsTrigger value="enforcement">Enforcement Completed <Badge variant="secondary" className="ml-1">{enfCompleted.length}</Badge></TabsTrigger>
              <TabsTrigger value="invoice">Invoice & Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="all-submitted">
              <CaseTable data={allCases} showDecision reportTitle="R30 — All Submitted Cases" />
            </TabsContent>

            <TabsContent value="approved">
              <CaseTable data={approved} showDecision reportTitle="R31 — Approved Cases Summary" />
            </TabsContent>

            <TabsContent value="rejected">
              <CaseTable data={rejected} showDecision reportTitle="R32 — Rejected Cases Summary" />
            </TabsContent>

            <TabsContent value="active">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">R33 — Active Case Status</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{active.length} records · {clientLabel}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleExport(active, "Active Status", "excel")}>Excel</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(active, "Active Status", "pdf")}>PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Brand Name</TableHead>
                          <TableHead className="text-xs">Target Name</TableHead>
                          <TableHead className="text-xs">Province</TableHead>
                          <TableHead className="text-xs">City</TableHead>
                          <TableHead className="text-xs">Case Status</TableHead>
                          <TableHead className="text-xs">Decision</TableHead>
                          <TableHead className="text-xs">Enforcement</TableHead>
                          <TableHead className="text-xs">Final Report</TableHead>
                          <TableHead className="text-xs">Invoice</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {active.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No active cases</TableCell></TableRow>
                        ) : active.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{row.brand_name}</TableCell>
                            <TableCell className="text-xs">{row.target_name}</TableCell>
                            <TableCell className="text-xs">{row.province}</TableCell>
                            <TableCell className="text-xs">{row.city}</TableCell>
                            <TableCell className="text-xs"><Badge variant="outline" className="text-xs">{row.case_status}</Badge></TableCell>
                            <TableCell className="text-xs">
                              {row.decision_status ? (
                                <Badge variant="outline" className={`text-xs ${row.decision_status === "APPROVED" ? "text-green-400" : "text-red-400"}`}>
                                  {row.decision_status}
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.enforcement_status ? (
                                <Badge variant="outline" className={`text-xs ${row.enforcement_status === "DONE" ? "text-green-400" : "text-amber-400"}`}>
                                  {row.enforcement_status}
                                </Badge>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.final_report_date ? fmtDate(row.final_report_date) : <span className="text-muted-foreground">Pending</span>}
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.invoice_status ? <Badge variant="outline" className="text-xs">{row.invoice_status}</Badge> : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="enforcement">
              <CaseTable data={enfCompleted} showDecision showEnforcement reportTitle="R34 — Enforcement Completed Cases" />
            </TabsContent>

            <TabsContent value="invoice" className="space-y-4">
              {/* Invoice KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5" />Total Issued
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-xl font-bold">{fmtUSD(invoicedTotal)}</p>}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />Total Paid
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-xl font-bold text-green-500">{fmtUSD(invoicedPaid)}</p>}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />Outstanding
                    </CardTitle>
                  </CardHeader>
                  <CardContent>{isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-xl font-bold text-amber-500">{fmtUSD(invoicedOutstanding)}</p>}</CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">R35 — Invoice & Payment Details</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => {
                          const rows = invoiceList.map(c => ({
                            "Brand Name": c.brand_name,
                            "Target Name": c.target_name,
                            "Invoice Issue Date": fmtDate(c.invoice_issue_date),
                            "Invoice Due Date": fmtDate(c.invoice_due_date),
                            "Paid Date": fmtDate(c.invoice_paid_date),
                            "Amount (USD)": fmtUSD(c.invoice_amount),
                            "Invoice Status": c.invoice_status || "—",
                          }));
                          exportToExcel(rows, `client-${selectedClient.toLowerCase()}-invoices`);
                          toast.success("Export started");
                        }}>Excel</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const rows = invoiceList.map(c => ({
                            "Brand Name": c.brand_name,
                            "Target Name": c.target_name,
                            "Invoice Issue Date": fmtDate(c.invoice_issue_date),
                            "Invoice Due Date": fmtDate(c.invoice_due_date),
                            "Paid Date": fmtDate(c.invoice_paid_date),
                            "Amount (USD)": fmtUSD(c.invoice_amount),
                            "Invoice Status": c.invoice_status || "—",
                          }));
                          exportToPDF(rows, Object.keys(rows[0] || {}), `client-${selectedClient.toLowerCase()}-invoices`, `${clientLabel} — Invoice & Payment`);
                          toast.success("Export started");
                        }}>PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Brand Name</TableHead>
                          <TableHead className="text-xs">Target Name</TableHead>
                          <TableHead className="text-xs">Issue Date</TableHead>
                          <TableHead className="text-xs">Due Date</TableHead>
                          <TableHead className="text-xs">Paid Date</TableHead>
                          <TableHead className="text-right text-xs">Amount (USD)</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No invoices for {clientLabel}
                            </TableCell>
                          </TableRow>
                        ) : invoiceList.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{row.brand_name}</TableCell>
                            <TableCell className="text-xs">{row.target_name}</TableCell>
                            <TableCell className="text-xs">{fmtDate(row.invoice_issue_date)}</TableCell>
                            <TableCell className="text-xs">{fmtDate(row.invoice_due_date)}</TableCell>
                            <TableCell className="text-xs">{row.invoice_paid_date ? fmtDate(row.invoice_paid_date) : "—"}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{fmtUSD(row.invoice_amount)}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={`text-xs ${row.invoice_status === "PAID" ? "text-green-400 border-green-500/30" :
                                row.invoice_status === "NOT_PAID" ? "text-red-400 border-red-500/30" : ""
                                }`}>
                                {row.invoice_status || "—"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
