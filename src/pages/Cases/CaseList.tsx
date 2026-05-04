const toLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { escapeLikePattern, sanitizeErrorMessage } from '@/lib/security';
import { invalidateCaseRelated } from '@/lib/cacheInvalidation';
import { Case, CaseStatus } from '@/types/database';
import { usePermissions } from '@/hooks/usePermissions';
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
    Plus,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    UserPlus,
    FileCheck,
    Download,
    FileText,
    FileOutput,
    FileDown,
    Upload,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import StatusBadge from '@/components/StatusBadge';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { normalizeClientName, getPaymentTermDays } from '@/lib/paymentTerms';
import RecordDecisionModal from '@/components/forms/RecordDecisionModal';
import ChangeReporterModal from '@/components/forms/ChangeReporterModal';
import ImportCasesModal from '@/components/forms/ImportCasesModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { X, RotateCcw, Trash2 } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

const BRAND_OPTIONS = [
    "American Eagle", "BMW", "Biscoff Creamy", "Burberry", "Cavin Klein",
    "Champion", "Gucci", "Guess", "Harley davidson", "Hugo Boss",
    "Levis", "Mars", "New Balance", "Nike", "Nutella",
    "Porsche", "Puma", "Reebok", "Tommy Hilfiger", "Toyota",
    "US polo", "WD-40"
];

