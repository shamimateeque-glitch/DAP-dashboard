import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/StatusBadge';
import { Search, Gavel, Trash2, Calendar, ArrowLeft, Loader2 } from 'lucide-react';
import { classifyDueDate, DUE_DATE_ROW_CLASSES, fmtDate } from '@/lib/reportUtils';
import { displayClientName } from '@/lib/clientUtils';

/**
 * My Pending Work — the Investigation & Enforcement (field) team's only screen.
 *
 * Landing view shows three KPI cards (In-Depth / Enforcement / Destruction) with live
 * counts; tapping a card drills into that stage's case list; tapping a case opens the
 * (financial-free) detail. View-only and financial-free throughout.
 *
 * Membership/counts are driven by case_status — the authoritative workflow position — so
 * the number on each KPI card always equals the list you see when you tap it, and matches
 * the dashboard's Pending Work summary.
 */

type Stage = 'in_depth' | 'enforcement' | 'destruction';

const STAGE_META: Record<Stage, {
    title: string;
    short: string;
    description: string;
    icon: React.ElementType;
    gradient: string;
}> = {
    in_depth: {
        title: 'Pending In-Depth Investigation',
        short: 'In-Depth',
        description: 'Approved cases with in-depth work pending',
        icon: Search,
        gradient: 'linear-gradient(135deg, #3730a3 0%, #6366f1 50%, #a5b4fc 100%)',
    },
    enforcement: {
        title: 'Pending Enforcement',
        short: 'Enforcement',
        description: 'In-depth done, enforcement action pending',
        icon: Gavel,
        gradient: 'linear-gradient(135deg, #6b21a8 0%, #a855f7 50%, #d8b4fe 100%)',
    },
    destruction: {
        title: 'Pending Destruction',
        short: 'Destruction',
        description: 'Enforcement done, destruction of goods pending',
        icon: Trash2,
        gradient: 'linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #fca5a5 100%)',
    },
};

const STAGE_ORDER: Stage[] = ['in_depth', 'enforcement', 'destruction'];

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

// Which stage (if any) a case is currently pending. Mirrors the dashboard's Pending Work
// summary (PendingWorkPage) EXACTLY so the counts match: it keys off stage completion, not
// raw case_status. (Note: like the dashboard, Customs cases — which skip In-Depth — are not
// counted under Enforcement because they never have a "done" in-depth record.)
const pendingStageOf = (c: any): Stage | null => {
    const inD = getFirst(c.in_depth_stages);
    const enf = getFirst(c.enforcement_stages);
    const des = getFirst(c.destruction_stages);

    if (enf?.status === 'DONE' && (!des || des.status !== 'DONE')) return 'destruction';
    if (inD?.status === 'DONE' && (!enf || enf.status !== 'DONE')) return 'enforcement';
    if ((c.case_status === 'APPROVED' || c.case_status === 'IN_DEPTH') && (!inD || inD.status !== 'DONE')) return 'in_depth';
    return null;
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

function toPendingRow(c: any, stage: Stage): Row | null {
    if (pendingStageOf(c) !== stage) return null;

    const inDepth = getFirst(c.in_depth_stages);
    const enforcement = getFirst(c.enforcement_stages);
    const destruction = getFirst(c.destruction_stages);
    const upload = getFirst(c.case_uploads);

    let dueDate: string | null = null;
    if (stage === 'in_depth') {
        // Stored stage date, or compute decision date + 7 days when the row doesn't exist yet.
        dueDate = stageDue(inDepth) ?? plusDays(upload?.decision_date, 7);
    } else if (stage === 'enforcement') {
        dueDate = stageDue(enforcement);
    } else {
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

// ── KPI landing card ──────────────────────────────────────────────────────────
function KpiCard({ stage, count, isLoading, onClick }: {
    stage: Stage; count: number; isLoading: boolean; onClick: () => void;
}) {
    const meta = STAGE_META[stage];
    const Icon = meta.icon;
    return (
        <button
            onClick={onClick}
            style={{ background: meta.gradient }}
            className="relative overflow-hidden rounded-2xl p-6 text-left text-white shadow-lg transition-transform active:scale-[0.98] hover:-translate-y-0.5 min-h-[180px] flex flex-col items-center justify-center text-center gap-2"
        >
            <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center">
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold tracking-wide text-white/90">{meta.title}</p>
            {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            ) : (
                <p className="text-5xl font-extrabold tracking-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.15)' }}>{count}</p>
            )}
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/20 border border-white/20 text-white/90">
                {meta.description}
            </span>
        </button>
    );
}

const TeamPendingWork: React.FC = () => {
    const navigate = useNavigate();
    const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: rawCases, isLoading } = useQuery({
        queryKey: ['team-pending-work', 'v2'],
        queryFn: async () => {
            // Explicit stage `status` (mirrors PendingWorkPage's proven select) so the
            // stage-completion predicate matches the dashboard's counts exactly.
            const { data, error } = await supabase
                .from('cases')
                .select(`
                    id, matter_code, target_name, brand_name, city, province, case_type, case_status, created_at,
                    case_uploads(client, decision_date),
                    in_depth_stages(status, due_date),
                    enforcement_stages(status, due_date),
                    destruction_stages(status, due_date)
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    // Live counts per stage (same predicate as the lists → numbers always match).
    const counts = useMemo(() => {
        const c: Record<Stage, number> = { in_depth: 0, enforcement: 0, destruction: 0 };
        for (const x of rawCases || []) {
            const s = pendingStageOf(x);
            if (s) c[s]++;
        }
        return c;
    }, [rawCases]);

    const rows = useMemo(() => {
        if (!rawCases || !selectedStage) return [];
        let list = rawCases
            .map((c: any) => toPendingRow(c, selectedStage))
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
    }, [rawCases, selectedStage, searchTerm]);

    const openStage = (s: Stage) => { setSelectedStage(s); setSearchTerm(''); };

    // ── Landing: KPI cards ──────────────────────────────────────────────────────
    if (!selectedStage) {
        return (
            <div className="space-y-5">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">My Pending Work</h2>
                    <p className="text-muted-foreground">
                        Tap a stage to see the cases awaiting action.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {STAGE_ORDER.map((s) => (
                        <KpiCard key={s} stage={s} count={counts[s]} isLoading={isLoading} onClick={() => openStage(s)} />
                    ))}
                </div>
            </div>
        );
    }

    // ── Drill-down: case list for the selected stage ────────────────────────────
    const meta = STAGE_META[selectedStage];
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3">
                <Button variant="ghost" size="sm" className="mt-0.5" onClick={() => setSelectedStage(null)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{meta.title}</h2>
                    <p className="text-muted-foreground">{meta.description}</p>
                </div>
            </div>

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
