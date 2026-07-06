import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import {
    Search, ChevronLeft, ChevronRight, FileOutput, FileText, FileDown, RotateCcw, ArrowLeft,
} from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import { normalizeClientName } from '@/lib/paymentTerms';
import {
    classifyDueDate, DUE_DATE_ROW_CLASSES, fmtDate, daysFromToday, fmtDaysToDue, buildExportRows,
} from '@/lib/reportUtils';
import {
    ColumnSelector, DraggableHeader,
    type ColumnDef,
} from '@/components/reports/ColumnSelector';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReportType = 'upload' | 'decision' | 'in-depth' | 'enforcement' | 'final-report' | 'invoices' | 'destruction';

interface ReportConfig {
    title: string;
    description: string;
    columnDefs: ColumnDef[];
    storageKey: string;
    /** Which date field to use for row coloring (overdue highlighting) */
    dueDateField?: string;
}

import { DEFAULT_BRANDS as BRAND_OPTIONS } from '@/lib/brands';

// ─── Column definitions per report type ──────────────────────────────────────

const BASE_COLS: ColumnDef[] = [
    { key: 'matter_code', label: 'Matter Code' },
    { key: 'target_name', label: 'Target Name' },
    { key: 'brand_name', label: 'Brand' },
    { key: 'client', label: 'Client' },
    { key: 'case_type', label: 'Case Type' },
    { key: 'province', label: 'Province' },
    { key: 'city', label: 'City' },
    { key: 'case_status', label: 'Case Status' },
];

function getReportConfig(reportType: ReportType): ReportConfig {
    switch (reportType) {
        case 'upload':
            return {
                title: 'Pending Upload to Client',
                description: 'Cases created but not yet uploaded/reported to client.',
                storageKey: 'pending-upload-cols',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_by', label: 'Reported By' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                ],
            };
        case 'decision':
            return {
                title: 'Waiting for Client Decision',
                description: 'Cases uploaded but neither approved nor rejected by the client yet.',
                storageKey: 'pending-decision-cols',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'our_fee_usd', label: 'Our Fee (USD)' },
                    { key: 'decision_status', label: 'Decision Status' },
                ],
            };
        case 'in-depth':
            return {
                title: 'Pending In-Depth Investigation',
                description: 'Approved cases where in-depth investigation has not been completed.',
                storageKey: 'pending-indepth-cols',
                dueDateField: 'indepth_due_date',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_due_date', label: 'In-Depth Due Date' },
                ],
            };
        case 'enforcement':
            return {
                title: 'Pending Enforcement',
                description: 'In-depth completed, enforcement action has not been started or completed.',
                storageKey: 'pending-enforcement-cols',
                dueDateField: 'enf_due_date',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enf_status', label: 'Enforcement Status' },
                    { key: 'enf_due_date', label: 'Enforcement Due Date' },
                ],
            };
        case 'final-report':
            return {
                title: 'Pending Final Report to Client',
                description: 'Enforcement completed, final report has not been sent to the client.',
                storageKey: 'pending-finalreport-cols',
                dueDateField: 'final_report_due_date',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enf_status', label: 'Enforcement Status' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_status', label: 'Final Report Status' },
                    { key: 'final_report_due_date', label: 'Final Report Due Date' },
                ],
            };
        case 'invoices':
            return {
                title: 'Pending Invoices to Client',
                description: 'Final report sent, invoice has not yet been issued to the client.',
                storageKey: 'pending-invoices-cols',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_date', label: 'Final Report Submission Date' },
                    { key: 'inv_number', label: 'Invoice Number' },
                    { key: 'inv_status', label: 'Invoice Status' },
                    { key: 'inv_amount_usd', label: 'Invoice Amount (USD)' },
                    { key: 'inv_due_date', label: 'Invoice Due Date' },
                ],
            };
        case 'destruction':
            return {
                title: 'Pending Destruction',
                description: 'Enforcement completed, destruction of counterfeit goods has not been completed.',
                storageKey: 'pending-destruction-cols',
                dueDateField: 'dest_due_date',
                columnDefs: [
                                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_date', label: 'Final Report Submission Date' },
                    { key: 'inv_status', label: 'Invoice Status' },
                    { key: 'dest_status', label: 'Destruction Status' },
                    { key: 'dest_due_date', label: 'Destruction Due Date' },
                ],
            };
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getFirst = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);

