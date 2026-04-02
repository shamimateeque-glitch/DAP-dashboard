import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Briefcase,
    Upload,
    CheckCircle,
    FileText,
    AlertCircle,
    BarChart3,
    Settings,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: Briefcase, label: 'All Cases', href: '/cases' },
    { icon: Upload, label: 'Uploaded', href: '/uploaded' },
    { icon: CheckCircle, label: 'Approved', href: '/approved' },
    { icon: FileText, label: 'Invoices', href: '/invoices' },
    { icon: AlertCircle, label: 'Alerts', href: '/alerts' },
    { icon: BarChart3, label: 'Reports', href: '/reports' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 transform lg:translate-x-0 lg:static lg:inset-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between h-16 px-6 border-b lg:justify-center">
                        <div className="flex items-center gap-2">
                            <img src="/DAP-Logo-Ver03.png" alt="DAP Logo" className="h-7 w-auto" />
                            <span className="text-xl font-bold tracking-tight text-[#fea106]">DAP CaseView</span>
                        </div>
                        <button className="lg:hidden" onClick={onClose}>
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                onClick={() => onClose()}
                                className={({ isActive }) => cn(
                                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="mr-3 h-5 w-5" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="p-4 border-t">
                        <div className="flex items-center px-4 py-3 text-sm text-muted-foreground">
                            <span className="truncate">v1.0.0</span>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
