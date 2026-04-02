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
import { Button } from '@/components/ui/button';
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

const reportSchema = z.object({
    submission_date: z.string().min(1, 'Submission date is required'),
});

type ReportFormValues = z.infer<typeof reportSchema>;

interface SubmitFinalReportModalProps {
    caseId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const SubmitFinalReportModal: React.FC<SubmitFinalReportModalProps> = ({
    caseId,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { appUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<ReportFormValues>({
        resolver: zodResolver(reportSchema),
        defaultValues: {
            submission_date: new Date().toISOString().split('T')[0],
        },
    });

    const onSubmit = async (values: ReportFormValues) => {
        setIsSubmitting(true);
        try {
            // Update existing PENDING record to DONE (auto-created when enforcement completed)
            const { error } = await supabase
                .from('final_reports')
                .update({
                    status: 'DONE',
                    submission_date: values.submission_date,
                    status_date: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('case_id', caseId);

            // Fallback: if no record existed, upsert one
            if (error) {
                const { error: upsertError } = await supabase
                    .from('final_reports')
                    .upsert([{
                        case_id: caseId,
                        status: 'DONE',
                        submission_date: values.submission_date,
                        status_date: new Date().toISOString(),
                        created_by: appUser?.id,
                    }], { onConflict: 'case_id' });
                if (upsertError) throw upsertError;
            }

            // NOTE: case_status is NOT updated here — Final Report does not affect the main workflow

            toast.success('Final report submitted successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error submitting final report'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Submit Final Report</DialogTitle>
                    <DialogDescription>
                        Record the date when the final report was submitted to the client.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="submission_date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Submission Date</FormLabel>
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
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                captionLayout="dropdown-buttons"
                                                fromYear={2020}
                                                toYear={new Date().getFullYear() + 1}
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

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Submitting...' : 'Submit Report'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default SubmitFinalReportModal;
