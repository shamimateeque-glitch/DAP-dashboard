-- FIX: Remove invalid trigger from public.users that causes infinite recursion.
-- The trigger 'on_auth_user_created' belongs on auth.users, NOT public.users.
-- If it exists on public.users, it causes an INSERT loop (Insert -> Trigger -> Insert -> ...).

-- 1. Drop the rogue trigger from public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON public.users;

-- 2. Verify and ensure the correct trigger exists on auth.users
-- We drop it first to be safe and ensure the definition is correct (INSERT ONLY)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Ensure handle_new_user is robust (idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role_enum, 'VIEW_ONLY')
  )
  ON CONFLICT (auth_user_id) DO NOTHING; -- Prevent duplicate key errors
  RETURN NEW;
END;
$$;
