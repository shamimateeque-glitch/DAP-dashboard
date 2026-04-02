import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Bell,
    History,
    Settings,
    Mail,
    AlertTriangle,
    CheckCircle2,
    Clock,
    RefreshCcw,
    ChevronLeft,
    ChevronRight,
    CalendarClock,
    Save,
    Upload,
    Search,
    Gavel,
    FileText,
    DollarSign,
    Trash2,
    Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';

const ALERT_CATEGORIES = [
    {
        title: "Case Updates",
        alerts: [
            { type: 'CASE_APPROVED', label: 'Case Approved', description: 'When a client approves a case upload.' },
            { type: 'CASE_REJECTED', label: 'Case Rejected', description: 'When a client rejects a case upload.' },
            { type: 'FINAL_REPORT_SUBMITTED', label: 'Final Report Submitted', description: 'When a final report is submitted.' },
        ]
    },
    {
        title: "Workflow Stages",
        alerts: [
            { type: 'IN_DEPTH_DONE', label: 'In-Depth Investigation Done', description: 'When the in-depth stage is marked as DONE.' },
            { type: 'IN_DEPTH_DATE_CHANGED', label: 'In-Depth Date Changed', description: 'When target date for in-depth is updated.' },
            { type: 'ENFORCEMENT_DONE', label: 'Enforcement Done', description: 'When enforcement stage is marked as DONE.' },
            { type: 'ENFORCEMENT_DATE_CHANGED', label: 'Enforcement Date Changed', description: 'When target date for enforcement is updated.' },
            { type: 'DESTRUCTION_DONE', label: 'Destruction Done', description: 'When destruction is completed.' },
        ]
    },
    {
        title: "Invoicing & Payments",
        alerts: [
            { type: 'INVOICE_ISSUED', label: 'Invoice Issued', description: 'When a new invoice is generated.' },
            { type: 'INVOICE_PAID', label: 'Invoice Paid', description: 'When an invoice is marked as paid.' },
            { type: 'INVOICE_OVERDUE', label: 'Invoice Overdue', description: 'When an invoice passes its due date.' },
        ]
    }
];

const WEEKLY_REPORT_TYPES = [
    { type: 'upload',       label: 'Pending Upload to Client',        icon: Upload,     description: 'Cases created but not yet uploaded to client.' },
    { type: 'decision',     label: 'Waiting for Client Decision',     icon: Clock,      description: 'Uploaded cases awaiting client approval.' },
    { type: 'in-depth',     label: 'Pending In-Depth Investigation',  icon: Search,     description: 'Approved cases with in-depth work pending.' },
    { type: 'enforcement',  label: 'Pending Enforcement',             icon: Gavel,      description: 'In-depth done, enforcement action pending.' },
    { type: 'final-report', label: 'Pending Final Report to Client',  icon: FileText,   description: 'Enforcement done, final report not sent.' },
    { type: 'invoices',     label: 'Pending Invoices to Client',      icon: DollarSign, description: 'Final report sent, invoice not yet issued.' },
    { type: 'destruction',  label: 'Pending Destruction',             icon: Trash2,     description: 'Enforcement done, destruction pending.' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const h24 = Math.floor(i / 2);
    const mm = i % 2 === 0 ? '00' : '30';
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return { value: `${String(h24).padStart(2, '0')}:${mm}`, label: `${h12}:${mm} ${period}` };
});

interface WeeklySettingRow {
    id: string;
    report_type: string;
    email_addresses: string;
    is_enabled: boolean;
    schedule_day: string;
    schedule_time: string;
}

