import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing. Please check your .env file.');
}

// In the native Capacitor shell, localStorage in the WebView can be cleared by the OS,
// which silently logs users out. Use @capacitor/preferences (native key-value store)
// as the auth storage adapter on device; fall back to the default (localStorage) on web.
const nativeStorage = {
    getItem: (key: string) => Preferences.get({ key }).then(({ value }) => value),
    setItem: (key: string, value: string) => Preferences.set({ key, value }).then(() => undefined),
    removeItem: (key: string) => Preferences.remove({ key }).then(() => undefined),
};

const isNative = Capacitor.isNativePlatform();

export const supabase = createClient<any>(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            // No URL-based session detection inside the native WebView (no OAuth redirect there).
            detectSessionInUrl: !isNative,
            flowType: 'pkce',
            storageKey: 'dap-auth',
            ...(isNative ? { storage: nativeStorage } : {}),
        },
        global: {
            headers: { 'x-application-name': 'dap-caseview' },
        },
    }
);
