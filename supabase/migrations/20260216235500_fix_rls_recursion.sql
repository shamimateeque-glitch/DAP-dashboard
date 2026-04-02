-- Create a secure function to check admin status without triggering recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.users;
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.users;

-- Recreate policies using the secure function
CREATE POLICY "Super Admins can view all profiles"
ON public.users
FOR SELECT
USING ( public.is_super_admin() );

CREATE POLICY "Super Admins can update all profiles"
ON public.users
FOR UPDATE
USING ( public.is_super_admin() );

CREATE POLICY "Super Admins can delete profiles"
ON public.users
FOR DELETE
USING ( public.is_super_admin() );
