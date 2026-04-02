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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { User, UserRole } from '@/types/database';

const editUserSchema = z.object({
    full_name: z.string().min(2, 'Full name is required'),
    role: z.enum(['SUPER_ADMIN', 'DATA_ENTRY', 'VIEW_ONLY']),
});

type EditUserFormValues = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
    user,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const form = useForm<EditUserFormValues>({
        resolver: zodResolver(editUserSchema),
        defaultValues: {
            full_name: user?.full_name || '',
            role: user?.role || 'VIEW_ONLY',
        },
    });

    React.useEffect(() => {
        if (user) {
            form.reset({
                full_name: user.full_name,
                role: user.role,
            });
        }
    }, [user, form]);

    const onSubmit = async (values: EditUserFormValues) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({
                    full_name: values.full_name,
                    role: values.role,
                })
                .eq('id', user.id);

            if (error) throw error;

            toast.success('User updated successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error updating user'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                    <DialogDescription>
                        Update name and role for {user?.email}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="full_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                                            <SelectItem value="DATA_ENTRY">Data Entry</SelectItem>
                                            <SelectItem value="VIEW_ONLY">View Only</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default EditUserModal;
