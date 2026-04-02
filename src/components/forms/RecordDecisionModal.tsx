import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
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

const decisionSchema = z.object({
    decision_status: z.enum(['APPROVED', 'REJECTED']),
    decision_date: z.string().default(() => new Date().toISOString().split('T')[0]),
});

type DecisionFormValues = z.infer<typeof decisionSchema>;

interface RecordDecisionModalProps {
    caseId: string;
    caseType?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const RecordDecisionModal: React.FC<RecordDecisionModalProps> = ({
    caseId,
    caseType,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<DecisionFormValues>({
        resolver: zodResolver(decisionSchema),
        defaultValues: {
            decision_status: 'APPROVED',
            decision_date: new Date().toISOString().split('T')[0],
        },
    });

    const onSubmit = async (values: DecisionFormValues) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('case_uploads')
                .update({
                    decision_status: values.decision_status,
                    decision_date: values.decision_date,
                })
                .eq('case_id', caseId);

            if (error) throw error;

            // Update case_status based on decision
            if (values.decision_status === 'APPROVED') {
                const isCustoms = caseType === 'Customs' || caseType === 'Custom';
                const decisionDate = new Date(values.decision_date + 'T12:00:00');

                if (isCustoms) {
                    // CUSTOMS: Skip in-depth → create enforcement directly (+15 days)
                    await supabase.from('cases').update({ case_status: 'ENFORCEMENT' }).eq('id', caseId);

                    const targetDate = new Date(decisionDate);
                    targetDate.setDate(decisionDate.getDate() + 15);
                    const formattedTargetDate = format(targetDate, 'yyyy-MM-dd');

                    await supabase
                        .from('enforcement_stages')
                        .upsert([{
                            case_id: caseId,
                            due_date: formattedTargetDate,
                            status: 'IN_PROGRESS',
                            updated_at: new Date().toISOString()
                        }], { onConflict: 'case_id' });
                } else {
                    // MARKET: Create in-depth stage (+7 days)
                    await supabase.from('cases').update({ case_status: 'APPROVED' }).eq('id', caseId);

                    const targetDate = new Date(decisionDate);
                    targetDate.setDate(decisionDate.getDate() + 7);
                    const formattedTargetDate = format(targetDate, 'yyyy-MM-dd');

                    await supabase
                        .from('in_depth_stages')
                        .upsert([{
                            case_id: caseId,
                            due_date: formattedTargetDate,
                            status: 'IN_PROGRESS',
                            updated_at: new Date().toISOString()
                        }], { onConflict: 'case_id' });
                }
            } else if (values.decision_status === 'REJECTED') {
                await supabase.from('cases').update({ case_status: 'REJECTED' }).eq('id', caseId);
            }

            toast.success(`Case ${values.decision_status.toLowerCase()} successfully`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error recording decision'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Client Decision</DialogTitle>
                    <DialogDescription>
                        Update the case based on the client's approval or rejection.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="decision_status"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Decision</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-1"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0">
                                                <FormControl>
                                                    <RadioGroupItem value="APPROVED" />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer">
                                                    Approved
                                                </FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0 text-destructive">
                                                <FormControl>
                                                    <RadioGroupItem value="REJECTED" />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer">
                                                    Rejected
                                                </FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="decision_date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Decision Date</FormLabel>
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
                                                fromYear={1900}
                                                toYear={new Date().getFullYear() + 2}
                                                selected={field.value ? new Date(field.value + "T00:00:00") : undefined}
                                                onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                disabled={(date) => {
                                                    const today = new Date();
                                                    today.setHours(23, 59, 59, 999);
                                                    return date > today || date < new Date("1900-01-01");
                                                }}
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
                                {isSubmitting ? 'Recording...' : 'Record Decision'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default RecordDecisionModal;
