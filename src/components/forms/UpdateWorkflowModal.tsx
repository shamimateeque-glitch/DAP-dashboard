import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';

const workflowSchema = z.object({
    date_value: z.string().min(1, 'Date is required'),
    status: z.enum(['IN_PROGRESS', 'DONE']),
    notes: z.string().optional(),
    status_date_value: z.string().optional(),
});

type WorkflowFormValues = z.infer<typeof workflowSchema>;

interface UpdateWorkflowModalProps {
    caseId: string;
    stage: 'in_depth' | 'enforcement' | 'destruction';
    caseType?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentData?: any;
}

const UpdateWorkflowModal: React.FC<UpdateWorkflowModalProps> = ({
    caseId,
    stage,
    caseType,
    isOpen,
    onClose,
    onSuccess,
    currentData,
}) => {
    const { appUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const tableName = stage === 'in_depth'
        ? 'in_depth_stages'
        : stage === 'enforcement'
            ? 'enforcement_stages'
            : 'destruction_stages';

    const dateFieldName = 'due_date';

    const stageTitle = stage === 'in_depth'
        ? 'In-Depth Investigation'
        : stage === 'enforcement'
            ? 'Enforcement'
            : 'Destruction Stage';

    const form = useForm<WorkflowFormValues>({
        resolver: zodResolver(workflowSchema),
        defaultValues: {
            date_value: currentData?.[dateFieldName] || new Date().toISOString().split('T')[0],
            status: currentData?.status || 'IN_PROGRESS',
            notes: currentData?.notes || '',
            status_date_value: currentData?.status_date ? new Date(currentData.status_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        },
    });

    // Watch status to conditionally show status_date field
    const status = form.watch('status');

    React.useEffect(() => {
        if (currentData) {
            form.reset({
                date_value: currentData[dateFieldName] || new Date().toISOString().split('T')[0],
                status: currentData.status,
                notes: currentData.notes || '',
                status_date_value: currentData.status_date ? new Date(currentData.status_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            });
        } else {
            form.reset({
                date_value: new Date().toISOString().split('T')[0],
                status: 'IN_PROGRESS',
                notes: '',
                status_date_value: new Date().toISOString().split('T')[0],
            });
        }
    }, [currentData, form, dateFieldName]);

    const onSubmit = async (values: WorkflowFormValues) => {
        setIsSubmitting(true);
        try {
            const payload: any = {
                case_id: caseId,
                [dateFieldName]: values.date_value,
                status: values.status,
                notes: values.notes,
                updated_at: new Date().toISOString(),
            };

            if (values.status === 'DONE') {
                // Use selected date or fallback to now
                const statusDate = values.status_date_value
                    ? new Date(values.status_date_value).toISOString()
                    : new Date().toISOString();
                payload.status_date = statusDate;
            }

            let error;
            if (currentData?.id) {
                const { error: updateError } = await supabase
                    .from(tableName)
                    .update(payload)
                    .eq('id', currentData.id);
                error = updateError;
            } else {
                payload.created_by = appUser?.id;
                const { error: upsertError } = await supabase
                    .from(tableName)
                    .upsert([payload], { onConflict: 'case_id' });
                error = upsertError;
            }

            if (error) throw error;

            // Auto-update case_status based on stage progression
            if (stage === 'in_depth' && values.status === 'IN_PROGRESS') {
                await supabase.from('cases').update({ case_status: 'IN_DEPTH' }).eq('id', caseId);
            }

            // Auto-create OR Update Enforcement Stage if In-Depth is marked DONE (Market only)
            if (stage === 'in_depth' && values.status === 'DONE' && caseType !== 'Customs' && caseType !== 'Custom') {
                const completedDate = new Date(payload.status_date || new Date().toISOString());
                const enforcementTarget = new Date(completedDate);
                enforcementTarget.setDate(completedDate.getDate() + 7);
                const formattedTargetDate = format(enforcementTarget, 'yyyy-MM-dd');

                await supabase
                    .from('enforcement_stages')
                    .upsert([{
                        case_id: caseId,
                        due_date: formattedTargetDate,
                        status: 'IN_PROGRESS',
                        created_by: appUser?.id
                    }], { onConflict: 'case_id' });

                await supabase.from('cases').update({ case_status: 'ENFORCEMENT' }).eq('id', caseId);
                toast.success('Enforcement stage initialized with +7 days');
            }

            if (stage === 'enforcement' && values.status === 'IN_PROGRESS') {
                await supabase.from('cases').update({ case_status: 'ENFORCEMENT' }).eq('id', caseId);
            }

            // Auto-create OR Update Destruction Stage if Enforcement is marked DONE
            if (stage === 'enforcement' && values.status === 'DONE') {
                const completedDate = new Date(payload.status_date || new Date().toISOString());
                const destructionDue = new Date(completedDate);
                destructionDue.setDate(completedDate.getDate() + 1);
                const formattedDueDate = format(destructionDue, 'yyyy-MM-dd');

                const { error: destructionErr } = await supabase
                    .from('destruction_stages')
                    .upsert([{
                        case_id: caseId,
                        due_date: formattedDueDate,
                        status: 'IN_PROGRESS',
                        created_by: appUser?.id
                    }], { onConflict: 'case_id' });
                if (destructionErr) console.error('Failed to create destruction stage:', destructionErr);

                // Auto-create Final Report with PENDING status and due date = enforcement completion + 7 days
                const finalReportDue = new Date(completedDate);
                finalReportDue.setDate(completedDate.getDate() + 7);
                const formattedFinalReportDue = format(finalReportDue, 'yyyy-MM-dd');

                // Try upsert first, fall back to insert if no unique constraint on case_id
                let finalReportErr: any = null;
                const { error: upsertErr } = await supabase
                    .from('final_reports')
                    .upsert([{
                        case_id: caseId,
                        status: 'PENDING',
                        due_date: formattedFinalReportDue,
                        submission_date: formattedFinalReportDue,
                        created_by: appUser?.id
                    }], { onConflict: 'case_id' });

                if (upsertErr) {
                    // Upsert failed — try plain insert
                    console.error('Final report upsert failed:', JSON.stringify(upsertErr));
                    const { error: insertErr } = await supabase
                        .from('final_reports')
                        .insert([{
                            case_id: caseId,
                            status: 'PENDING',
                            due_date: formattedFinalReportDue,
                            submission_date: formattedFinalReportDue,
                            created_by: appUser?.id
                        }]);
                    finalReportErr = insertErr;
                    if (insertErr) console.error('Final report insert also failed:', JSON.stringify(insertErr));
                }

                const { error: statusErr } = await supabase.from('cases').update({ case_status: 'DESTRUCTION' }).eq('id', caseId);
                if (statusErr) console.error('Failed to update case status:', statusErr);

                if (finalReportErr) {
                    toast.warning('Destruction stage created, but Final Report could not be auto-created. Please create it manually.');
                } else {
                    toast.success('Destruction stage initialized with +1 day, Final Report due in 7 days');
                }
            }

            // Update case_status when destruction stage is directly updated
            if (stage === 'destruction' && values.status === 'IN_PROGRESS') {
                await supabase.from('cases').update({ case_status: 'DESTRUCTION' }).eq('id', caseId);
            }

            if (stage === 'destruction' && values.status === 'DONE') {
                await supabase.from('cases').update({ case_status: 'CLOSED' }).eq('id', caseId);
            }

            toast.success(`${stageTitle} updated successfully`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, `Error updating ${stageTitle}`));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Update {stageTitle}</DialogTitle>
                    <DialogDescription>
                        Update the progress and targets for this workflow stage.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="date_value"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Target / Due Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full pl-3 text-left font-normal",
                                                        !field.value && "text-muted-foreground"
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(new Date(field.value + "T00:00:00"), "PPP")
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start" collisionPadding={20}>
                                            <Calendar
                                                mode="single"
                                                captionLayout="dropdown"
                                                fromYear={2020}
                                                toYear={new Date().getFullYear() + 5}
                                                selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                            <SelectItem value="DONE">Done</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {status === 'DONE' && (
                            <FormField
                                control={form.control}
                                name="status_date_value"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Completion Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(new Date(field.value + "T00:00:00"), "PPP")
                                                        ) : (
                                                            <span>Pick a completion date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start" collisionPadding={20}>
                                                <Calendar
                                                    mode="single"
                                                    captionLayout="dropdown"
                                                    fromYear={2020}
                                                    toYear={new Date().getFullYear() + 5}
                                                    selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                                                    onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes / Observations</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter any updates or notes here..."
                                            className="min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Updates'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default UpdateWorkflowModal;
