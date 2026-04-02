import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Settings2,
    FileOutput,
    FileText,
    FileDown,
    Plus,
    X,
    Save,
    FolderOpen,
    Trash2,
    Play,
    ChevronDown,
    Database,
} from 'lucide-react';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/exportUtils';
import {
    buildExportRows,
    fmtDate,
    fmtUSD,
    fmtDaysToDue,
    daysFromToday,
    daysBetween,
    classifyDueDate,
    DUE_DATE_ROW_CLASSES,
    getAgingBucket,
    AGING_BUCKET_LABELS,
} from '@/lib/reportUtils';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { normalizeClientName } from '@/lib/paymentTerms';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Field definitions — all available fields grouped by category
// ---------------------------------------------------------------------------
interface FieldDef {
    key: string;
    label: string;
    group: string;
    type: 'text' | 'date' | 'number' | 'status';
    computed?: boolean;
}

const FIELD_GROUPS: { group: string; fields: FieldDef[] }[] = [
    {
        group: 'Case Identity',
        fields: [
            { key: 'matter_code', label: 'Matter Code', group: 'Case Identity', type: 'text' },
            { key: 'case_status', label: 'Case Status', group: 'Case Identity', type: 'status' },
            { key: 'case_reported_date', label: 'Case Reported Date', group: 'Case Identity', type: 'date' },
            { key: 'case_reported_by', label: 'Case Reported By', group: 'Case Identity', type: 'text' },
            { key: 'upload_date', label: 'Upload Date', group: 'Case Identity', type: 'date' },
            { key: 'closed_date', label: 'Closed Date', group: 'Case Identity', type: 'date' },
        ],
    },
    {
        group: 'Target / Raid Info',
        fields: [
            { key: 'target_name', label: 'Target Name', group: 'Target / Raid Info', type: 'text' },
            { key: 'target_category', label: 'Target Category', group: 'Target / Raid Info', type: 'text' },
            { key: 'target_address', label: 'Target Address', group: 'Target / Raid Info', type: 'text' },
            { key: 'city', label: 'City', group: 'Target / Raid Info', type: 'text' },
            { key: 'province', label: 'Province', group: 'Target / Raid Info', type: 'text' },
        ],
    },
    {
        group: 'Brand & Client',
        fields: [
            { key: 'brand_name', label: 'Brand Name', group: 'Brand & Client', type: 'text' },
            { key: 'client', label: 'Client Name', group: 'Brand & Client', type: 'text' },
            { key: 'products_name', label: 'Product Name', group: 'Brand & Client', type: 'text' },
            { key: 'our_fee_usd', label: 'Our Fee (USD)', group: 'Brand & Client', type: 'number' },
        ],
    },
    {
        group: 'Decision',
        fields: [
            { key: 'decision_status', label: 'Decision Status', group: 'Decision', type: 'status' },
            { key: 'decision_date', label: 'Decision Date', group: 'Decision', type: 'date' },
        ],
    },
    {
        group: 'In-Depth Stage',
        fields: [
            { key: 'indepth_due_date', label: 'In-Depth Due Date', group: 'In-Depth Stage', type: 'date' },
            { key: 'indepth_status', label: 'In-Depth Status', group: 'In-Depth Stage', type: 'status' },
            { key: 'indepth_status_date', label: 'In-Depth Status Date', group: 'In-Depth Stage', type: 'date' },
            { key: 'days_approval_to_indepth', label: 'Days: Approval → In-Depth Done', group: 'In-Depth Stage', type: 'number', computed: true },
        ],
    },
    {
        group: 'Enforcement Stage',
        fields: [
            { key: 'enforcement_due_date', label: 'Enforcement Due Date', group: 'Enforcement Stage', type: 'date' },
            { key: 'enforcement_status', label: 'Enforcement Status', group: 'Enforcement Stage', type: 'status' },
            { key: 'enforcement_status_date', label: 'Enforcement Status Date', group: 'Enforcement Stage', type: 'date' },
            { key: 'days_indepth_to_enforcement', label: 'Days: In-Depth Done → Enforcement Done', group: 'Enforcement Stage', type: 'number', computed: true },
        ],
    },
    {
        group: 'Final Report',
        fields: [
            { key: 'final_report_due_date', label: 'Final Report Due Date', group: 'Final Report', type: 'date' },
            { key: 'final_report_status', label: 'Final Report Status', group: 'Final Report', type: 'status' },
            { key: 'final_report_date', label: 'Final Report Submission Date', group: 'Final Report', type: 'date' },
            { key: 'days_enforcement_to_final', label: 'Days: Enforcement Done → Final Report', group: 'Final Report', type: 'number', computed: true },
        ],
    },
    {
        group: 'Invoice',
        fields: [
            { key: 'invoice_number', label: 'Invoice Number', group: 'Invoice', type: 'text' },
            { key: 'invoice_issue_date', label: 'Invoice Issue Date', group: 'Invoice', type: 'date' },
            { key: 'invoice_due_date', label: 'Invoice Due Date', group: 'Invoice', type: 'date' },
            { key: 'invoice_status', label: 'Invoice Status', group: 'Invoice', type: 'status' },
            { key: 'invoice_status_date', label: 'Invoice Status Date', group: 'Invoice', type: 'date' },
            { key: 'invoice_amount', label: 'Amount (USD)', group: 'Invoice', type: 'number' },
            { key: 'days_to_due', label: 'Days to Due / Days Overdue', group: 'Invoice', type: 'number', computed: true },
            { key: 'aging_bucket', label: 'Aging Bucket', group: 'Invoice', type: 'text', computed: true },
        ],
    },
    {
        group: 'Destruction',
        fields: [
            { key: 'destruction_due_date', label: 'Destruction Due Date', group: 'Destruction', type: 'date' },
            { key: 'destruction_status', label: 'Destruction Status', group: 'Destruction', type: 'status' },
            { key: 'destruction_status_date', label: 'Destruction Status Date', group: 'Destruction', type: 'date' },
        ],
    },
    {
        group: 'Calculated / Summary',
        fields: [
            { key: 'days_since_submission', label: 'Days Since Submission', group: 'Calculated / Summary', type: 'number', computed: true },
            { key: 'days_since_upload', label: 'Days Since Upload', group: 'Calculated / Summary', type: 'number', computed: true },
            { key: 'total_pipeline_days', label: 'Total Pipeline Days (Approval → Closed)', group: 'Calculated / Summary', type: 'number', computed: true },
            { key: 'case_age_days', label: 'Case Age in Days', group: 'Calculated / Summary', type: 'number', computed: true },
        ],
    },
];

