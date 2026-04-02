import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Camera, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeErrorMessage, validateImageFile } from '@/lib/security';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
    const { appUser, user, refreshUser } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setFullName(appUser?.full_name || '');
            setEmail(user?.email || '');
        }
    }, [isOpen, appUser, user]);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase();
    };

    const handleSaveProfile = async () => {
        if (!appUser) return;
        setIsSaving(true);

        try {
            const nameChanged = fullName.trim() !== appUser.full_name;
            const emailChanged = email.trim() !== user?.email;

            if (!nameChanged && !emailChanged) {
                toast.info('No changes to save.');
                return;
            }

            // Update full_name in users table
            if (nameChanged) {
                const { error } = await supabase
                    .from('users')
                    .update({ full_name: fullName.trim() })
                    .eq('id', appUser.id);
                if (error) throw error;
            }

            // Update email via Supabase Auth
            if (emailChanged) {
                const { error } = await supabase.auth.updateUser({ email: email.trim() });
                if (error) throw error;
                toast.success('Confirmation email sent. Check your inbox to verify the new email.');
            } else {
                toast.success('Profile updated!');
            }

            await refreshUser();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error saving profile'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];

        const validation = validateImageFile(file);
        if (!validation.valid) {
            toast.error(validation.error!);
            return;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${appUser?.id}-${Math.random()}.${fileExt}`;

        setIsUploading(true);

        try {
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', appUser?.id);

            if (updateError) throw updateError;

            toast.success('Profile picture updated!');
            await refreshUser();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error uploading image'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Profile Settings</DialogTitle>
                    <DialogDescription>
                        Update your profile information and picture.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-border shadow-sm">
                            <Avatar className="h-full w-full">
                                <AvatarImage src={appUser?.avatar_url} className="object-cover" />
                                <AvatarFallback className="text-2xl bg-muted">
                                    {appUser?.full_name ? getInitials(appUser.full_name) : <User />}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <Camera className="h-8 w-8 text-white" />
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileChange}
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                disabled={isUploading}
                                title="Change profile picture"
                            />
                        </div>
                        {isUploading && (
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Uploading...
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Change Picture
                        </Button>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Your email"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="role">Role</Label>
                        <Input id="role" value={appUser?.role || ''} readOnly className="bg-muted uppercase" />
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProfileSettingsModal;
