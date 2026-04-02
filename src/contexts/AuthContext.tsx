import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { User as AppUser } from '@/types/database';

interface AuthContextType {
    user: SupabaseUser | null;
    appUser: AppUser | null;
    session: Session | null;
    loading: boolean;
    authError: string | null;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    const appUserRef = React.useRef(appUser);
    const isFetchingRef = React.useRef(false);
    const initializedRef = React.useRef(false);

    useEffect(() => {
        appUserRef.current = appUser;
    }, [appUser]);

    const fetchAppUser = useCallback(async (authUserId: string) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setAuthError(null);

        let attempts = 0;
        const maxAttempts = 3;

        try {
            while (attempts < maxAttempts) {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('auth_user_id', authUserId)
                        .single();

                    if (error) {
                        if (attempts === maxAttempts - 1) {
                            setAuthError('Unable to load your user profile. Please contact an administrator.');
                            break;
                        } else {
                            await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));
                            attempts++;
                            continue;
                        }
                    }

                    if (data) {
                        if (!data.is_active) {
                            setAuthError('Your account has been deactivated. Please contact an administrator.');
                            setAppUser(null);
                            await supabase.auth.signOut();
                            break;
                        }
                        setAppUser(data);
                        break;
                    } else {
                        setAuthError('No user profile found for your account. Please contact an administrator.');
                        break;
                    }
                } catch (error) {
                    attempts++;
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        // 1. Get initial session (runs once on mount)
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (!mounted) return;
                if (error) throw error;

                setSession(session);
                setUser(session?.user ?? null);
                initializedRef.current = true;

                if (session?.user) {
                    await fetchAppUser(session.user.id);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        // 2. Listen for SUBSEQUENT auth changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;

            // Skip if this is the initial event — already handled by initAuth
            if (!initializedRef.current) return;

            if (_event === 'SIGNED_OUT' || !session) {
                setSession(null);
                setUser(null);
                setAppUser(null);
                setLoading(false);
                return;
            }

            // TOKEN_REFRESHED with same user — no need to re-fetch
            if (_event === 'TOKEN_REFRESHED' && appUserRef.current) {
                setSession(session);
                return;
            }

            setSession(session);
            setUser(session.user);

            if (session.user) {
                // Already have this user's profile
                if (appUserRef.current?.auth_user_id === session.user.id) {
                    setLoading(false);
                    return;
                }

                setLoading(true);
                await fetchAppUser(session.user.id);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchAppUser]);

    const refreshUser = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single();
        if (data) setAppUser(data);
    }, []);

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            // Sign out failed — state will be reset in finally block
        } finally {
            setSession(null);
            setUser(null);
            setAppUser(null);
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    }, []);

    const value = useMemo(() => ({
        user, appUser, session, loading, authError, signOut, refreshUser
    }), [user, appUser, session, loading, authError, signOut, refreshUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