const ALL_FIELDS: FieldDef[] = FIELD_GROUPS.flatMap(g => g.fields);

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------
interface FilterRow {
    id: string;
    fieldKey: string;
    operator: string;
    value: string;
}

const TEXT_OPS = ['contains', 'equals', 'starts with'];
const DATE_OPS = ['is', 'before', 'after', 'between'];
const NUMBER_OPS = ['=', '>', '<', 'between'];
const STATUS_OPS = ['equals'];

function getOpsForField(field: FieldDef | undefined): string[] {
    if (!field) return TEXT_OPS;
    switch (field.type) {
        case 'date': return DATE_OPS;
        case 'number': return NUMBER_OPS;
        case 'status': return STATUS_OPS;
        default: return TEXT_OPS;
    }
}

// ---------------------------------------------------------------------------
// Saved report type
// ---------------------------------------------------------------------------
interface SavedReport {
    id: string;
    name: string;
    selectedFields: string[];
    filters: FilterRow[];
    sortField: string;
    sortDir: 'asc' | 'desc';
    groupField: string;
    savedAt: string;
}

const SAVED_REPORTS_KEY = 'custom-report-saved';

function loadSavedReports(): SavedReport[] {
    try {
        return JSON.parse(localStorage.getItem(SAVED_REPORTS_KEY) || '[]');
    } catch { return []; }
}