function getClientName(c: any): string {
    const upload = getFirst(c.case_uploads);
    if (upload?.client) return normalizeClientName(upload.client);
    if (c.matter_code) {
        const match = c.matter_code.match(/\/([A-Z]{2})-/);
        if (match) {
            const code = match[1];
            if (code === 'OW') return 'OneWorld';
            if (code === 'SM') return 'SafeMark';
            if (code === 'AA') return 'A.A Associates';
            if (code === 'A.A ASSOCIATES') return 'A.A Associates';
            if (code === 'DI') return 'DAP-IP';
        }
    }
    return 'N/A';
}

// ─── Flatten case data into row objects per report type ───────────────────────

function flattenRow(c: any, reportType: ReportType): Record<string, any> | null {
    const upload = getFirst(c.case_uploads);
    const inDepth = getFirst(c.in_depth_stages);
    const enforcement = getFirst(c.enforcement_stages);
    const finalReport = getFirst(c.final_reports);
    const invoice = getFirst(c.invoices);
    const destruction = getFirst(c.destruction_stages);

    const base: Record<string, any> = {
        id: c.id,
        case_id: c.case_id,
        matter_code: c.matter_code || '-',
        target_name: c.target_name,
        brand_name: c.brand_name,
        client: getClientName(c),
        case_type: c.case_type || '-',
        case_status: c.case_status,
        province: c.province || '-',
        city: c.city || '-',
    };

    switch (reportType) {
        case 'upload':
            if (c.case_status !== 'IN_HAND') return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_by: c.case_reported_by || '-',
                case_reported_date: c.case_reported_date,
            };

        case 'decision':
            if (c.case_status !== 'UPLOADED') return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                our_fee_usd: upload?.our_fee_usd ?? '-',
                decision_status: upload?.decision_status || 'Pending',
            };

        case 'in-depth':
            if (
                !(c.case_status === 'APPROVED' || c.case_status === 'IN_DEPTH') ||
                (inDepth && inDepth.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth?.status || 'Pending',
                indepth_due_date: inDepth?.due_date || null,
            };

        case 'enforcement': {
            // A case is pending enforcement once it has reached the enforcement
            // phase and it isn't done. Customs cases skip In-Depth, so gating on
            // In-Depth DONE wrongly excluded them — key off the enforcement stage
            // (which exists for both Market and Customs) instead, plus the brief
            // window where a Market case's In-Depth is done but enforcement isn't
            // created yet.
            const inEnforcementPhase =
                (enforcement && enforcement.status !== 'DONE') ||
                (inDepth?.status === 'DONE' && !enforcement);
            if (!inEnforcementPhase) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth?.status || '-',
                indepth_done_date: inDepth?.status_date || null,
                enf_status: enforcement?.status || 'Pending',
                enf_due_date: enforcement?.due_date || null,
            };
        }

        case 'final-report':
            if (
                !enforcement || enforcement.status !== 'DONE' ||
                (finalReport && finalReport.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth?.status || '-',
                indepth_done_date: inDepth?.status_date || null,
                enf_status: enforcement.status || '-',
                enforcement_done_date: enforcement.status_date || null,
                final_report_status: finalReport?.status || 'Pending',
                final_report_due_date: finalReport?.due_date || null,
            };

        case 'invoices':
            if (
                !finalReport || finalReport.status !== 'DONE' ||
                invoice
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_done_date: inDepth?.status_date || null,
                enforcement_done_date: enforcement?.status_date || null,
                final_report_date: finalReport.submission_date || null,
                inv_number: invoice?.invoice_number || '-',
                inv_status: invoice?.status || 'Pending',
                inv_amount_usd: invoice?.amount_usd ?? '-',
                inv_due_date: invoice?.due_date || null,
            };

        case 'destruction':
            if (
                !enforcement || enforcement.status !== 'DONE' ||
                (destruction && destruction.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_date: upload?.decision_date || null,
                indepth_done_date: inDepth?.status_date || null,
                enforcement_done_date: enforcement.status_date || null,
                final_report_date: finalReport?.submission_date || null,
                inv_status: invoice?.status || '-',
                dest_status: destruction?.status || 'Pending',
                dest_due_date: destruction?.due_date || null,
            };
    }
}

// ─── Cell renderer ───────────────────────────────────────────────────────────

