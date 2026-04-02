import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/database';

export const usePermissions = () => {
    const { appUser } = useAuth();

    if (!appUser) {
        return {
            isAdmin: false,
            isDataEntry: false,
            isViewOnly: false,
            can: () => false,
            role: null as UserRole | null,
        };
    }

    const { role, permissions } = appUser;

    const can = (module: string, action: string) => {
        // Super Admin can do everything
        if (role === 'SUPER_ADMIN') return true;

        // Check explicit permissions
        if (permissions && (permissions as any)[module]) {
            return !!(permissions as any)[module][action];
        }

        return false;
    };

    return {
        isAdmin: role === 'SUPER_ADMIN',
        isDataEntry: role === 'DATA_ENTRY',
        isViewOnly: role === 'VIEW_ONLY',
        can,
        role,
    };
};
