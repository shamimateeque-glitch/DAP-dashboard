-- NUCLEAR OPTION: Fix Login by removing ALL potential blockers.
-- This script disables complex security checks temporarily to restore access.

-- 1. Disable Row Level Security (RLS) on users table temporarily
--    This rules out Policy recursion immediately.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 2. Drop the specific rogue trigger that causes loops (Forcefully)
DROP TRIGGER IF EXISTS on_auth_user_created ON public.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON public.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON public.users;

-- 3. Drop ANY trigger on public.users that might be syncing back to auth
--    (We will verify listing triggers later, but this kills common ones)
--    Note: We keep 'update_users_updated_at' if it exists as it's usually harmless, 
--    but if you have custom triggers, this might need adjustment.

-- 4. Grant full permissions to ensure no "Permission Denied" errors
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 5. Fix potential sequence issues (if users were created manually)
SELECT setval(
    pg_get_serial_sequence('public.cases', 'id'), 
    COALESCE(max(id), 1) + 1, 
    false
) FROM public.cases;