function renderCell(row: Record<string, any>, col: ColumnDef, navigate: (path: string) => void): React.ReactNode {
    const val = row[col.key];

    if (col.key === 'case_id') {
        return (
            <span
                className="font-medium cursor-pointer hover:underline text-primary"
                onClick={() => navigate(`/cases/${row.id}`)}
            >
                {val}
            </span>
        );
    }

    if (col.key === 'matter_code') {
        return (
            <span
                className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                onClick={() => navigate(`/cases/${row.id}`)}
            >
                {val}
            </span>
        );
    }

    if (col.key === 'case_status') {
        return <StatusBadge status={val} />;
    }

    // Date fields
    if (['case_reported_date', 'upload_date', 'decision_date', 'due_date', 'indepth_due_date', 'indepth_done_date', 'enf_due_date', 'enforcement_done_date', 'final_report_date', 'final_report_due_date', 'inv_due_date', 'dest_due_date'].includes(col.key)) {
        return val ? fmtDate(val) : '-';
    }

    // Days fields
    if (['days_pending', 'days_waiting'].includes(col.key)) {
        return val != null ? `${val}d` : '-';
    }

    // Currency
    if (col.key === 'our_fee_usd' || col.key === 'inv_amount_usd') {
        return val != null && val !== '-' ? `$${Number(val).toLocaleString()}` : '-';
    }

    return val ?? '-';
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PendingWorkReport = ({ reportType }: { reportType: ReportType }) => {
    const navigate = useNavigate();
    const config = getReportConfig(reportType);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [clientFilter, setClientFilter] = useState<string>('all');
    const [brandFilter, setBrandFilter] = useState<string>('all');
    const [caseTypeFilter, setCaseTypeFilter] = useState<string>('all');
    const [provinceFilter, setProvinceFilter] = useState<string>('all');
    const [cityFilter, setCityFilter] = useState<string>('all');

    // Pagination
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const pageSize = 10;

    // Column selector — driven by ColumnSelector's onChange callback
    const [visibleCols, setVisibleCols] = useState<ColumnDef[]>(config.columnDefs);
    const [allColumns, setAllColumns] = useState<ColumnDef[]>(config.columnDefs);
    const [reorderFn, setReorderFn] = useState<((from: number, to: number) => void) | null>(null);

    // Fetch all cases with related data
    const { data: rawCases, isLoading } = useQuery({
        queryKey: ['pending-work-report', reportType],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    *,
                    case_uploads(*),
                    in_depth_stages(*),
                    enforcement_stages(*),
                    final_reports(*),
                    invoices(*),
                    destruction_stages(*)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });

    // Derive city options from raw data
    const cityOptions = useMemo(() => {
        if (!rawCases) return [];
        return Array.from(new Set(
            rawCases.map((c: any) => c.city).filter((c: any) => c && c.trim())
        )).sort() as string[];
    }, [rawCases]);

    // Flatten + filter
    const filteredRows = useMemo(() => {
        if (!rawCases) return [];

        let rows = rawCases
            .map((c: any) => flattenRow(c, reportType))
            .filter(Boolean) as Record<string, any>[];

        // Apply filters
        if (clientFilter !== 'all') {
            rows = rows.filter(r => {
                const raw = getFirst(rawCases.find((c: any) => c.id === r.id)?.case_uploads);
                return raw?.client === clientFilter;
            });
        }

        if (brandFilter !== 'all') {
            rows = rows.filter(r => r.brand_name === brandFilter);
        }

        if (caseTypeFilter !== 'all') {
            const isCustomsFilter = caseTypeFilter === 'Customs' || caseTypeFilter === 'Custom';
            rows = rows.filter(r =>
                isCustomsFilter
                    ? (r.case_type === 'Customs' || r.case_type === 'Custom')
                    : r.case_type === caseTypeFilter
            );
        }

        if (provinceFilter !== 'all') {
            rows = rows.filter(r => r.province === provinceFilter);
        }

        if (cityFilter !== 'all') {
            rows = rows.filter(r => r.city === cityFilter);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            rows = rows.filter(r =>
                r.case_id?.toLowerCase().includes(term) ||
                r.target_name?.toLowerCase().includes(term) ||
                r.brand_name?.toLowerCase().includes(term)
            );
        }

        return rows;
    }, [rawCases, reportType, clientFilter, brandFilter, caseTypeFilter, provinceFilter, cityFilter, searchTerm]);

    const totalCount = filteredRows.length;
    const displayedRows = showAll ? filteredRows : filteredRows.slice((page - 1) * pageSize, page * pageSize);

    // Export handler
    const handleExport = (fmt: 'csv' | 'excel' | 'pdf') => {
        if (filteredRows.length === 0) {
            toast.error('No data to export');
            return;
        }

        // Build export rows with formatted values
        const DATE_KEYS = ['case_reported_date', 'upload_date', 'decision_date', 'due_date', 'indepth_due_date', 'indepth_done_date', 'enf_due_date', 'enforcement_done_date', 'final_report_date', 'final_report_due_date', 'inv_due_date', 'dest_due_date'];
        const CURRENCY_KEYS = ['our_fee_usd', 'inv_amount_usd'];
        const DAYS_KEYS = ['days_pending', 'days_waiting'];

        const exportRows = filteredRows.map(row => {
            const out: Record<string, any> = {};
            for (const col of visibleCols) {
                let val = row[col.key];
                if (DATE_KEYS.includes(col.key)) {
                    val = val ? fmtDate(val) : '';
                } else if (CURRENCY_KEYS.includes(col.key)) {
                    val = val != null && val !== '-' ? `$${Number(val).toLocaleString()}` : '';
                } else if (DAYS_KEYS.includes(col.key)) {
                    val = val != null ? `${val}d` : '';
                }
                out[col.label] = val ?? '';
            }
            return out;
        });

        const fileName = `${config.title.replace(/ /g, '-')}-${new Date().toISOString().split('T')[0]}`;

        if (fmt === 'csv') {
            exportToCSV(exportRows, fileName);
        } else if (fmt === 'excel') {
            exportToExcel(exportRows, fileName);
        } else if (fmt === 'pdf') {
            exportToPDF(
                exportRows,
                visibleCols.map(c => c.label),
                fileName,
                config.title
            );
        }
        toast.success(`Exported ${filteredRows.length} rows to ${fmt.toUpperCase()}`);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1"
                        onClick={() => navigate('/pending-work')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{config.title}</h2>
                        <p className="text-muted-foreground">{config.description}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <ColumnSelector
                        defs={config.columnDefs}
                        storageKey={config.storageKey}
                        onChange={(cols) => setVisibleCols(cols)}
                        onReorder={(fn) => setReorderFn(() => fn)}
                        onColumnsChange={(cols) => setAllColumns(cols)}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <FileOutput className="mr-2 h-4 w-4" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('csv')}>
                                <FileText className="mr-2 h-4 w-4" /> Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('excel')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => handleExport('pdf')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search cases..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                    />
                </div>

                <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setPage(1);}}>
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

                <Select value={brandFilter} onValueChange={(v) => { setBrandFilter(v); setPage(1);}}>
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

                <Select value={caseTypeFilter} onValueChange={(v) => { setCaseTypeFilter(v); setPage(1);}}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Case Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Customs">Customs</SelectItem>
                        <SelectItem value="Market">Market</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={provinceFilter} onValueChange={(v) => { setProvinceFilter(v); setPage(1);}}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Province" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Provinces</SelectItem>
                        <SelectItem value="Punjab">Punjab</SelectItem>
                        <SelectItem value="Sindh">Sindh</SelectItem>
                        <SelectItem value="KPK">KPK</SelectItem>
                        <SelectItem value="Balochistan">Balochistan</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={cityFilter} onValueChange={(v) => { setCityFilter(v); setPage(1);}}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="City" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Cities</SelectItem>
                        {cityOptions.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(searchTerm || clientFilter !== 'all' || brandFilter !== 'all' || caseTypeFilter !== 'all' || provinceFilter !== 'all' || cityFilter !== 'all') && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearchTerm('');
                            setClientFilter('all');
                            setBrandFilter('all');
                            setCaseTypeFilter('all');
                            setProvinceFilter('all');
                            setCityFilter('all');
                            setPage(1);
                        }}
                        className="h-10 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                )}
            </div>

            {/* Count badge */}
            <div className="text-sm text-muted-foreground">
                {totalCount} pending {totalCount === 1 ? 'case' : 'cases'}
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <DraggableHeader
                                cols={visibleCols}
                                allColumns={allColumns}
                                onReorder={reorderFn || (() => { })}
                            />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {visibleCols.map((col) => (
                                        <TableCell key={col.key}>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : displayedRows.length > 0 ? (
                            displayedRows.map((row) => {
                                const dueDateVal = config.dueDateField ? row[config.dueDateField] : null;
                                const dueDateClass = classifyDueDate(dueDateVal);
                                const rowClasses = DUE_DATE_ROW_CLASSES[dueDateClass];

                                return (
                                    <TableRow key={row.id} className={rowClasses}>
                                        {visibleCols.map((col) => (
                                            <TableCell key={col.key} className="text-xs whitespace-nowrap">
                                                {renderCell(row, col, navigate)}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={visibleCols.length} className="h-24 text-center">
                                    No pending cases found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                    {showAll
                        ? `Showing all ${totalCount} cases`
                        : `Showing ${totalCount === 0 ? 0 : (page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} cases`
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
                        disabled={page * pageSize >= totalCount || showAll}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PendingWorkReport;
