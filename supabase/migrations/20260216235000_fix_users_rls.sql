-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING ( auth.uid() = auth_user_id );

-- Policy: Super Admins can view all profiles
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
CREATE POLICY "Super Admins can view all profiles"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- Policy: Super Admins can update all profiles
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.users;
CREATE POLICY "Super Admins can update all profiles"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);

-- Policy: Super Admins can delete profiles
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.users;
CREATE POLICY "Super Admins can delete profiles"
ON public.users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);
