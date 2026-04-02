-- FIX: VIEW_ONLY users unable to login
--
-- Root cause: The RLS policies on public.users were in a broken state.
-- The "nuclear" migration disabled RLS, but subsequent migrations may have
-- re-enabled it with an INSERT policy that only allows SUPER_ADMIN.
-- This means the handle_new_user trigger could fail to create a profile
-- for VIEW_ONLY users, leaving them with no public.users row.
--
-- This migration:
-- 1. Ensures RLS is enabled on public.users with correct policies
-- 2. Fixes the INSERT policy so the trigger can always create user profiles
-- 3. Ensures all existing auth users have a public.users profile
-- 4. Ensures the handle_new_user trigger is correctly set up

-- ============================================================
-- STEP 1: Clean slate on public.users RLS policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update and delete" ON public.users;
DROP POLICY IF EXISTS "Admins can view all" ON public.users;
DROP POLICY IF EXISTS "Admins can update" ON public.users;
DROP POLICY IF EXISTS "Admins can delete" ON public.users;
DROP POLICY IF EXISTS "Admins can insert" ON public.users;
DROP POLICY IF EXISTS "Anyone can select" ON public.users;

-- ============================================================
-- STEP 2: Re-create the admin check function (SECURITY DEFINER bypasses RLS)
-- ============================================================
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

-- ============================================================
-- STEP 3: Enable RLS and create correct policies
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- A. Any authenticated user can read their OWN profile (needed for login)
CREATE POLICY "users_select_own"
ON public.users FOR SELECT
USING (auth.uid() = auth_user_id);

-- B. Super admins can read ALL profiles (needed for user management)
CREATE POLICY "users_select_admin"
ON public.users FOR SELECT
USING (public.check_is_super_admin());

-- C. Super admins can update any profile
CREATE POLICY "users_update_admin"
ON public.users FOR UPDATE
USING (public.check_is_super_admin());

-- D. Super admins can delete profiles
CREATE POLICY "users_delete_admin"
ON public.users FOR DELETE
USING (public.check_is_super_admin());

-- E. INSERT: Allow the service role and SECURITY DEFINER functions to insert.
--    This is the KEY FIX: we allow any authenticated INSERT so the trigger works.
--    The trigger itself runs as SECURITY DEFINER, but we also need this for the
--    admin_create_user RPC function.
CREATE POLICY "users_insert_service"
ON public.users FOR INSERT
WITH CHECK (true);

-- ============================================================
-- STEP 4: Ensure the handle_new_user trigger function is correct
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_str text;
  v_role_enum public.user_role_enum;
BEGIN
  v_role_str := COALESCE(NEW.raw_user_meta_data->>'role', 'VIEW_ONLY');

  BEGIN
    v_role_enum := v_role_str::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    v_role_enum := 'VIEW_ONLY';
  END;

  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role_enum,
    true
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role = COALESCE(EXCLUDED.role, public.users.role);

  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 5: Ensure the trigger exists on auth.users
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- STEP 6: Backfill any auth users that are missing a public.users profile
-- This catches VIEW_ONLY users whose profiles were never created
-- ============================================================
INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  COALESCE(
    NULLIF(au.raw_user_meta_data->>'role', '')::public.user_role_enum,
    'VIEW_ONLY'
  ),
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.auth_user_id = au.id
)
ON CONFLICT (auth_user_id) DO NOTHING;

-- ============================================================
-- STEP 7: Ensure all existing users are active (in case they were incorrectly deactivated)
-- Only activate users that have is_active = false AND were not intentionally deactivated.
-- We'll set all to active - admin can deactivate again if needed.
-- ============================================================
-- (Commented out - uncomment if you want to force-activate all users)
-- UPDATE public.users SET is_active = true WHERE is_active = false;

-- ============================================================
-- STEP 8: Grant permissions
-- ============================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
