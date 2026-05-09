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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { CalendarIcon, Edit2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { generateMatterCode, isMatterCodeDuplicate } from '@/lib/codeGenerators';
import DuplicateErrorDialog from '@/components/DuplicateErrorDialog';

const uploadSchema = z.object({
    client: z.enum(['ONEWORLD', 'A.A ASSOCIATES', 'SAFEMARK', 'DAP-IP']),
    matter_code: z.string().optional(),
    upload_date: z.string().default(() => new Date().toISOString().split('T')[0]),
    our_fee_usd: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: 'Fee must be a positive number',
    }),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

interface UploadToClientModalProps {
    caseId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    brandName?: string;
    caseType?: string;
}

const UploadToClientModal: React.FC<UploadToClientModalProps> = ({
    caseId,
    isOpen,
    onClose,
    onSuccess,
    brandName,
    caseType,
}) => {
    const { appUser } = useAuth();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isEditingMatterCode, setIsEditingMatterCode] = React.useState(false);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [duplicateValue, setDuplicateValue] = React.useState<string | null>(null);

    const form = useForm<UploadFormValues>({
        resolver: zodResolver(uploadSchema),
        defaultValues: {
            client: 'ONEWORLD',
            matter_code: '',
            upload_date: new Date().toISOString().split('T')[0],
            our_fee_usd: '',
        },
    });

    const selectedClient = form.watch('client');

    // Auto-generate matter code when modal opens or client changes
    React.useEffect(() => {
        if (!isOpen || !brandName || !caseType) return;

        let cancelled = false;
        const generate = async () => {
            setIsGenerating(true);
            try {
                const code = await generateMatterCode(brandName, caseType, selectedClient);
                if (!cancelled) {
                    form.setValue('matter_code', code);
                    setIsEditingMatterCode(false);
                }
            } catch (err) {
                console.error('Failed to generate matter code:', err);
            } finally {
                if (!cancelled) setIsGenerating(false);
            }
        };
        generate();
        return () => { cancelled = true; };
    }, [isOpen, brandName, caseType, selectedClient, form]);

    const onSubmit = async (values: UploadFormValues) => {
        setIsSubmitting(true);
        try {
            // Duplicate check for matter code
            if (values.matter_code?.trim()) {
                const isDuplicate = await isMatterCodeDuplicate(values.matter_code.trim(), caseId);
                if (isDuplicate) {
                    setDuplicateValue(values.matter_code.trim());
                    setIsSubmitting(false);
                    return;
                }

                const { error: updateError } = await supabase
                    .from('cases')
                    .update({ matter_code: values.matter_code.trim() })
                    .eq('id', caseId);
                if (updateError) throw updateError;
            }

            const { error: uploadError } = await supabase
                .from('case_uploads')
                .insert([
                    {
                        case_id: caseId,
                        client: values.client,
                        upload_date: values.upload_date,
                        our_fee_usd: parseFloat(values.our_fee_usd),
                        created_by: appUser?.id,
                    },
                ]);

            if (uploadError) throw uploadError;

            // Update case_status to UPLOADED
            await supabase.from('cases').update({ case_status: 'UPLOADED' }).eq('id', caseId);

            toast.success('Case uploaded to client successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error uploading case'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (<>
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Upload to Client</DialogTitle>
                    <DialogDescription>
                        Record the submission of this case to a partner client.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="client"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Client</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a client" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="ONEWORLD">OneWorld</SelectItem>
                                            <SelectItem value="A.A ASSOCIATES">A.A Associates</SelectItem>
                                            <SelectItem value="SAFEMARK">SafeMark</SelectItem>
                                            <SelectItem value="DAP-IP">DAP-IP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="matter_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Matter Code</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <FormControl>
                                            {isGenerating ? (
                                                <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Generating...
                                                </div>
                                            ) : (
                                                <Input
                                                    placeholder="Auto-generated matter code"
                                                    {...field}
                                                    readOnly={!isEditingMatterCode}
                                                    className={cn(
                                                        "font-mono",
                                                        !isEditingMatterCode && "bg-muted/50 cursor-default"
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
                                                onClick={() => setIsEditingMatterCode(!isEditingMatterCode)}
                                                title={isEditingMatterCode ? "Lock" : "Edit manually"}
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="upload_date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Upload Date</FormLabel>
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
                        <FormField
                            control={form.control}
                            name="our_fee_usd"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Our Fee (USD)</FormLabel>
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
                                {isSubmitting ? 'Uploading...' : 'Confirm Upload'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
        <DuplicateErrorDialog
            open={!!duplicateValue}
            onClose={() => setDuplicateValue(null)}
            title="Duplicate Matter Code"
            value={duplicateValue || ''}
            description="Each case must have a unique matter code. Please modify the serial number or other parts to create a unique code."
        />
    </>
    );
};

export default UploadToClientModal;