const AlertsPage = () => {
    const { appUser } = useAuth();
    const { can } = usePermissions();
    const queryClient = useQueryClient();
    const [page, setPage] = React.useState(1);
    const [showAll, setShowAll] = React.useState(false);
    const pageSize = 10;

    // 1. Fetch user's alert configurations
    const { data: configs } = useQuery({
        queryKey: ['alert-configs', appUser?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('alert_configurations')
                .select('*')
                .eq('user_id', appUser?.id);
            if (error) throw error;
            return data;
        },
        enabled: !!appUser?.id
    });

    // 2. Fetch alert and reminder logs
    const { data: logs, isLoading: logsLoading } = useQuery({
        queryKey: ['alert-logs', showAll ? 'all' : page],
        queryFn: async () => {
            let query = supabase
                .from('alert_logs')
                .select('*, cases(case_id, target_name)', { count: 'exact' })
                .order('sent_at', { ascending: false });
            if (!showAll) {
                query = query.range((page - 1) * pageSize, page * pageSize - 1);
            }
            const { data, count, error } = await query;
            if (error) throw error;
            return { data, count };
        }
    });

    // 3. Toggle Alert Mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ type, enabled }: { type: string, enabled: boolean }) => {
            const existing = configs?.find(c => c.alert_type === type);

            if (existing) {
                const { error } = await supabase
                    .from('alert_configurations')
                    .update({ is_enabled: enabled })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('alert_configurations')
                    .insert([{
                        alert_type: type,
                        user_id: appUser?.id,
                        is_enabled: enabled
                    }]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alert-configs'] });
            toast.success('Notification settings updated');
        },
        onError: (error: any) => {
            toast.error(sanitizeErrorMessage(error, 'Error updating settings'));
        }
    });

    const isEnabled = (type: string) => {
        return configs?.find(c => c.alert_type === type)?.is_enabled ?? false;
    };

    // ─── Weekly Report Settings ──────────────────────────────────────────
    const [weeklyEdits, setWeeklyEdits] = React.useState<Record<string, { email_addresses: string; is_enabled: boolean }>>({});
    const [weeklyDirty, setWeeklyDirty] = React.useState(false);
    const [scheduleDay, setScheduleDay] = React.useState('Monday');
    const [scheduleTime, setScheduleTime] = React.useState('08:00');

    const { data: weeklySettings, isLoading: weeklyLoading } = useQuery({
        queryKey: ['weekly-report-settings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('weekly_report_settings')
                .select('*')
                .order('report_type');
            if (error) throw error;
            return data as WeeklySettingRow[];
        },
    });

    // Sync fetched settings into local edits state
    const [weeklyInitialized, setWeeklyInitialized] = React.useState(false);
    React.useEffect(() => {
        if (weeklySettings && !weeklyInitialized) {
            const map: Record<string, { email_addresses: string; is_enabled: boolean }> = {};
            for (const s of weeklySettings) {
                map[s.report_type] = { email_addresses: s.email_addresses, is_enabled: s.is_enabled };
            }
            setWeeklyEdits(map);
            setWeeklyInitialized(true);
            // Sync global schedule from first row
            if (weeklySettings.length > 0) {
                setScheduleDay(weeklySettings[0].schedule_day || 'Monday');
                setScheduleTime(weeklySettings[0].schedule_time || '08:00');
            }
        }
    }, [weeklySettings, weeklyInitialized]);

    const weeklyGet = (type: string) => weeklyEdits[type] ?? { email_addresses: '', is_enabled: false };

    const weeklySetField = (type: string, field: 'email_addresses' | 'is_enabled', value: any) => {
        setWeeklyEdits(prev => ({
            ...prev,
            [type]: { ...prev[type] ?? { email_addresses: '', is_enabled: false }, [field]: value }
        }));
        setWeeklyDirty(true);
    };

    const weeklySaveMutation = useMutation({
        mutationFn: async () => {
            const rows = WEEKLY_REPORT_TYPES.map(report => {
                const edit = weeklyEdits[report.type];
                return {
                    report_type: report.type,
                    email_addresses: (edit?.email_addresses || '').trim(),
                    is_enabled: edit?.is_enabled ?? false,
                    schedule_day: scheduleDay,
                    schedule_time: scheduleTime,
                    updated_at: new Date().toISOString(),
                };
            });
            const { error } = await supabase
                .from('weekly_report_settings')
                .upsert(rows, { onConflict: 'report_type' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['weekly-report-settings'] });
            setWeeklyDirty(false);
            setWeeklyInitialized(false);
            toast.success('Weekly report settings saved');
        },
        onError: (error: any) => {
            toast.error(sanitizeErrorMessage(error, 'Error saving weekly report settings'));
        }
    });

    if (!can('alerts', 'view')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to view Alerts & Reminders.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Alerts & Reminders</h2>
                <p className="text-muted-foreground">Manage your notification preferences and view alert history.</p>
            </div>

            <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full max-w-[600px] grid-cols-3">
                    <TabsTrigger value="config" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" /> Configuration
                    </TabsTrigger>
                    <TabsTrigger value="weekly" className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" /> Weekly Reports
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                        <History className="h-4 w-4" /> History
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {ALERT_CATEGORIES.map((category) => (
                            <Card key={category.title} className="shadow-md">
                                <CardHeader className="bg-muted/30 pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Bell className="h-5 w-5 text-primary" />
                                        {category.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6 divide-y">
                                    {category.alerts.map((alert) => (
                                        <div key={alert.type} className="flex items-start justify-between py-4 first:pt-0 last:pb-0">
                                            <div className="space-y-1 pr-4">
                                                <p className="text-sm font-semibold leading-none">{alert.label}</p>
                                                <p className="text-xs text-muted-foreground leading-tight">
                                                    {alert.description}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={isEnabled(alert.type)}
                                                onCheckedChange={(checked) => toggleMutation.mutate({ type: alert.type, enabled: checked })}
                                                disabled={toggleMutation.isPending}
                                            />
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-dashed bg-muted/20">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">Email Notifications</p>
                                    <p className="text-sm text-muted-foreground">
                                        All enabled alerts will be sent to <strong>{appUser?.email}</strong>.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="weekly" className="mt-6 space-y-6">
                    <Card className="shadow-md">
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <CalendarClock className="h-5 w-5 text-primary" />
                                        Weekly Pending Reports
                                    </CardTitle>
                                    <CardDescription className="mt-1">
                                        Configure automatic weekly email delivery for each pending report.
                                    </CardDescription>
                                </div>
                                <Button
                                    size="sm"
                                    disabled={!weeklyDirty || weeklySaveMutation.isPending}
                                    onClick={() => weeklySaveMutation.mutate()}
                                >
                                    {weeklySaveMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save All
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {/* Schedule Day & Time */}
                            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium">Send every</span>
                                </div>
                                <Select
                                    value={scheduleDay}
                                    onValueChange={(val) => { setScheduleDay(val); setWeeklyDirty(true); }}
                                >
                                    <SelectTrigger className="w-[150px]">
                                        <SelectValue placeholder="Day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DAYS_OF_WEEK.map(day => (
                                            <SelectItem key={day} value={day}>{day}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-sm font-medium">at</span>
                                <Select
                                    value={scheduleTime}
                                    onValueChange={(val) => { setScheduleTime(val); setWeeklyDirty(true); }}
                                >
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIME_OPTIONS.map(t => (
                                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-sm text-muted-foreground">(PKT)</span>
                            </div>

                            <div className="divide-y">
                            {weeklyLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                    <span>Loading settings...</span>
                                </div>
                            ) : (
                                WEEKLY_REPORT_TYPES.map((report) => {
                                    const Icon = report.icon;
                                    const setting = weeklyGet(report.type);
                                    return (
                                        <div key={report.type} className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 first:pt-0 last:pb-0">
                                            <div className="flex items-center gap-3 sm:w-[280px] shrink-0">
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold leading-none">{report.label}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex-1 flex items-center gap-3">
                                                <Input
                                                    placeholder="email1@example.com, email2@example.com"
                                                    className="flex-1 text-sm"
                                                    value={setting.email_addresses}
                                                    onChange={(e) => weeklySetField(report.type, 'email_addresses', e.target.value)}
                                                />
                                                <Switch
                                                    checked={setting.is_enabled}
                                                    onCheckedChange={(checked) => weeklySetField(report.type, 'is_enabled', checked)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-dashed bg-muted/20">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                    <Mail className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">How it works</p>
                                    <p className="text-sm text-muted-foreground">
                                        Enabled reports are generated as Excel files and emailed to the configured addresses on the scheduled day and time. Uses the same data and filters as the Pending Work reports.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                    <Card className="shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Alert History</CardTitle>
                                <CardDescription>Recent notifications sent by the system.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['alert-logs', showAll ? 'all' : page] })}
                            >
                                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-[150px]">Date</TableHead>
                                            <TableHead>Event Type</TableHead>
                                            <TableHead>Target/Case</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {logsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <RefreshCcw className="h-5 w-5 animate-spin mr-2" />
                                                        <span>Loading history...</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : logs?.data && logs.data.length > 0 ? (
                                            logs.data.map((log: any) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="font-medium whitespace-nowrap">
                                                        {format(new Date(log.sent_at), 'MMM dd, HH:mm')}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-semibold">
                                                                {log.alert_type.replace(/_/g, ' ')}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {log.cases ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium">{log.cases.target_name}</span>
                                                                <span className="text-xs text-muted-foreground">{log.cases.case_id}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs italic">System Alert</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={log.email_status === 'SENT' ? 'success' : 'destructive'}
                                                            className="font-medium"
                                                        >
                                                            {log.email_status === 'SENT' ? (
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                            ) : (
                                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                            )}
                                                            {log.email_status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                                    No alert history found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {logs?.count && logs.count > pageSize && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-sm text-muted-foreground">
                                        {showAll
                                            ? `Showing all ${logs.count} alerts`
                                            : `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, logs.count)} of ${logs.count} alerts`
                                        }
                                    </p>
                                    <div className="flex items-center space-x-2">
                                        {!showAll && (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                                    disabled={page === 1}
                                                >
                                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                                </Button>
                                                <div className="text-sm font-bold bg-muted px-3 py-1 rounded-md">
                                                    {page}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPage(p => p + 1)}
                                                    disabled={page * pageSize >= logs.count}
                                                >
                                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </>
                                        )}
                                        <Button
                                            variant={showAll ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => { setShowAll(!showAll); setPage(1); }}
                                        >
                                            {showAll ? "Paginate" : "All"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AlertsPage;
