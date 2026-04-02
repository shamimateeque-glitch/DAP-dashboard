import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Per-user preference persistence (Supabase + localStorage fallback)
// ---------------------------------------------------------------------------
// Each preference is stored as a row in user_preferences table:
//   { user_id, preference_key, preference_value (jsonb) }
// localStorage is used as a fast cache so the UI loads instantly.
// ---------------------------------------------------------------------------

/**
 * Load a preference for the given user.
 * 1. Try localStorage first (instant).
 * 2. Fetch from Supabase in background and update localStorage.
 * Returns the value from Supabase if available, otherwise localStorage.
 */
export async function loadPreference<T>(
    userId: string,
    key: string,
    defaultValue: T
): Promise<T> {
    // 1) Try Supabase first (source of truth)
    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('preference_value')
            .eq('user_id', userId)
            .eq('preference_key', key)
            .maybeSingle();

        if (!error && data?.preference_value != null) {
            // Cache to localStorage for faster next load
            try {
                localStorage.setItem(`pref_${key}`, JSON.stringify(data.preference_value));
            } catch { /* ignore */ }
            return data.preference_value as T;
        }
    } catch {
        // Supabase unavailable — fall through to localStorage
    }

    // 2) Fallback: localStorage
    try {
        const cached = localStorage.getItem(`pref_${key}`);
        if (cached) return JSON.parse(cached) as T;
    } catch { /* ignore */ }

    return defaultValue;
}

/**
 * Save a preference for the given user.
 * Writes to both localStorage (instant) and Supabase (persisted).
 */
export async function savePreference<T>(
    userId: string,
    key: string,
    value: T
): Promise<void> {
    // 1) Cache to localStorage immediately
    try {
        localStorage.setItem(`pref_${key}`, JSON.stringify(value));
    } catch { /* ignore */ }

    // 2) Upsert to Supabase (non-blocking)
    try {
        await supabase
            .from('user_preferences')
            .upsert(
                {
                    user_id: userId,
                    preference_key: key,
                    preference_value: value,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,preference_key' }
            );
    } catch {
        // Silently fail — localStorage still has the value
        console.warn(`Failed to save preference "${key}" to Supabase`);
    }
}

/**
 * Load a preference synchronously from localStorage only (for initial render).
 * This avoids a loading flash — Supabase data will overwrite once fetched.
 */
export function loadPreferenceSync<T>(key: string, defaultValue: T): T {
    try {
        const cached = localStorage.getItem(`pref_${key}`);
        if (cached) return JSON.parse(cached) as T;
    } catch { /* ignore */ }
    return defaultValue;
}
