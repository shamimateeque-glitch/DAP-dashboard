import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { Search, Hammer, Trash2, Calendar } from 'lucide-react';
import { classifyDueDate, DUE_DATE_ROW_CLASSES, fmtDate } from '@/lib/reportUtils';
import { displayClientName } from '@/lib/clientUtils';

/**
 * My Pending Work — the Investigation & Enforcement (field) team's only screen.
 *
 * View-only and financial-free. Three stage tabs (In-Depth / Enforcement / Destruction).
 *
 * IMPORTANT: pending work is derived the SAME way as the dashboard's Pending Work summary
 * (by case status / stage completion), NOT by requiring a stage row in exactly IN_PROGRESS.
 * Approved cases that haven't started a stage yet still count as pending, so the counts here
 * match the summary cards. Tapping a row opens the (financial-free) case detail.
 */

type Stage = 'in_depth' | 'enforcement' | 'destruction';

const STAGE_TABS: { value: Stage; label: string; icon: React.ElementType }[] = [
    { value: 'in_depth', label: 'In-Depth', icon: Search },
    { value: 'enforcement', label: 'Enforcement', icon: Hammer },
    { value: 'destruction', label: 'Destruction', icon: Trash2 },
];

// ── Basic-info columns (financial-free). Placeholder set — swap field list here later. ──
const COLUMNS: { key: string; label: string }[] = [
    { key: 'matter_code', label: 'Matter Code' },
    { key: 'target_name', label: 'Target Name' },
    { key: 'brand_name', label: 'Brand' },
    { key: 'client', label: 'Client' },
    { key: 'case_type', label: 'Case Type' },
    { key: 'city', label: 'City' },
    { key: 'case_status', label: 'Case Status' },
    { key: 'due_date', label: 'Due Date' },
];

const getFirst = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);

// Stage due date: in_depth/enforcement use `target_date`, destruction uses `due_date`.
const stageDue = (s: any): string | null => s?.due_date ?? s?.target_date ?? null;

// Compute a fallback due date (e.g. for an approved case whose stage row doesn't exist yet).
const plusDays = (dateStr: string | null | undefined, days: number): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

interface Row {
    id: string;
    matter_code: string;
    target_name: string;
    brand_name: string;
    client: string;
    case_type: string;
    city: string;
    case_status: string;
    due_date: string | null;
}

/** Pending predicates mirror PendingWorkReport.flattenRow so counts match the summary cards. */
function toPendingRow(c: any, stage: Stage): Row | null {
    const inDepth = getFirst(c.in_depth_stages);
    const enforcement = getFirst(c.enforcement_stages);
    const destruction = getFirst(c.destruction_stages);
    const upload = getFirst(c.case_uploads);

    // Membership is driven by case_status — the authoritative position in the workflow —
    // not by embedded stage records (which may be missing, e.g. Customs cases skip In-Depth).
    let dueDate: string | null = null;

    if (stage === 'in_depth') {
        if (!(c.case_status === 'APPROVED' || c.case_status === 'IN_DEPTH')) return null;
        // Use the stored stage date; if the in-depth row doesn't exist yet, compute
        // decision date + 7 days (the standard in-depth target).
        dueDate = stageDue(inDepth) ?? plusDays(upload?.decision_date, 7);
    } else if (stage === 'enforcement') {
        if (c.case_status !== 'ENFORCEMENT') return null;
        dueDate = stageDue(enforcement);
    } else {
        if (c.case_status !== 'DESTRUCTION') return null;
        dueDate = stageDue(destruction);
    }

    return {
        id: c.id,
        matter_code: c.matter_code || '-',
        target_name: c.target_name || '-',
        brand_name: c.brand_name || '-',
        client: upload?.client ? displayClientName(upload.client) : '-',
        case_type: c.case_type || '-',
        city: c.city || '-',
        case_status: c.case_status,
        due_date: dueDate,
    };
}

