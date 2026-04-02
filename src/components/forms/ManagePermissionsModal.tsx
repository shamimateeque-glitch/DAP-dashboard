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
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { User } from '@/types/database';

const permissionsSchema = z.object({
    cases: z.object({
        view: z.boolean(),
        create: z.boolean(),
        edit: z.boolean(),
    }),
    workflow: z.object({
        view: z.boolean(),
        edit: z.boolean(),
    }),
    invoices: z.object({
        view: z.boolean(),
        edit: z.boolean(),
    }),
    reports: z.object({
        view: z.boolean(),
        export: z.boolean(),
    }),
    alerts: z.object({
        view: z.boolean(),
    }),
    admin: z.object({
        users: z.boolean(),
        settings: z.boolean(),
    }),
});

type PermissionsFormValues = z.infer<typeof permissionsSchema>;

interface ManagePermissionsModalProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ManagePermissionsModal: React.FC<ManagePermissionsModalProps> = ({
    user,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<PermissionsFormValues>({
        resolver: zodResolver(permissionsSchema),
        defaultValues: user?.permissions || {
            cases: { view: true, create: false, edit: false },
            workflow: { view: true, edit: false },
            invoices: { view: true, edit: false },
            reports: { view: true, export: false },
            alerts: { view: false },
            admin: { users: false, settings: false },
        },
    });

    React.useEffect(() => {
        if (user) {
            form.reset(user.permissions);
        }
    }, [user, form]);

    const onSubmit = async (values: PermissionsFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ permissions: values })
                .eq('id', user.id);

            if (error) throw error;

            toast.success('Permissions updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error updating permissions'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const modules = [
        { key: 'cases', label: 'Cases Management', items: ['view', 'create', 'edit'] },
        { key: 'workflow', label: 'Workflow Stages', items: ['view', 'edit'] },
        { key: 'invoices', label: 'Invoicing & Payments', items: ['view', 'edit'] },
        { key: 'reports', label: 'Reporting', items: ['view', 'export'] },
        { key: 'alerts', label: 'Alerts & Reminders', items: ['view'] },
        { key: 'admin', label: 'Administration', items: ['users', 'settings'] },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Manage Permissions</DialogTitle>
                    <DialogDescription>
                        Custom permissions for {user?.full_name}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {modules.map((module) => (
                                <div key={module.key} className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
                                    <h4 className="font-semibold text-sm">{module.label}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {module.items.map((item) => (
                                            <FormField
                                                key={`${module.key}.${item}`}
                                                control={form.control}
                                                name={`${module.key}.${item}` as any}
                                                render={({ field }) => (
                                                    <FormItem className="flex items-center justify-between space-y-0 gap-2">
                                                        <FormLabel className="text-xs capitalize cursor-pointer">
                                                            {item.replace(/_/g, ' ')}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Switch
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Permissions'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default ManagePermissionsModal;
