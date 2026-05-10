import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { escapeLikePattern } from '@/lib/security';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Download,
    Eye,
    CheckCircle2,
    Clock,
    AlertCircle,
    X,
    RotateCcw,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    FileOutput,
    FileText,
    FileDown
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import UpdateInvoiceStatusModal from '@/components/forms/UpdateInvoiceStatusModal';
import { toast } from 'sonner';
import { normalizeClientName } from '@/lib/paymentTerms';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';

interface InvoiceListProps {
    status?: 'ISSUED' | 'PAID' | 'NOT_PAID' | 'OVERDUE' | 'all';
}

import { DEFAULT_BRANDS as BRAND_OPTIONS } from '@/lib/brands';

const InvoiceList: React.FC<InvoiceListProps> = ({ status: statusFilter }) => {
    const navigate = useNavigate();

    // Filters + search are persisted to URL search params so they survive
    // navigation (e.g. open an invoice → browser back restores the filtered list).
    const [searchParams, setSearchParams] = useSearchParams();

    const updateParam = (key: string, value: string, defaultValue = 'all') => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (!value || value === defaultValue) next.delete(key);
            else next.set(key, value);
            return next;
        }, { replace: true });
    };

    const searchTerm = searchParams.get('q') || '';
    const setSearchTerm = (v: string) => updateParam('q', v, '');

    const page = parseInt(searchParams.get('page') || '1', 10) || 1;
    const setPage = (updater: number | ((p: number) => number)) => {
        const nextPage = typeof updater === 'function' ? updater(page) : updater;
        updateParam('page', String(nextPage), '1');
    };

    const showAll = searchParams.get('all') === '1';
    const setShowAll = (v: boolean) => updateParam('all', v ? '1' : '', '');

    const pageSize = 10;

    const clientFilter = searchParams.get('client') || 'all';
    const setClientFilter = (v: string) => updateParam('client', v);

    const provinceFilter = searchParams.get('province') || 'all';
    const setProvinceFilter = (v: string) => updateParam('province', v);

    const brandFilter = searchParams.get('brand') || 'all';
    const setBrandFilter = (v: string) => updateParam('brand', v);

    const caseTypeFilter = searchParams.get('type') || 'all';
    const setCaseTypeFilter = (v: string) => updateParam('type', v);

    const startDate = searchParams.get('start') || '';
    const setStartDate = (v: string) => updateParam('start', v, '');

    const endDate = searchParams.get('end') || '';
    const setEndDate = (v: string) => updateParam('end', v, '');

    const statusInternalDefault = statusFilter === 'OVERDUE' ? 'all' : (statusFilter || 'all');
    const statusInternal = searchParams.get('status') || statusInternalDefault;
    const setStatusInternal = (v: string) => updateParam('status', v, statusInternalDefault);

    // Modal State
    const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<'invoice_number' | 'date' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: 'invoice_number' | 'date') => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (column: 'invoice_number' | 'date') => {
        if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="ml-1 h-3 w-3 inline text-blue-400" />
            : <ArrowDown className="ml-1 h-3 w-3 inline text-blue-400" />;
    };

    const { data: invoices, isLoading, refetch } = useQuery({
        queryKey: ['invoices', searchTerm, page, showAll, clientFilter, provinceFilter, brandFilter, caseTypeFilter, startDate, endDate, statusInternal, statusFilter],
        queryFn: async () => {
            // Use !inner on joined tables so filters actually exclude parent invoice rows
            // (without !inner, Supabase only hides the embed and still returns the invoice).
            const needsUploadInner = clientFilter !== 'all';
            const uploadSelect = needsUploadInner ? 'case_uploads!inner(*)' : 'case_uploads(*)';

            let query = supabase
                .from('invoices')
                .select(`
                    *,
                    cases!inner(
                        case_id,
                        target_name,
                        brand_name,
                        province,
                        ${uploadSelect}
                    )
                `, { count: 'exact' });

            if (searchTerm) {
                // Use .ilike() directly rather than .or() — PostgREST's `.or()`
                // parses its argument as "column.op.value", so values that
                // contain "." or "/" (like invoice numbers) get mangled.
                const escaped = escapeLikePattern(searchTerm);
                query = query.ilike('invoice_number', `%${escaped}%`);
            }

            // Apply Status Filter
            const activeStatus = (statusFilter && statusFilter !== 'all') ? statusFilter : statusInternal;
            const todayStr = new Date().toISOString().split('T')[0];

            if (activeStatus === 'OVERDUE') {
                query = query.neq('status', 'PAID').lt('due_date', todayStr);
            } else if (activeStatus === 'ISSUED' || activeStatus === 'NOT_PAID') {
                // Show ONLY non-overdue outstanding invoices (Strictly current/upcoming)
                query = query.neq('status', 'PAID').gte('due_date', todayStr);
            } else if (activeStatus !== 'all' && activeStatus) {
                query = query.eq('status', activeStatus);
            }

            if (provinceFilter !== 'all') {
                query = query.eq('cases.province', provinceFilter);
            }

            if (clientFilter !== 'all') {
                query = query.eq('cases.case_uploads.client', clientFilter);
            }

            if (brandFilter !== 'all') {
                query = query.eq('cases.brand_name', brandFilter);
            }

            if (caseTypeFilter !== 'all') {
                query = query.eq('cases.case_type', caseTypeFilter);
            }

            if (startDate) {
                query = query.gte('issue_date', startDate);
            }

            if (endDate) {
                query = query.lte('issue_date', endDate);
            }

            query = query.order('due_date', { ascending: true });

            if (!showAll) {
                query = query.range((page - 1) * pageSize, page * pageSize - 1);
            }

            const { data, count, error } = await query;

            if (error) throw error;
            return { data, count };
        },
    });

    // Helper to calculate totals
    const { data: stats } = useQuery({
        queryKey: ['invoice-stats'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('amount_usd, status, due_date');

            if (error) throw error;

            const todayStr = new Date().toISOString().split('T')[0];

            const unpaidList = data.filter(inv => inv.status !== 'PAID');

            // Overdue: Unpaid AND past due date
            const overdueList = unpaidList.filter(inv => inv.due_date < todayStr);
            const overdue = overdueList.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
            const overdueCount = overdueList.length;

            // Due (On-Time): Unpaid AND NOT past due date
            const dueList = unpaidList.filter(inv => inv.due_date >= todayStr);
            const outstanding = dueList.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
            const outstandingCount = dueList.length;

            const paidList = data.filter(inv => inv.status === 'PAID');
            const paid = paidList.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
            const paidCount = paidList.length;

            const total = data.reduce((sum, inv) => sum + (inv.amount_usd || 0), 0);
            const totalCount = data.length;

            return { outstanding, outstandingCount, overdue, overdueCount, paid, paidCount, total, totalCount };
        }
    });

    const sortedInvoices = React.useMemo(() => {
        if (!invoices?.data || !sortColumn) return invoices?.data;
        const sorted = [...invoices.data].sort((a: any, b: any) => {
            if (sortColumn === 'invoice_number') {
                const valA = (a.invoice_number || '').toLowerCase();
                const valB = (b.invoice_number || '').toLowerCase();
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (sortColumn === 'date') {
                const dateA = new Date(a.due_date || 0).getTime();
                const dateB = new Date(b.due_date || 0).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
        return sorted;
    }, [invoices?.data, sortColumn, sortDirection]);

    const handleExportAll = async (fmt: 'csv' | 'excel' | 'pdf') => {
        const loadingToast = toast.loading(`Preparing ${fmt.toUpperCase()} export…`);
        try {
            // Re-run the same filtered query as the table, but without pagination
            // so the export covers every row matching the current filters.
            const needsUploadInner = clientFilter !== 'all';
            const uploadSelect = needsUploadInner ? 'case_uploads!inner(*)' : 'case_uploads(*)';

            let query = supabase
                .from('invoices')
                .select(`
                    *,
                    cases!inner(
                        case_id,
                        target_name,
                        brand_name,
                        case_type,
                        province,
                        ${uploadSelect}
                    )
                `);

            if (searchTerm) {
                const escaped = escapeLikePattern(searchTerm);
                query = query.ilike('invoice_number', `%${escaped}%`);
            }

            const activeStatus = (statusFilter && statusFilter !== 'all') ? statusFilter : statusInternal;
            const todayStr = new Date().toISOString().split('T')[0];
            if (activeStatus === 'OVERDUE') {
                query = query.neq('status', 'PAID').lt('due_date', todayStr);
            } else if (activeStatus === 'ISSUED' || activeStatus === 'NOT_PAID') {
                query = query.neq('status', 'PAID').gte('due_date', todayStr);
            } else if (activeStatus !== 'all' && activeStatus) {
                query = query.eq('status', activeStatus);
            }

            if (provinceFilter !== 'all') query = query.eq('cases.province', provinceFilter);
            if (clientFilter !== 'all') query = query.eq('cases.case_uploads.client', clientFilter);
            if (brandFilter !== 'all') query = query.eq('cases.brand_name', brandFilter);
            if (caseTypeFilter !== 'all') query = query.eq('cases.case_type', caseTypeFilter);
            if (startDate) query = query.gte('issue_date', startDate);
            if (endDate) query = query.lte('issue_date', endDate);

            const { data, error } = await query.order('due_date', { ascending: true });
            if (error) throw error;
            if (!data || data.length === 0) {
                toast.dismiss(loadingToast);
                toast.error('No invoices to export');
                return;
            }

            const fmtDate = (d?: string | null) => d ? format(parseISO(d), 'yyyy-MM-dd') : '';
            const todayDate = new Date().toISOString().split('T')[0];

            const exportData = data.map((inv: any) => {
                const c = Array.isArray(inv.cases) ? inv.cases[0] : inv.cases;
                const upload = Array.isArray(c?.case_uploads) ? c.case_uploads[0] : c?.case_uploads;
                const isOverdue = inv.status !== 'PAID' && inv.due_date && inv.due_date < todayDate;
                const displayStatus = inv.status === 'PAID' ? 'PAID' : isOverdue ? 'OVERDUE' : 'UNPAID';

                return {
                    'Invoice Number': inv.invoice_number || '',
                    'Case ID': c?.case_id || '',
                    'Target Name': c?.target_name || '',
                    'Brand': c?.brand_name || '',
                    'Case Type': c?.case_type || '',
                    'Client': normalizeClientName(upload?.client) || '',
                    'Province': c?.province || '',
                    'Issue Date': fmtDate(inv.issue_date),
                    'Due Date': fmtDate(inv.due_date),
                    'Amount (USD)': inv.amount_usd ?? '',
                    'Status': displayStatus,
                    'Status Date': fmtDate(inv.status_date),
                };
            });

            const fileName = `Invoices-Export-${todayDate}`;
            if (fmt === 'csv') {
                await exportToCSV(exportData, fileName);
            } else if (fmt === 'excel') {
                await exportToExcel(exportData, fileName);
            } else {
                await exportToPDF(
                    exportData,
                    ['Invoice Number', 'Case ID', 'Target Name', 'Brand', 'Client', 'Issue Date', 'Due Date', 'Amount (USD)', 'Status'],
                    fileName,
                    'Invoices Export'
                );
            }
            toast.dismiss(loadingToast);
            toast.success(`Exported ${data.length} invoices to ${fmt.toUpperCase()}`);
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(err?.message || 'Export failed');
        }
    };

    const resetFilters = () => {
        setClientFilter('all');
        setProvinceFilter('all');
        setBrandFilter('all');
        setCaseTypeFilter('all');
        setStartDate('');
        setEndDate('');
        setStatusInternal('all');
        setSearchTerm('');
    };

    const getStatusBadge = (inv: any) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const isOverdue = inv.status !== 'PAID' && inv.due_date < todayStr;

        if (inv.status === 'PAID') {
            return <Badge variant="success">PAID</Badge>;
        }

        if (isOverdue) {
            return (
                <div className="flex flex-col gap-1">
                    <Badge variant="destructive">OVERDUE</Badge>
                    <span className="text-[10px] text-destructive font-medium flex items-center gap-0.5">
                        <AlertCircle className="h-2.5 w-2.5" /> High Priority
                    </span>
                </div>
            );
        }

        return <Badge variant="warning">UNPAID</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">
                        {statusFilter === 'PAID' ? 'Paid Invoices' :
                            statusFilter === 'NOT_PAID' ? 'Unpaid Invoices (Due Soon)' :
                                statusFilter === 'OVERDUE' ? 'Overdue Invoices' :
                                    <span className="flex items-center gap-2">
                                        All Invoices
                                        {stats?.total ? (
                                            <span className="text-2xl font-light text-muted-foreground">
                                                (${stats.total.toLocaleString()})
                                            </span>
                                        ) : null}
                                    </span>}
                    </h2>
                    <p className="text-muted-foreground">
                        Manage billing, payments, and financial tracking.
                    </p>
                </div>
                <div className="flex w-full sm:w-auto gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="flex-1 sm:w-auto">
                                <FileOutput className="mr-2 h-4 w-4" /> Export Data
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExportAll('csv')}>
                                <FileText className="mr-2 h-4 w-4" /> Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExportAll('excel')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExportAll('pdf')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-amber-500 shadow-sm bg-card/50 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Unpaid Invoices (Due Soon)</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-2xl font-bold font-mono">${stats?.outstanding?.toLocaleString() || '0'}</h3>
                                    <span className="text-xs font-semibold text-amber-500/80">
                                        {stats?.outstandingCount || 0} Invoices
                                    </span>
                                </div>
                            </div>
                            <div className="bg-amber-500/10 p-2 rounded-lg">
                                <Clock className="h-6 w-6 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-green-500 shadow-sm bg-card/50 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paid Invoices</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-2xl font-bold font-mono">${stats?.paid?.toLocaleString() || '0'}</h3>
                                    <span className="text-xs font-semibold text-green-500/80">
                                        {stats?.paidCount || 0} Invoices
                                    </span>
                                </div>
                            </div>
                            <div className="bg-green-500/10 p-2 rounded-lg">
                                <CheckCircle2 className="h-6 w-6 text-green-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-destructive shadow-sm bg-card/50 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overdue Amount</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <h3 className="text-2xl font-bold font-mono">${stats?.overdue?.toLocaleString() || '0'}</h3>
                                    <span className="text-xs font-semibold text-destructive/80">
                                        {stats?.overdueCount || 0} Invoices
                                    </span>
                                </div>
                            </div>
                            <div className="bg-destructive/10 p-2 rounded-lg">
                                <AlertCircle className="h-6 w-6 text-destructive" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by Invoice #..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Clients</SelectItem>
                        <SelectItem value="ONEWORLD">OneWorld</SelectItem>
                        <SelectItem value="A.A ASSOCIATES">A.A Associates</SelectItem>
                        <SelectItem value="SAFEMARK">SafeMark</SelectItem>
                        <SelectItem value="DAP-IP">DAP-IP</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={brandFilter} onValueChange={setBrandFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Brand" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Brands</SelectItem>
                        {BRAND_OPTIONS.map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={caseTypeFilter} onValueChange={setCaseTypeFilter}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Case Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Customs">Customs</SelectItem>
                        <SelectItem value="Market">Market</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                    <Input
                        type="date"
                        className="w-[140px]"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                        type="date"
                        className="w-[140px]"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>

                {(searchTerm || clientFilter !== 'all' || brandFilter !== 'all' || caseTypeFilter !== 'all' || startDate || endDate) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        className="h-10 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                )}
            </div>

            <div className="rounded-xl border bg-card shadow-md overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="font-bold cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('invoice_number')}>
                                Invoice # {getSortIcon('invoice_number')}
                            </TableHead>
                            <TableHead className="font-bold">Case Info</TableHead>
                            <TableHead className="font-bold">Province</TableHead>
                            <TableHead className="font-bold">Amount</TableHead>
                            <TableHead className="font-bold cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
                                Due Date {getSortIcon('date')}
                            </TableHead>
                            <TableHead className="font-bold">Status</TableHead>
                            <TableHead className="w-[80px] text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center">
                                    <div className="flex items-center justify-center">
                                        <RotateCcw className="h-6 w-6 animate-spin text-primary mr-2" />
                                        <span>Loading invoices...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : sortedInvoices && sortedInvoices.length > 0 ? (
                            sortedInvoices.map((inv: any) => (
                                <TableRow key={inv.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold text-primary whitespace-nowrap">
                                        <span
                                            className="cursor-pointer hover:underline"
                                            onClick={() => navigate(`/cases/${inv.case_id}`)}
                                        >
                                            {inv.invoice_number}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{inv.cases?.target_name}</span>
                                            <span className="text-xs text-muted-foreground">{inv.cases?.case_id} • {inv.cases?.brand_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-normal">{inv.cases?.province}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-base font-bold text-foreground">${inv.amount_usd?.toLocaleString()}</span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm">
                                                {format(new Date(inv.due_date + "T00:00:00"), 'MMM dd, yyyy')}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-tight">
                                                Issued: {format(new Date(inv.issue_date + "T00:00:00"), 'MMM dd, yyyy')}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(inv)}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="rounded-full">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Invoice Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => navigate(`/cases/${inv.case_id}`)}>
                                                    <Eye className="mr-2 h-4 w-4" /> View Case Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                    setSelectedInvoice(inv);
                                                    setIsStatusModalOpen(true);
                                                }}>
                                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Update Status
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <Download className="mr-2 h-4 w-4" /> Export Report
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    No invoices found matching your criteria.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2 py-2">
                <div className="text-sm font-medium text-muted-foreground">
                    {showAll
                        ? <>Showing all <span className="text-foreground font-bold">{invoices?.count || 0}</span> invoices</>
                        : <>Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span> to <span className="text-foreground">{Math.min(page * pageSize, invoices?.count || 0)}</span> of <span className="text-foreground font-bold">{invoices?.count || 0}</span> invoices</>
                    }
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || showAll}
                        className="hover:bg-muted"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button
                        variant={showAll ? "default" : "ghost"}
                        size="sm"
                        onClick={() => { setShowAll(!showAll); setPage(1); }}
                        className={showAll ? "" : "hover:bg-muted"}
                    >
                        All
                    </Button>
                    {!showAll && (
                        <div className="text-sm font-bold bg-muted px-3 py-1 rounded-md">
                            {page}
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!invoices?.count || page * pageSize >= invoices.count || showAll}
                        className="hover:bg-muted"
                    >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>

            {selectedInvoice && (
                <UpdateInvoiceStatusModal
                    invoiceId={selectedInvoice.id}
                    isOpen={isStatusModalOpen}
                    onClose={() => setIsStatusModalOpen(false)}
                    onSuccess={() => {
                        refetch();
                        // Also show a toast here for safety
                    }}
                    currentStatus={selectedInvoice.status}
                    currentStatusDate={selectedInvoice.status_date}
                />
            )}
        </div>
    );
};

export default InvoiceList;