function renderValue(row: Row, key: string): React.ReactNode {
    if (key === 'case_status') return <StatusBadge status={row.case_status} />;
    if (key === 'due_date') return row.due_date ? fmtDate(row.due_date) : '-';
    return (row as any)[key] ?? '-';
}

const TeamPendingWork: React.FC = () => {
    const navigate = useNavigate();
    const [stage, setStage] = useState<Stage>('in_depth');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: rawCases, isLoading } = useQuery({
        queryKey: ['team-pending-work'],
        queryFn: async () => {
            // Mirror PendingWorkPage's proven select: request stage `status` explicitly
            // (a `*` embed does not reliably return stage status in the post-encryption schema).
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    id, matter_code, target_name, brand_name, city, province, case_type, case_status, created_at,
                    case_uploads(client, decision_date),
                    in_depth_stages(*),
                    enforcement_stages(*),
                    destruction_stages(*)
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    const rows = useMemo(() => {
        if (!rawCases) return [];
        let list = rawCases
            .map((c: any) => toPendingRow(c, stage))
            .filter(Boolean) as Row[];

        const term = searchTerm.trim().toLowerCase();
        if (term) {
            list = list.filter(r =>
                r.matter_code.toLowerCase().includes(term) ||
                r.target_name.toLowerCase().includes(term) ||
                r.brand_name.toLowerCase().includes(term)
            );
        }
        return list;
    }, [rawCases, stage, searchTerm]);

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">My Pending Work</h2>
                <p className="text-muted-foreground">
                    Cases awaiting action across In-Depth, Enforcement and Destruction.
                </p>
            </div>

            <Tabs value={stage} onValueChange={(v) => setStage(v as Stage)}>
                <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
                    {STAGE_TABS.map(({ value, label, icon: Icon }) => (
                        <TabsTrigger key={value} value={value} className="gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search cases..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="text-sm text-muted-foreground">
                {isLoading ? 'Loading…' : `${rows.length} pending ${rows.length === 1 ? 'case' : 'cases'}`}
            </div>

            {/* Mobile card list */}
            <div className="space-y-3 md:hidden">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-lg border bg-card p-4"><Skeleton className="h-16 w-full" /></div>
                    ))
                ) : rows.length > 0 ? (
                    rows.map((row) => (
                        <div
                            key={row.id}
                            onClick={() => navigate(`/cases/${row.id}`)}
                            className={`rounded-lg border p-4 space-y-2 cursor-pointer active:bg-accent/50 transition-colors ${DUE_DATE_ROW_CLASSES[classifyDueDate(row.due_date)] || 'bg-card'}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-blue-600">{row.matter_code}</span>
                                <StatusBadge status={row.case_status} />
                            </div>
                            <div className="font-medium text-sm">{row.target_name}</div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{row.brand_name}</span>
                                <span>{row.client}</span>
                                <span>{row.case_type}</span>
                                <span>{row.city}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs pt-1">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Due:</span>
                                <span className="font-medium">{row.due_date ? fmtDate(row.due_date) : '-'}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
                        No pending cases in this stage.
                    </div>
                )}
            </div>

            {/* Desktop table */}
            <div className="rounded-md border bg-card hidden md:block overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {COLUMNS.map((col) => (
                                <TableHead key={col.key}>{col.label}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {COLUMNS.map((col) => (
                                        <TableCell key={col.key}><Skeleton className="h-4 w-20" /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : rows.length > 0 ? (
                            rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    onClick={() => navigate(`/cases/${row.id}`)}
                                    className={`cursor-pointer ${DUE_DATE_ROW_CLASSES[classifyDueDate(row.due_date)] || ''}`}
                                >
                                    {COLUMNS.map((col) => (
                                        <TableCell
                                            key={col.key}
                                            className={`text-xs whitespace-nowrap ${col.key === 'matter_code' ? 'font-mono font-semibold text-blue-600' : ''}`}
                                        >
                                            {renderValue(row, col.key)}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={COLUMNS.length} className="h-24 text-center">
                                    No pending cases in this stage.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default TeamPendingWork;