function saveSavedReports(reports: SavedReport[]) {
    try { localStorage.setItem(SAVED_REPORTS_KEY, JSON.stringify(reports)); } catch { /* ignore storage errors */ }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const CustomReport = () => {
    const navigate = useNavigate();
    const [selectedFields, setSelectedFields] = useState<string[]>([]);
    const [filters, setFilters] = useState<FilterRow[]>([]);
    const [sortField, setSortField] = useState<string>('case_reported_date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [groupField, setGroupField] = useState<string>('');
    const [hasRun, setHasRun] = useState(false);
    const [savedReports, setSavedReports] = useState<SavedReport[]>(loadSavedReports);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [fieldPickerOpen, setFieldPickerOpen] = useState(false);

    // Fetch all data — only when user clicks "Run Report"
    const [runTrigger, setRunTrigger] = useState(0);
    const { data: rawData, isLoading } = useQuery({
        queryKey: ['custom-report', runTrigger],
        queryFn: async () => {
            if (runTrigger === 0) return [];
            const { data, error } = await supabase
                .from('cases')
                .select('*, case_uploads(*), in_depth_stages(*), enforcement_stages(*), final_reports(*), invoices(*), destruction_stages(*)');
            if (error) throw error;
            return data || [];
        },
        enabled: runTrigger > 0,
    });

    // Flatten each case into a flat row with all computed fields
    const flattenCase = (c: any): Record<string, any> => {
        const getRel = (r: any) => Array.isArray(r) ? r[0] : r;
        const upload = getRel(c.case_uploads);
        const indepth = getRel(c.in_depth_stages);
        const enforcement = getRel(c.enforcement_stages);
        const finalReport = getRel(c.final_reports);
        const invoice = getRel(c.invoices);
        const destruction = getRel(c.destruction_stages);
        const today = new Date();

        return {
            _case_uuid: c.id,
            case_id: c.case_id,
            matter_code: c.matter_code || '',
            case_status: c.case_status,
            case_reported_date: fmtDate(c.case_reported_date),
            case_reported_by: c.case_reported_by || '',
            upload_date: fmtDate(upload?.upload_date),
            closed_date: fmtDate(c.closed_date),
            target_name: c.target_name,
            target_category: c.target_category || '',
            target_address: c.target_address || '',
            city: c.city || '',
            province: c.province || '',
            brand_name: c.brand_name,
            client: normalizeClientName(upload?.client) || '',
            products_name: c.products_name || '',
            our_fee_usd: upload?.our_fee_usd ? fmtUSD(upload.our_fee_usd) : '',
            decision_status: upload?.decision_status || '',
            decision_date: fmtDate(upload?.decision_date),
            indepth_due_date: fmtDate(indepth?.due_date),
            indepth_status: indepth?.status || '',
            indepth_status_date: fmtDate(indepth?.status_date),
            days_approval_to_indepth: (() => {
                const d = daysBetween(upload?.decision_date, indepth?.status_date);
                return d !== null ? String(d) : '';
            })(),
            enforcement_due_date: fmtDate(enforcement?.due_date),
            enforcement_status: enforcement?.status || '',
            enforcement_status_date: fmtDate(enforcement?.status_date),
            days_indepth_to_enforcement: (() => {
                const d = daysBetween(indepth?.status_date, enforcement?.status_date);
                return d !== null ? String(d) : '';
            })(),
            final_report_due_date: fmtDate(finalReport?.due_date),
            final_report_status: finalReport?.status || '',
            final_report_date: fmtDate(finalReport?.submission_date),
            days_enforcement_to_final: (() => {
                const d = daysBetween(enforcement?.status_date, finalReport?.submission_date);
                return d !== null ? String(d) : '';
            })(),
            invoice_number: invoice?.invoice_number || '',
            invoice_issue_date: fmtDate(invoice?.issue_date),
            invoice_due_date: fmtDate(invoice?.due_date),
            invoice_status: invoice?.status || '',
            invoice_status_date: fmtDate(invoice?.status_date),
            invoice_amount: invoice?.amount_usd ? fmtUSD(invoice.amount_usd) : '',
            days_to_due: (() => {
                if (!invoice?.due_date || invoice?.status === 'PAID') return '';
                const d = daysFromToday(invoice.due_date);
                return d !== null ? fmtDaysToDue(d) : '';
            })(),
            aging_bucket: (() => {
                if (!invoice?.due_date || invoice?.status === 'PAID') return '';
                return AGING_BUCKET_LABELS[getAgingBucket(invoice.due_date)];
            })(),
            destruction_due_date: fmtDate(destruction?.due_date),
            destruction_status: destruction?.status || '',
            destruction_status_date: fmtDate(destruction?.status_date),
            days_since_submission: c.case_reported_date
                ? String(differenceInCalendarDays(today, parseISO(c.case_reported_date)))
                : '',
            days_since_upload: upload?.upload_date
                ? String(differenceInCalendarDays(today, parseISO(upload.upload_date)))
                : '',
            total_pipeline_days: (() => {
                const d = daysBetween(upload?.decision_date, c.closed_date);
                return d !== null ? String(d) : '';
            })(),
            case_age_days: c.case_reported_date
                ? String(differenceInCalendarDays(today, parseISO(c.case_reported_date)))
                : '',
        };
    };

    // Apply filters
    const applyFilters = (rows: Record<string, any>[]): Record<string, any>[] => {
        return rows.filter(row => {
            return filters.every(f => {
                if (!f.fieldKey || !f.value) return true;
                const cellVal = String(row[f.fieldKey] ?? '').toLowerCase();
                const fval = f.value.toLowerCase();
                switch (f.operator) {
                    case 'contains': return cellVal.includes(fval);
                    case 'equals': case 'is': case '=': return cellVal === fval;
                    case 'starts with': return cellVal.startsWith(fval);
                    case 'before': return cellVal < fval;
                    case 'after': return cellVal > fval;
                    case '>': return parseFloat(cellVal) > parseFloat(fval);
                    case '<': return parseFloat(cellVal) < parseFloat(fval);
                    default: return true;
                }
            });
        });
    };

    // Apply sort
    const applySort = (rows: Record<string, any>[]): Record<string, any>[] => {
        if (!sortField) return rows;
        return [...rows].sort((a, b) => {
            const av = String(a[sortField] ?? '');
            const bv = String(b[sortField] ?? '');
            const cmp = av.localeCompare(bv);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    };

    const allFlatRows = (rawData || []).map(flattenCase);
    const filteredRows = applySort(applyFilters(allFlatRows));
    const previewRows = filteredRows.slice(0, 100);
    const hasMore = filteredRows.length > 100;

    // Visible columns = selected fields in order
    const visibleCols = selectedFields
        .map(key => ALL_FIELDS.find(f => f.key === key))
        .filter(Boolean) as FieldDef[];

    // Row class for date-based fields
    const getRowClass = (row: Record<string, any>): string => {
        if (row.invoice_due_date && row.invoice_status !== 'PAID') {
            // Try to get raw due date from raw data — use invoice_due_date string
            // Since it's already formatted, just do a basic check
        }
        return '';
    };

    // Grouping
    const groupedRows = (): { group: string; rows: Record<string, any>[] }[] => {
        if (!groupField) return [{ group: '', rows: previewRows }];
        const map = new Map<string, Record<string, any>[]>();
        for (const row of previewRows) {
            const key = String(row[groupField] ?? '(blank)');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(row);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([group, rows]) => ({ group, rows }));
    };

    // Save report
    const handleSave = () => {
        if (!saveName.trim()) return;
        const report: SavedReport = {
            id: Date.now().toString(),
            name: saveName.trim(),
            selectedFields,
            filters,
            sortField,
            sortDir,
            groupField,
            savedAt: new Date().toISOString(),
        };
        const updated = [...savedReports, report];
        setSavedReports(updated);
        saveSavedReports(updated);
        setSaveModalOpen(false);
        setSaveName('');
        toast.success(`Report "${report.name}" saved`);
    };

    // Load saved report
    const loadReport = (r: SavedReport) => {
        setSelectedFields(r.selectedFields);
        setFilters(r.filters);
        setSortField(r.sortField);
        setSortDir(r.sortDir);
        setGroupField(r.groupField);
        toast.success(`Loaded "${r.name}"`);
    };

    const deleteReport = (id: string) => {
        const updated = savedReports.filter(r => r.id !== id);
        setSavedReports(updated);
        saveSavedReports(updated);
    };

    // Export
    const handleExport = (formatType: 'csv' | 'excel' | 'pdf') => {
        if (filteredRows.length === 0) { toast.error('No data to export'); return; }
        const exportData = buildExportRows(filteredRows, visibleCols.map(c => ({ key: c.key, label: c.label })));
        const fileName = `Custom-Report-${format(new Date(), 'yyyy-MM-dd')}`;
        if (formatType === 'csv') exportToCSV(exportData, fileName);
        else if (formatType === 'excel') exportToExcel(exportData, fileName);
        else exportToPDF(exportData, visibleCols.map(c => c.label), fileName, 'Custom Report');
        toast.success(`Exported to ${formatType.toUpperCase()}`);
    };

    const addFilter = () => {
        setFilters(prev => [...prev, { id: Date.now().toString(), fieldKey: '', operator: 'contains', value: '' }]);
    };

    const updateFilter = (id: string, patch: Partial<FilterRow>) => {
        setFilters(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    };

    const removeFilter = (id: string) => {
        setFilters(prev => prev.filter(f => f.id !== id));
    };

    const toggleField = (key: string) => {
        setSelectedFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Custom Report</h2>
                    <p className="text-muted-foreground">Category G — R47: Build any report from any field combination.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSaveModalOpen(true)} disabled={selectedFields.length === 0}>
                        <Save className="mr-2 h-4 w-4" /> Save Report
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={!hasRun || filteredRows.length === 0}>
                                <FileOutput className="mr-2 h-4 w-4" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                                <FileText className="mr-2 h-4 w-4" /> Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('excel')} className="cursor-pointer">
                                <FileDown className="mr-2 h-4 w-4" /> Export as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                                <FileDown className="mr-2 h-4 w-4" /> Export as PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Builder Panel */}
                <div className="lg:col-span-1 space-y-4">
                    {/* Field Selector */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">1. Select Fields</CardTitle>
                            <CardDescription>Choose which columns to include</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {FIELD_GROUPS.map(group => (
                                <div key={group.group}>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{group.group}</p>
                                    <div className="space-y-1">
                                        {group.fields.map(field => (
                                            <div key={field.key} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={field.key}
                                                    checked={selectedFields.includes(field.key)}
                                                    onCheckedChange={() => toggleField(field.key)}
                                                />
                                                <Label htmlFor={field.key} className="text-xs cursor-pointer">
                                                    {field.label}
                                                    {field.computed && <span className="text-muted-foreground ml-1">(calc)</span>}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Filters */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">2. Filters</CardTitle>
                                <Button variant="ghost" size="sm" onClick={addFilter} className="h-7 px-2 text-xs gap-1">
                                    <Plus className="h-3 w-3" /> Add
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {filters.length === 0 && (
                                <p className="text-xs text-muted-foreground">No filters — showing all records</p>
                            )}
                            {filters.map(f => {
                                const fieldDef = ALL_FIELDS.find(fd => fd.key === f.fieldKey);
                                const ops = getOpsForField(fieldDef);
                                return (
                                    <div key={f.id} className="space-y-1.5 pb-2 border-b border-border last:border-0">
                                        <div className="flex items-center gap-1">
                                            <Select value={f.fieldKey || undefined} onValueChange={v => updateFilter(f.id, { fieldKey: v, operator: getOpsForField(ALL_FIELDS.find(fd => fd.key === v))[0] })}>
                                                <SelectTrigger className="h-7 text-xs flex-1">
                                                    <SelectValue placeholder="Field..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ALL_FIELDS.map(fd => (
                                                        <SelectItem key={fd.key} value={fd.key} className="text-xs">{fd.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFilter(f.id)}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex gap-1">
                                            <Select value={f.operator} onValueChange={v => updateFilter(f.id, { operator: v })}>
                                                <SelectTrigger className="h-7 text-xs w-28">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ops.map(op => (
                                                        <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                className="h-7 text-xs flex-1"
                                                placeholder="Value..."
                                                value={f.value}
                                                onChange={e => updateFilter(f.id, { value: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Sort & Group */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">3. Sort & Group</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Sort by</Label>
                                <div className="flex gap-1">
                                    <Select value={sortField} onValueChange={setSortField}>
                                        <SelectTrigger className="h-8 text-xs flex-1">
                                            <SelectValue placeholder="Field..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ALL_FIELDS.map(fd => (
                                                <SelectItem key={fd.key} value={fd.key} className="text-xs">{fd.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Select value={sortDir} onValueChange={v => setSortDir(v as 'asc' | 'desc')}>
                                        <SelectTrigger className="h-8 text-xs w-20">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="asc" className="text-xs">Asc</SelectItem>
                                            <SelectItem value="desc" className="text-xs">Desc</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Group by (optional)</Label>
                                <Select value={groupField || '__none__'} onValueChange={v => setGroupField(v === '__none__' ? '' : v)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="No grouping" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__" className="text-xs">No grouping</SelectItem>
                                        {ALL_FIELDS.map(fd => (
                                            <SelectItem key={fd.key} value={fd.key} className="text-xs">{fd.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Run button */}
                    <Button
                        className="w-full gap-2"
                        disabled={selectedFields.length === 0}
                        onClick={() => { setHasRun(true); setRunTrigger(t => t + 1); }}
                    >
                        <Play className="h-4 w-4" />
                        Run Report
                    </Button>
                </div>

                {/* Preview Panel */}
                <div className="lg:col-span-2 space-y-4">
                    {!hasRun && (
                        <Card className="flex flex-col items-center justify-center py-16 text-center">
                            <Database className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Select fields, add filters, then click <strong>Run Report</strong></p>
                        </Card>
                    )}

                    {hasRun && isLoading && (
                        <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 w-full rounded" />
                            ))}
                        </div>
                    )}

                    {hasRun && !isLoading && (
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">
                                        Preview
                                        <Badge variant="secondary" className="ml-2">{filteredRows.length} rows</Badge>
                                    </CardTitle>
                                    {hasMore && (
                                        <p className="text-xs text-muted-foreground">
                                            Showing first 100 of {filteredRows.length} rows. Export to see all.
                                        </p>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {visibleCols.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8 text-sm">Select at least one field to see data</p>
                                ) : filteredRows.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8 text-sm">No records match your filters</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {visibleCols.map(col => (
                                                        <TableHead key={col.key} className="text-xs whitespace-nowrap">{col.label}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {groupedRows().map(({ group, rows }) => (
                                                    <React.Fragment key={group || 'all'}>
                                                        {group && (
                                                            <TableRow className="bg-muted/30">
                                                                <TableCell colSpan={visibleCols.length} className="py-1.5 px-4 text-xs font-semibold text-muted-foreground">
                                                                    {group} <span className="font-normal">({rows.length})</span>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                        {rows.map((row, ri) => (
                                                            <TableRow key={ri}>
                                                                {visibleCols.map(col => (
                                                                    <TableCell key={col.key} className="text-xs py-2 whitespace-nowrap">
                                                                        {col.key === 'matter_code' ? (
                                                                            <span
                                                                                className="font-mono text-xs font-semibold text-blue-600 cursor-pointer hover:underline"
                                                                                onClick={() => navigate(`/cases/${row._case_uuid}`)}
                                                                            >
                                                                                {row[col.key] || '—'}
                                                                            </span>
                                                                        ) : row[col.key] ?? '—'}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Saved Reports */}
                    {savedReports.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4" /> My Saved Reports
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {savedReports.map(r => (
                                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border hover:bg-accent/30">
                                        <div>
                                            <p className="text-sm font-medium">{r.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {r.selectedFields.length} fields · {r.filters.length} filters · Saved {fmtDate(r.savedAt)}
                                            </p>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => loadReport(r)}>
                                                <Play className="h-3 w-3" /> Load
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteReport(r.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Save Modal */}
            {saveModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-80">
                        <CardHeader>
                            <CardTitle className="text-base">Save Report</CardTitle>
                            <CardDescription>Enter a name for this report configuration</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Input
                                placeholder="Report name..."
                                value={saveName}
                                onChange={e => setSaveName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <Button className="flex-1" onClick={handleSave} disabled={!saveName.trim()}>
                                    Save
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => setSaveModalOpen(false)}>
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default CustomReport;
