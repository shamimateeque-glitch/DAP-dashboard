import React, { useState } from 'react';
import { Menu, User, LogOut, Bell } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ProfileSettingsModal from '@/components/forms/ProfileSettingsModal';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const { user, appUser, signOut } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase();
    };

    return (
        <header className="h-16 bg-card border-b px-4 lg:px-8 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
                    <Menu className="h-6 w-6" />
                </Button>
                <h1 className="text-lg font-semibold lg:text-xl hidden sm:block">
                    Operations Management
                </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
                <Button variant="ghost" size="icon" className="relative text-muted-foreground">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-card" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="relative h-9 w-9 rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none">
                            <Avatar className="h-9 w-9 border cursor-pointer hover:border-primary transition-colors">
                                <AvatarImage src={appUser?.avatar_url} className="object-cover" />
                                <AvatarFallback className="bg-primary text-primary-foreground font-medium select-none">
                                    {appUser?.full_name ? getInitials(appUser.full_name) : <User className="h-5 w-5" />}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount sideOffset={8}>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{appUser?.full_name || 'User'}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setIsProfileOpen(true)}>
                            <User className="mr-2 h-4 w-4" />
                            <span>Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={signOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <ProfileSettingsModal
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
            />
        </header>
    );
};

export default Header;
