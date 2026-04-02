-- Fix Database Error Querying Schema by preventing infinite recursion in RLS policies.
-- The issue is that the `is_super_admin` function queries the `public.users` table, which triggers the RLS policy again,
-- causing an infinite loop. We fix this by bypassing RLS in the helper function using explicit SECURITY DEFINER
-- and ensuring the policy doesn't cyclically depend on itself.

-- 1. Redefine the function to be absolutely safe
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges, bypassing RLS
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  );
END;
$$;

-- 2. Drop all conflicting policies on public.users to start fresh
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.users;

-- 3. Re-enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Create Simplified Policies

-- Policy A: Users can READ ONLY their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING ( auth.uid() = auth_user_id );

-- Policy B: Super Admins can READ ALL profiles
-- Note: We use the function, which bypasses RLS, so no recursion
CREATE POLICY "Super Admins can view all profiles"
ON public.users
FOR SELECT
USING ( public.is_super_admin() );

-- Policy C: Super Admins can UPDATE/DELETE ALL profiles
CREATE POLICY "Super Admins can update and delete"
ON public.users
FOR ALL
USING ( public.is_super_admin() );

-- 5. Grant necessary permissions just in case
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
