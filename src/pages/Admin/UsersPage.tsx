import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    Search,
    UserPlus,
    Shield,
    MoreVertical,
    Edit,
    UserMinus,
    UserCheck,
    RefreshCcw,
    KeyRound
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sanitizeErrorMessage } from '@/lib/security';
import { User, UserRole } from '@/types/database';
import AddUserModal from '@/components/forms/AddUserModal';
import ManagePermissionsModal from '@/components/forms/ManagePermissionsModal';
import EditUserModal from '@/components/forms/EditUserModal';

const UsersPage = () => {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = React.useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
    const [isDeactivateOpen, setIsDeactivateOpen] = React.useState(false);
    const [userToDeactivate, setUserToDeactivate] = React.useState<User | null>(null);
    const [isResetPasswordOpen, setIsResetPasswordOpen] = React.useState(false);
    const [userToReset, setUserToReset] = React.useState<User | null>(null);
    const [newPassword, setNewPassword] = React.useState('');

    const { data: users, isLoading, error } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('full_name');
            if (error) throw error;
            return data as User[];
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async ({ userId, password }: { userId: string, password: string }) => {
            const { data, error } = await supabase.rpc('admin_reset_password', {
                p_user_id: userId,
                p_new_password: password,
            });
            if (error) throw error;
            if (data && data.error) throw new Error(data.error);
        },
        onSuccess: () => {
            toast.success('Password reset successfully');
            setIsResetPasswordOpen(false);
            setUserToReset(null);
            setNewPassword('');
        },
        onError: (error: any) => {
            toast.error(sanitizeErrorMessage(error, 'Error resetting password'));
        }
    });

    const toggleStatusMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string, isActive: boolean }) => {
            const { error } = await supabase
                .from('users')
                .update({ is_active: isActive })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('User status updated');
        },
        onError: (error: any) => {
            toast.error(sanitizeErrorMessage(error, 'Error updating user status'));
        }
    });

    const filteredUsers = users?.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case 'SUPER_ADMIN':
                return <Badge className="bg-purple-500 hover:bg-purple-600">Super Admin</Badge>;
            case 'DATA_ENTRY':
                return <Badge className="bg-blue-500 hover:bg-blue-600">Data Entry</Badge>;
            case 'VIEW_ONLY':
                return <Badge variant="secondary">View Only</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
                    <p className="text-muted-foreground">Manage system users, roles, and permissions.</p>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => setIsAddModalOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" /> Add New User
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle>System Users</CardTitle>
                            <CardDescription>A list of all users with access to the dashboard.</CardDescription>
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <RefreshCcw className="h-4 w-4 animate-spin text-primary" />
                                                <span>Loading users...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers?.map((user) => (
                                        <TableRow key={user.id} className="group transition-colors">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground">{user.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{user.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {getRoleBadge(user.role)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={user.is_active ? 'success' : 'destructive'}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {Object.entries(user.permissions || {}).map(([key, perms]: [string, any]) => {
                                                        const hasAny = Object.values(perms).some(v => v === true);
                                                        if (!hasAny) return null;
                                                        return (
                                                            <div key={key} className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border">
                                                                <Shield className="h-2.5 w-2.5" />
                                                                <span className="capitalize">{key}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setIsEditModalOpen(true);
                                                            }}
                                                        >
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setIsPermissionModalOpen(true);
                                                            }}
                                                        >
                                                            <Shield className="mr-2 h-4 w-4" /> Manage Permissions
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="cursor-pointer"
                                                            onClick={() => {
                                                                setUserToReset(user);
                                                                setNewPassword('');
                                                                setIsResetPasswordOpen(true);
                                                            }}
                                                        >
                                                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        {user.is_active ? (
                                                            <DropdownMenuItem
                                                                className="text-destructive cursor-pointer"
                                                                onClick={() => {
                                                                    setUserToDeactivate(user);
                                                                    setIsDeactivateOpen(true);
                                                                }}
                                                            >
                                                                <UserMinus className="mr-2 h-4 w-4" /> Deactivate Account
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                className="text-green-600 cursor-pointer"
                                                                onClick={() => toggleStatusMutation.mutate({ id: user.id, isActive: true })}
                                                            >
                                                                <UserCheck className="mr-2 h-4 w-4" /> Reactivate Account
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AddUserModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
            />

            <ManagePermissionsModal
                user={selectedUser}
                isOpen={isPermissionModalOpen}
                onClose={() => {
                    setIsPermissionModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
            />

            <EditUserModal
                user={selectedUser}
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
            />

            <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate User Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will prevent {userToDeactivate?.full_name} from logging in.
                            You can reactivate the account later if needed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (userToDeactivate) {
                                    toggleStatusMutation.mutate({ id: userToDeactivate.id, isActive: false });
                                    setIsDeactivateOpen(false);
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Password</AlertDialogTitle>
                        <AlertDialogDescription>
                            Set a new password for {userToReset?.full_name} ({userToReset?.email}).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            type="text"
                            placeholder="Enter new password (min 6 characters)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => { setNewPassword(''); setUserToReset(null); }}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                            onClick={() => {
                                if (userToReset && newPassword.length >= 6) {
                                    resetPasswordMutation.mutate({ userId: userToReset.id, password: newPassword });
                                }
                            }}
                        >
                            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UsersPage;
