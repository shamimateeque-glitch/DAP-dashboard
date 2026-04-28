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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { useAuth } from '@/contexts/AuthContext';

const invoiceStatusSchema = z.object({
    status: z.enum(['ISSUED', 'PAID', 'NOT_PAID']),
    status_date: z.string().min(1, 'Status date is required'),
});

type InvoiceStatusFormValues = z.infer<typeof invoiceStatusSchema>;

interface UpdateInvoiceStatusModalProps {
    invoiceId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentStatus?: string;
    currentStatusDate?: string;
}

const UpdateInvoiceStatusModal: React.FC<UpdateInvoiceStatusModalProps> = ({
    invoiceId,
    isOpen,
    onClose,
    onSuccess,
    currentStatus,
    currentStatusDate,
}) => {
    const { appUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<InvoiceStatusFormValues>({
        resolver: zodResolver(invoiceStatusSchema),
        defaultValues: {
            status: (currentStatus === 'ISSUED' ? 'NOT_PAID' : currentStatus as any) || 'NOT_PAID',
            status_date: currentStatusDate || new Date().toISOString().split('T')[0],
        },
    });

    React.useEffect(() => {
        if (isOpen) {
            form.reset({
                status: (currentStatus === 'ISSUED' ? 'NOT_PAID' : currentStatus as any) || 'NOT_PAID',
                status_date: currentStatusDate || new Date().toISOString().split('T')[0],
            });
        }
    }, [isOpen, currentStatus, currentStatusDate, form]);

    const onSubmit = async (values: InvoiceStatusFormValues) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('invoices')
                .update({
                    status: values.status,
                    status_date: new Date(values.status_date).toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', invoiceId);

            if (error) throw error;

            toast.success('Invoice status updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error updating invoice status'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Paid or Unpaid</DialogTitle>
                    <DialogDescription>
                        Update the payment status of this invoice.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
                                            <SelectItem value="PAID">Paid</SelectItem>
                                            <SelectItem value="NOT_PAID">Unpaid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="status_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Date of Status Change</FormLabel>
                                    <FormControl>
                                        <input
                                            type="date"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Updating...' : 'Update Status'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default UpdateInvoiceStatusModal;
