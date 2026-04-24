import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { escapeLikePattern, sanitizeErrorMessage } from '@/lib/security';
import { Case } from '@/types/database';
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
    RotateCcw,
    Calendar,
    Clock,
    Trash2,
    UserPlus,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import ChangeReporterModal from '@/components/forms/ChangeReporterModal';
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
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UpdateWorkflowModal from '@/components/forms/UpdateWorkflowModal';
import { displayClientName } from '@/lib/clientUtils';

interface WorkflowListViewProps {
    stage: 'in_depth' | 'enforcement' | 'destruction';
    title: string;
}

const WorkflowListView: React.FC<WorkflowListViewProps> = ({ stage, title }) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const pageSize = 10;
    const [isDeleting, setIsDeleting] = useState(false);
    const [caseToDelete, setCaseToDelete] = useState<string | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Quick Actions State
    const [selectedCase, setSelectedCase] = useState<any | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

    // Sorting state
    const [sortColumn, setSortColumn] = useState<'matter_code' | 'date' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Workflow status tab: in-progress vs done for this stage
    const [activeTab, setActiveTab] = useState<'in_progress' | 'done'>('in_progress');
    const stageTable = stage === 'in_depth'
        ? 'in_depth_stages'
        : stage === 'enforcement'
            ? 'enforcement_stages'
            : 'destruction_stages';
    const stageStatusValue = activeTab === 'in_progress' ? 'IN_PROGRESS' : 'DONE';
    const hideCaseStatusColumn = activeTab === 'done';

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

    const { data: cases, isLoading, refetch } = useQuery({
        queryKey: ['workflow-cases', stage, searchTerm, page, showAll, activeTab],
        queryFn: async () => {
            // Inner-join on the active stage table so only cases that have a record
            // for this stage (and match the in-progress/done filter) are returned.
            const joins = ['case_uploads(*)', 'in_depth_stages(*)', 'enforcement_stages(*)', 'destruction_stages(*)']
                .map(j => j.startsWith(stageTable) ? j.replace('(*)', '!inner(*)') : j)
                .join(', ');
            const selectStr = `*, ${joins}`;

            let query = supabase
                .from('cases')
                .select(selectStr, { count: 'exact' })
                .eq(`${stageTable}.status`, stageStatusValue);

            if (searchTerm) {
                const escaped = escapeLikePattern(searchTerm);
                query = query.or(`case_id.ilike.%${escaped}%,target_name.ilike.%${escaped}%,brand_name.ilike.%${escaped}%`);
            }

            query = query.order('created_at', { ascending: false });

            if (!showAll) {
                query = query.range((page - 1) * pageSize, page * pageSize - 1);
            }

            const { data, count, error } = await query;

            if (error) {
                throw error;
            }

            return { data, count };
        },
    });

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

    const getStageStatus = (c: any) => {
        const getFirstArrOrObj = (val: any) => Array.isArray(val) ? val[0] : val;

        if (stage === 'in_depth') return getFirstArrOrObj(c.in_depth_stages);
        if (stage === 'enforcement') return getFirstArrOrObj(c.enforcement_stages);
        if (stage === 'destruction') return getFirstArrOrObj(c.destruction_stages);
        return null;
    };

    const getDateLabel = () => {
        return activeTab === 'done' ? 'Done Date' : 'Due Date';
    };

    const parseDate = (d?: string | null): Date | null => {
        if (!d) return null;
        // Bare YYYY-MM-DD: anchor at local midnight. Full ISO/timestamp: parse as-is.
        const s = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + 'T00:00:00' : d;
        const parsed = new Date(s);
        return isNaN(parsed.getTime()) ? null : parsed;
    };

    const getStageDate = (stageData: any) => {
        if (!stageData) return '-';
        const date = stageData.status === 'DONE'
            ? (stageData.status_date || stageData.due_date)
            : stageData.due_date;
        const parsed = parseDate(date);
        return parsed ? format(parsed, 'MMM dd, yyyy') : '-';
    };

    const getStageDateRaw = (c: any) => {
        const stageData = getStageStatus(c);
        if (!stageData) return '';
        return stageData.status === 'DONE'
            ? (stageData.status_date || stageData.due_date || '')
            : (stageData.due_date || '');
    };

    const getUpload = (c: any) => {
        if (!c.case_uploads) return null;
        return Array.isArray(c.case_uploads) ? c.case_uploads[0] : c.case_uploads;
    };

    const formatDate = (d?: string | null) => {
        const parsed = parseDate(d);
        return parsed ? format(parsed, 'MMM dd, yyyy') : '-';
    };

    const sortedData = React.useMemo(() => {
        if (!cases?.data || !sortColumn) return cases?.data;
        const sorted = [...cases.data].sort((a: any, b: any) => {
            if (sortColumn === 'matter_code') {
                const valA = (a.matter_code || '').toLowerCase();
                const valB = (b.matter_code || '').toLowerCase();
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (sortColumn === 'date') {
                const dateA = new Date(getStageDateRaw(a) || 0).getTime();
                const dateB = new Date(getStageDateRaw(b) || 0).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            return 0;
        });
        return sorted;
    }, [cases?.data, sortColumn, sortDirection]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                    <p className="text-muted-foreground">
                        Track progress of cases in the {title.toLowerCase()} phase.
                    </p>
                </div>
            </div>

            <Tabs
                value={activeTab}
                onValueChange={(v) => { setActiveTab(v as 'in_progress' | 'done'); setPage(1); }}
            >
                <TabsList>
                    <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                    <TabsTrigger value="done">Done</TabsTrigger>
                </TabsList>
            </Tabs>

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

                {searchTerm && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="h-10 text-muted-foreground hover:text-foreground"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" /> Clear
                    </Button>
                )}
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('matter_code')}>
                                Matter Code {getSortIcon('matter_code')}
                            </TableHead>
                            <TableHead>Target Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Upload Date</TableHead>
                            <TableHead>Approved Date</TableHead>
                            {!hideCaseStatusColumn && <TableHead>Case Status</TableHead>}
                            <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
                                {getDateLabel()} {getSortIcon('date')}
                            </TableHead>
                            <TableHead>Workflow Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={hideCaseStatusColumn ? 9 : 10} className="h-24 text-center">
                                    Loading workflow cases...
                                </TableCell>
                            </TableRow>
                        ) : sortedData && sortedData.length > 0 ? (
                            sortedData.map((c: any) => {
                                const stageData = getStageStatus(c);
                                return (
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
                                            {c.case_uploads ? (
                                                Array.isArray(c.case_uploads)
                                                    ? displayClientName(c.case_uploads[0]?.client)
                                                    : displayClientName((c.case_uploads as any).client)
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {formatDate(getUpload(c)?.upload_date)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {getUpload(c)?.decision_status === 'APPROVED'
                                                    ? formatDate(getUpload(c)?.decision_date)
                                                    : '-'}
                                            </div>
                                        </TableCell>
                                        {!hideCaseStatusColumn && (
                                            <TableCell>
                                                <StatusBadge status={c.case_status} />
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {getStageDate(stageData)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {stageData ? (
                                                <Badge variant={stageData.status === 'DONE' ? 'success' : 'default'}>
                                                    {stageData.status.replace('_', ' ')}
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground">NOT STARTED</Badge>
                                            )}
                                        </TableCell>
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
                                                        View Details
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground">Quick Actions</DropdownMenuLabel>

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

                                                    <DropdownMenuItem
                                                        className="cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedCase(c);
                                                            setIsUpdateModalOpen(true);
                                                        }}
                                                    >
                                                        <Clock className="mr-2 h-4 w-4" />
                                                        Update Status
                                                    </DropdownMenuItem>

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
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={hideCaseStatusColumn ? 9 : 10} className="h-24 text-center">
                                    No cases found in this stage.
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
                <ChangeReporterModal
                    caseId={selectedCase.id}
                    currentReporter={selectedCase.case_reported_by}
                    isOpen={isAssignModalOpen}
                    onClose={() => setIsAssignModalOpen(false)}
                    onSuccess={refetch}
                />
            )}

            {selectedCase && (
                <UpdateWorkflowModal
                    caseId={selectedCase.id}
                    stage={stage}
                    isOpen={isUpdateModalOpen}
                    onClose={() => setIsUpdateModalOpen(false)}
                    onSuccess={refetch}
                    currentData={getStageStatus(selectedCase)}
                />
            )}
        </div>
    );
};

export default WorkflowListView;
