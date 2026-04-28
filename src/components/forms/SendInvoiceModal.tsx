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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, format } from 'date-fns';
import { Edit2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { getPaymentTermDays } from '@/lib/paymentTerms';
import { generateInvoiceNumber, isInvoiceNumberDuplicate } from '@/lib/codeGenerators';
import DuplicateErrorDialog from '@/components/DuplicateErrorDialog';

const invoiceSchema = z.object({
    invoice_number: z.string().min(1, 'Invoice number is required'),
    issue_date: z.string().default(() => new Date().toISOString().split('T')[0]),
    due_date: z.string().min(1, 'Due date is required'),
    amount_usd: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: 'Amount must be a positive number',
    }),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface SendInvoiceModalProps {
    caseId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultAmount?: number | string;
    clientName?: string;
    finalReportDate?: string;
    brandName?: string;
    caseType?: string;
}

const SendInvoiceModal: React.FC<SendInvoiceModalProps> = ({
    caseId,
    isOpen,
    onClose,
    onSuccess,
    defaultAmount,
    clientName,
    brandName,
    caseType,
}) => {
    const { appUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditingInvoiceNumber, setIsEditingInvoiceNumber] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [duplicateValue, setDuplicateValue] = React.useState<string | null>(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            invoice_number: '',
            issue_date: todayStr,
            due_date: format(addDays(new Date(todayStr + 'T00:00:00'), getPaymentTermDays(clientName)), 'yyyy-MM-dd'),
            amount_usd: defaultAmount?.toString() || '',
        },
    });

    // Keep due_date in sync with issue_date: due_date = issue_date + payment term days
    const watchedIssueDate = form.watch('issue_date');
    React.useEffect(() => {
        if (!watchedIssueDate) return;
        const days = getPaymentTermDays(clientName);
        const newDueDate = format(addDays(new Date(watchedIssueDate + 'T00:00:00'), days), 'yyyy-MM-dd');
        if (form.getValues('due_date') !== newDueDate) {
            form.setValue('due_date', newDueDate, { shouldDirty: false });
        }
    }, [watchedIssueDate, clientName, form]);

    // Reset form and auto-generate invoice number when modal opens
    React.useEffect(() => {
        if (isOpen) {
            const days = getPaymentTermDays(clientName);
            const today = new Date().toISOString().split('T')[0];
            form.reset({
                invoice_number: '',
                issue_date: today,
                due_date: format(addDays(new Date(today + 'T00:00:00'), days), 'yyyy-MM-dd'),
                amount_usd: defaultAmount !== undefined && defaultAmount !== null ? defaultAmount.toString() : '',
            });
            setIsEditingInvoiceNumber(false);

            // Auto-generate invoice number
            if (brandName && caseType && clientName) {
                let cancelled = false;
                setIsGenerating(true);
                generateInvoiceNumber(brandName, caseType, clientName)
                    .then((code) => {
                        if (!cancelled) {
                            form.setValue('invoice_number', code);
                        }
                    })
                    .catch((err) => {
                        console.error('Failed to generate invoice number:', err);
                    })
                    .finally(() => {
                        if (!cancelled) setIsGenerating(false);
                    });
                return () => { cancelled = true; };
            }
        }
    }, [isOpen, defaultAmount, clientName, brandName, caseType, form]);

    const onSubmit = async (values: InvoiceFormValues) => {
        setIsSubmitting(true);
        try {
            // Duplicate check for invoice number
            const isDuplicate = await isInvoiceNumberDuplicate(values.invoice_number.trim());
            if (isDuplicate) {
                setDuplicateValue(values.invoice_number.trim());
                setIsSubmitting(false);
                return;
            }

            const payload: any = {
                case_id: caseId,
                issue_date: values.issue_date,
                due_date: values.due_date,
                amount_usd: parseFloat(values.amount_usd),
                status: 'NOT_PAID',
                created_by: appUser?.id,
            };

            payload.invoice_number = values.invoice_number.trim();

            const { error } = await supabase
                .from('invoices')
                .insert([payload]);

            if (error) throw error;

            toast.success('Invoice sent successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error sending invoice'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (<>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Invoice</DialogTitle>
                    <DialogDescription>
                        Send an invoice for this approved case.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="invoice_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Invoice #</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            {isGenerating ? (
                                                <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Generating...
                                                </div>
                                            ) : (
                                                <Input
                                                    placeholder="Auto-generated invoice number"
                                                    {...field}
                                                    readOnly={!isEditingInvoiceNumber}
                                                    className={cn(
                                                        "font-mono",
                                                        !isEditingInvoiceNumber && "bg-muted/50 cursor-default"
                                                    )}
                                                />
                                            )}
                                        </FormControl>
                                        {!isGenerating && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 shrink-0"
                                                onClick={() => setIsEditingInvoiceNumber(!isEditingInvoiceNumber)}
                                                title={isEditingInvoiceNumber ? "Lock" : "Edit manually"}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="issue_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Issue Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="due_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Due Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="amount_usd"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Amount (USD)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting || isGenerating}>
                                {isSubmitting ? 'Updating...' : 'Update Invoice'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <DuplicateErrorDialog
            open={!!duplicateValue}
            onClose={() => setDuplicateValue(null)}
            title="Duplicate Invoice Number"
            value={duplicateValue || ''}
            description="Each invoice must have a unique number. Please modify the serial number or other parts to create a unique number."
        />
    </>);
};

export default SendInvoiceModal;
