-- EMERGENCY FIX: Drop all relevant policies and disable RLS temporarily to isolate the recursion.
-- Then we re-enable it with a completely safe, non-recursive pattern.

-- 1. Drop existing functions to clear cache issues
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;

-- 2. Clean slate: Drop ALL policies on public.users
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update and delete" ON public.users;
DROP POLICY IF EXISTS "Anyone can select" ON public.users; -- Cleanup any potential leftovers

-- 3. Re-create the secure check function
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  );
$$;

-- 4. Re-apply simplified RLS

-- A. Basic self-access
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING ( auth.uid() = auth_user_id );

-- B. Admin Access (READ)
CREATE POLICY "Admins can view all"
ON public.users
FOR SELECT
USING ( public.check_is_super_admin() );

-- C. Admin Access (WRITE)
CREATE POLICY "Admins can update"
ON public.users
FOR UPDATE
USING ( public.check_is_super_admin() );

CREATE POLICY "Admins can delete"
ON public.users
FOR DELETE
USING ( public.check_is_super_admin() );

-- D. Admin Access (INSERT) - usually triggered by system, but good to have
CREATE POLICY "Admins can insert"
ON public.users
FOR INSERT
WITH CHECK ( public.check_is_super_admin() );

-- 5. Ensure RLS is ON
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 6. Grant Permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.users TO authenticated;