const CaseList = ({ status }: { status?: CaseStatus }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { can, isAdmin } = usePermissions();
    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState<string>('all');
    const [brandFilter, setBrandFilter] = useState<string>('all');
    const [caseTypeFilter, setCaseTypeFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const pageSize = 10;
    const [isDeleting, setIsDeleting] = useState(false);
    const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Quick Actions State
    const [selectedCase, setSelectedCase] = useState<Case | null>(null);
    const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<'matter_code' | 'date' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const handleSort = (column: 'matter_code' | 'date') => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (column: 'matter_code' | 'date') => {
        if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />;
        return sortDirection === 'asc'
            ? <ArrowUp className="ml-1 h-3 w-3 inline text-blue-400" />
            : <ArrowDown className="ml-1 h-3 w-3 inline text-blue-400" />;
    };

    const { data: cases, isLoading, error, refetch } = useQuery({
        queryKey: ['cases', searchTerm, page, showAll, status, clientFilter, brandFilter, caseTypeFilter, startDate, endDate],
        queryFn: async () => {
            const baseJoins = ', in_depth_stages(*), enforcement_stages(*), final_reports(*), invoices(*), destruction_stages(*)';
            const selectStr = clientFilter !== 'all'
                ? '*, case_uploads!inner(*)' + baseJoins
                : '*, case_uploads(*)' + baseJoins;
            let query = supabase
                .from('cases')
                .select(selectStr, { count: 'exact' });

            if (status) {
                if (status === 'UPLOADED') {
                    // Show all cases that have been uploaded (includes all statuses except IN_HAND)
                    query = query.in('case_status', ['UPLOADED', 'REJECTED', 'APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED']);
                } else if (status === 'AWAITING_DECISION') {
                    // Show UPLOADED cases that have no APPROVED/REJECTED decision yet
                    query = query.eq('case_status', 'UPLOADED');
                } else if (status === 'APPROVED') {
                    // Show all cases that have been approved or reached later stages
                    query = query.in('case_status', ['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED']);
                } else {
                    query = query.eq('case_status', status);
                }
            }

            if (clientFilter !== 'all') {
                query = query.eq('case_uploads.client', clientFilter);
            }

            if (brandFilter !== 'all') {
                query = query.eq('brand_name', brandFilter);
            }

            if (caseTypeFilter !== 'all') {
                query = query.eq('case_type', caseTypeFilter);
            }

            if (startDate) {
                query = query.gte('case_reported_date', startDate);
            }

            if (endDate) {
                query = query.lte('case_reported_date', endDate);
            }

            if (searchTerm) {
                const escaped = escapeLikePattern(searchTerm);
                query = query.or(`case_id.ilike.%${escaped}%,target_name.ilike.%${escaped}%,brand_name.ilike.%${escaped}%`);
            }

            query = query.order('created_at', { ascending: false });

            if (!showAll) {
                query = query.range((page - 1) * pageSize, page * pageSize - 1);
            }

            const { data, count, error } = await query;

            if (error) throw error;
            return { data, count };
        },
    });

    const sortedData = React.useMemo(() => {
        if (!cases?.data || !sortColumn) return cases?.data;
        const sorted = [...cases.data].sort((a: any, b: any) => {
            if (sortColumn === 'matter_code') {
                const valA = (a.matter_code || '').toLowerCase();
                const valB = (b.matter_code || '').toLowerCase();
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (sortColumn === 'date') {
                const dateA = new Date(a.case_reported_date || 0).getTime();
                const dateB = new Date(b.case_reported_date || 0).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
        return sorted;
    }, [cases?.data, sortColumn, sortDirection]);

    const handleDelete = async () => {
        if (!caseToDelete) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('cases')
                .delete()
                .eq('id', caseToDelete);

            if (error) throw error;

            toast.success('Case deleted successfully');
            refetch();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error deleting case'));
        } finally {
            setIsDeleting(false);
            setCaseToDelete(null);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleQuickApprove = async (caseId: string) => {
        try {
            const today = new Date();
            const dateStr = format(today, 'yyyy-MM-dd');

            const { error } = await supabase
                .from('case_uploads')
                .update({
                    decision_status: 'APPROVED',
                    decision_date: dateStr,
                })
                .eq('case_id', caseId);

            if (error) throw error;

            // Automatically set a 7-day target date for the in_depth stage
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + 7);
            const formattedTargetDate = format(targetDate, 'yyyy-MM-dd');

            await supabase
                .from('in_depth_stages')
                .upsert([{
                    case_id: caseId,
                    due_date: formattedTargetDate,
                    status: 'IN_PROGRESS',
                    updated_at: new Date().toISOString()
                }], { onConflict: 'case_id' });

            toast.success('Case approved quickly!');
            refetch();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error approving case'));
        }
    };

    const getClientFromData = (c: any) => {
        // 1. Try direct join data
        const upload = Array.isArray(c.case_uploads) ? c.case_uploads[0] : c.case_uploads;
        if (upload?.client) return upload.client;

        // 2. Fallback: Parse Matter Code (e.g., BRN.CAT.001/OW-26)
        if (c.matter_code) {
            const match = c.matter_code.match(/\/([A-Z]{2})-/);
            if (match) {
                const code = match[1];
                if (code === 'OW') return 'ONEWORLD';
                if (code === 'SM') return 'SAFEMARK';
                if (code === 'AA') return 'A.A ASSOCIATES';
            }
        }
        return 'N/A';
    };

    const handleGenerateReport = async (caseId: string) => {
        const loadingToast = toast.loading('Fetching case details for report...');
        try {
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    *,
                    case_uploads (*),
                    in_depth_stages (*),
                    enforcement_stages (*),
                    final_reports (*),
                    invoices (*)
                `)
                .eq('id', caseId)
                .single();

            if (error) throw error;

            toast.dismiss(loadingToast);

            // Format data for PDF
            const reportData = [{
                Field: 'Matter Code',
                Value: data.matter_code || 'N/A'
            }, {
                Field: 'Target Name',
                Value: data.target_name
            }, {
                Field: 'Brand',
                Value: data.brand_name
            }, {
                Field: 'Province',
                Value: data.province
            }, {
                Field: 'Case Status',
                Value: data.case_status
            }, {
                Field: 'Reported Date',
                Value: format(toLocalDate(data.case_reported_date), 'PPP')
            }, {
                Field: 'Client',
                Value: getClientFromData(data)
            }];

            const upload = Array.isArray(data.case_uploads) ? data.case_uploads[0] : data.case_uploads;
            if (upload) {
                if (upload.upload_date) reportData.push({ Field: 'Upload Date', Value: format(new Date(upload.upload_date), 'PPP') });
                if (upload.our_fee_usd) reportData.push({ Field: 'Fee (USD)', Value: `$${upload.our_fee_usd}` });
            }

            exportToPDF(
                reportData,
                ['Field', 'Value'],
                `Case-Report-${data.case_id}`,
                `Operational Case Report: ${data.case_id}`
            );

            toast.success('Report generated successfully');
        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(sanitizeErrorMessage(error, 'Error generating report'));
        }
    };

    const handleExportAll = async (fmt: 'csv' | 'excel' | 'pdf') => {
        const getRel = (rel: any) => {
            if (!rel) return null;
            return Array.isArray(rel) ? rel[0] : rel;
        };

        const formatDate = (dateStr?: string | null) => {
            if (!dateStr) return '';
            try {
                const clean = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
                return format(new Date(clean), 'yyyy-MM-dd');
            } catch { return dateStr; }
        };

        // Fetch ALL cases (not just current page) for export
        const loadingToast = toast.loading('Fetching all cases for export...');
        try {
            const baseJoins = ', in_depth_stages(*), enforcement_stages(*), final_reports(*), invoices(*), destruction_stages(*)';
            const selectStr = clientFilter !== 'all'
                ? '*, case_uploads!inner(*)' + baseJoins
                : '*, case_uploads(*)' + baseJoins;
            let query = supabase
                .from('cases')
                .select(selectStr);

            if (status) {
                if (status === 'UPLOADED') {
                    query = query.in('case_status', ['UPLOADED', 'REJECTED', 'APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED']);
                } else if (status === 'APPROVED') {
                    query = query.in('case_status', ['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED']);
                } else {
                    query = query.eq('case_status', status);
                }
            }

            if (clientFilter !== 'all') {
                query = query.eq('case_uploads.client', clientFilter);
            }
            if (brandFilter !== 'all') {
                query = query.eq('brand_name', brandFilter);
            }
            if (caseTypeFilter !== 'all') {
                query = query.eq('case_type', caseTypeFilter);
            }
            if (startDate) {
                query = query.gte('case_reported_date', startDate);
            }
            if (endDate) {
                query = query.lte('case_reported_date', endDate);
            }
            if (searchTerm) {
                const escaped = escapeLikePattern(searchTerm);
                query = query.or(`case_id.ilike.%${escaped}%,target_name.ilike.%${escaped}%,brand_name.ilike.%${escaped}%`);
            }

            const { data: allCases, error: fetchError } = await query
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            if (!allCases || allCases.length === 0) {
                toast.dismiss(loadingToast);
                toast.error('No cases to export');
                return;
            }

            const exportData = allCases.map((c: any) => {
                const upload = getRel(c.case_uploads);
                const inDepth = getRel(c.in_depth_stages);
                const enforcement = getRel(c.enforcement_stages);
                const finalReport = getRel(c.final_reports);
                const invoice = getRel(c.invoices);
                const destruction = getRel(c.destruction_stages);
                const clientName = normalizeClientName(getClientFromData(c));

                // Calculate invoice due date from final report + payment terms
                let invoiceDueDate = '';
                if (invoice?.due_date) {
                    invoiceDueDate = formatDate(invoice.due_date);
                } else if (finalReport?.submission_date) {
                    const days = getPaymentTermDays(upload?.client);
                    const calcDate = addDays(new Date(finalReport.submission_date + 'T00:00:00'), days);
                    invoiceDueDate = format(calcDate, 'yyyy-MM-dd');
                }

                return {
                    'Case Type': c.case_type || '',
                    'Matter Code': c.matter_code || '',
                    'Target Name': c.target_name,
                    'Target Category': c.target_category || '',
                    'Brand': c.brand_name,
                    'Products': c.products_name || '',
                    'Client': clientName,
                    'Province': c.province,
                    'City': c.city || '',
                    'Target Address': c.target_address || '',
                    'Case Status': c.case_status,
                    'Reported Date': formatDate(c.case_reported_date),
                    'Reported By': c.case_reported_by || '',
                    // Upload to Client
                    'Upload Date': formatDate(upload?.upload_date),
                    'Our Fee (USD)': upload?.our_fee_usd ?? '',
                    'Decision Status': upload?.decision_status || '',
                    'Decision Date': formatDate(upload?.decision_date),
                    // In-Depth Stage
                    'In-Depth Due Date': formatDate(inDepth?.due_date),
                    'In-Depth Status': inDepth?.status || '',
                    'In-Depth Completed Date': formatDate(inDepth?.status_date),
                    // Enforcement Stage
                    'Enforcement Due Date': formatDate(enforcement?.due_date),
                    'Enforcement Status': enforcement?.status || '',
                    'Enforcement Completed Date': formatDate(enforcement?.status_date),
                    // Destruction Stage
                    'Destruction Due Date': formatDate(destruction?.due_date),
                    'Destruction Status': destruction?.status || '',
                    'Destruction Completed Date': formatDate(destruction?.status_date),
                    // Final Report
                    'Final Report Date': formatDate(finalReport?.submission_date),
                    // Invoice
                    'Invoice Number': invoice?.invoice_number || '',
                    'Invoice Issue Date': formatDate(invoice?.issue_date),
                    'Invoice Due Date': invoiceDueDate,
                    'Invoice Amount (USD)': invoice?.amount_usd ?? '',
                    'Invoice Status': invoice?.status || '',
                    'Closed Date': formatDate(c.closed_date),
                };
            });

            const fileName = `Cases-Export-${new Date().toISOString().split('T')[0]}`;

            if (fmt === 'csv') {
                exportToCSV(exportData, fileName);
            } else if (fmt === 'excel') {
                exportToExcel(exportData, fileName);
            } else if (fmt === 'pdf') {
                exportToPDF(
                    exportData,
                    ['Case Type', 'Matter Code', 'Target Name', 'Target Category', 'Brand', 'Client', 'Province', 'Case Status', 'Reported Date', 'Upload Date', 'Decision Status', 'In-Depth Status', 'Enforcement Status', 'Final Report Date', 'Invoice Status'],
                    fileName,
                    'Cases Export'
                );
            }
            toast.dismiss(loadingToast);
            toast.success(`Exported ${allCases.length} cases to ${fmt.toUpperCase()}`);
        } catch (err: any) {
            toast.dismiss(loadingToast);
            toast.error(sanitizeErrorMessage(err, 'Export failed'));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {status === 'AWAITING_DECISION' ? 'Awaiting Decision Cases' : status ? `${status.replace('_', ' ')} Cases` : 'All Cases'}
                    </h2>
                    <p className="text-muted-foreground">
                        Manage and track all operational cases.
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
                    {can('cases', 'create') && (
                        <>
                            <Button variant="outline" className="flex-1 sm:w-auto" onClick={() => setIsImportModalOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" /> Import Cases
                            </Button>
                            <Button className="flex-1 sm:w-auto" onClick={() => navigate('/new-case')}>
                                <Plus className="mr-2 h-4 w-4" /> New Case
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search cases..."
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
                        onClick={() => {
                            setSearchTerm('');
                            setClientFilter('all');
                            setBrandFilter('all');
                            setCaseTypeFilter('all');
                            setStartDate('');
                            setEndDate('');
                        }}
                        className="h-10 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-card overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('matter_code')}>
                                Matter Code {getSortIcon('matter_code')}
                            </TableHead>
                            <TableHead>Target Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Case Type</TableHead>
                            <TableHead>Case Status</TableHead>
                            {status !== 'CLOSED' && <TableHead>Decision Status</TableHead>}
                            <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
                                Submitted On {getSortIcon('date')}
                            </TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                    {status !== 'CLOSED' && <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>}
                                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                                </TableRow>
                            ))
                        ) : sortedData && sortedData.length > 0 ? (
                            (sortedData as any[]).map((c: Case) => (
                                <TableRow key={c.id}>
                                    <TableCell
                                        className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                                        onClick={() => navigate(`/cases/${c.id}`)}
                                    >
                                        {c.matter_code || '-'}
                                    </TableCell>
                                    <TableCell>{c.target_name}</TableCell>
                                    <TableCell>{c.brand_name}</TableCell>
                                    <TableCell>
                                        {(() => {
                                            const clientCode = Array.isArray(c.case_uploads)
                                                ? c.case_uploads[0]?.client
                                                : (c.case_uploads as any)?.client;
                                            return clientCode ? normalizeClientName(clientCode) : '-';
                                        })()}
                                    </TableCell>
                                    <TableCell>{c.case_type || '-'}</TableCell>
                                    <TableCell>
                                        <StatusBadge status={c.case_status} />
                                    </TableCell>
                                    {status !== 'CLOSED' && (
                                        <TableCell>
                                            {(() => {
                                                const upload = Array.isArray(c.case_uploads)
                                                    ? c.case_uploads[0]
                                                    : c.case_uploads;
                                                const ds = (upload as any)?.decision_status;
                                                if (ds && ds !== 'WAITING') return <StatusBadge status={ds} />;
                                                if (upload) return <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">Waiting</span>;
                                                return <span className="text-muted-foreground">-</span>;
                                            })()}
                                        </TableCell>
                                    )}
                                    <TableCell>{format(toLocalDate(c.case_reported_date), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                                                    <FileText className="mr-2 h-4 w-4" />
                                                    Edit/View Details
                                                </DropdownMenuItem>
                                                {can('cases', 'edit') && (
                                                    <DropdownMenuItem className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}/edit`)}>
                                                        Edit Case
                                                    </DropdownMenuItem>
                                                )}

                                                {can('cases', 'edit') && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">Quick Actions</DropdownMenuLabel>

                                                        {c.case_status === 'UPLOADED' && (
                                                            <>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer text-green-600"
                                                                    onClick={() => handleQuickApprove(c.id)}
                                                                >
                                                                    <FileCheck className="mr-2 h-4 w-4" />
                                                                    Quick Approve
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    className="cursor-pointer"
                                                                    onClick={() => {
                                                                        setSelectedCase(c);
                                                                        setIsDecisionModalOpen(true);
                                                                    }}
                                                                >
                                                                    <FileText className="mr-2 h-4 w-4" />
                                                                    Record Decision
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}

                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedCase(c);
                                                                setIsAssignModalOpen(true);
                                                            }}
                                                        >
                                                            <UserPlus className="mr-2 h-4 w-4" />
                                                            Assign Reporter
                                                        </DropdownMenuItem>
                                                    </>
                                                )}

                                                <DropdownMenuItem
                                                    className="cursor-pointer"
                                                    onClick={() => handleGenerateReport(c.id)}
                                                >
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Generate Report
                                                </DropdownMenuItem>
                                                {isAdmin && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive cursor-pointer"
                                                            onClick={() => {
                                                                setCaseToDelete(c.id);
                                                                setIsDeleteDialogOpen(true);
                                                            }}
                                                            disabled={isDeleting}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete Case
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={status === 'CLOSED' ? 8 : 9} className="h-24 text-center">
                                    No cases found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    {showAll
                        ? `Showing all ${cases?.count || 0} cases`
                        : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, cases?.count || 0)} of ${cases?.count || 0} cases`
                    }
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || showAll}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={showAll ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setShowAll(!showAll); setPage(1); }}
                    >
                        All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!cases?.count || page * pageSize >= cases.count || showAll}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the case
                            and all associated data from the servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Case"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedCase && (
                <>
                    <RecordDecisionModal
                        caseId={selectedCase.id}
                        isOpen={isDecisionModalOpen}
                        onClose={() => setIsDecisionModalOpen(false)}
                        onSuccess={() => { refetch(); invalidateCaseRelated(queryClient); }}
                    />
                    <ChangeReporterModal
                        caseId={selectedCase.id}
                        currentReporter={selectedCase.case_reported_by}
                        isOpen={isAssignModalOpen}
                        onClose={() => setIsAssignModalOpen(false)}
                        onSuccess={() => { refetch(); invalidateCaseRelated(queryClient); }}
                    />
                </>
            )}

            <ImportCasesModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => { refetch(); invalidateCaseRelated(queryClient); }}
            />
        </div>
    );
};

export default CaseList;
