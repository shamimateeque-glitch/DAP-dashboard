-- FIX: Robust User Creation & Cleanup
-- 1. Safe-guard the handle_new_user function against invalid Enum values
-- 2. Ensure only the INSERT trigger exists (no hidden UPDATE triggers)

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
  -- Extract role string safely
  v_role_str := COALESCE(NEW.raw_user_meta_data->>'role', 'VIEW_ONLY');
  
  -- Attempt to cast, defaulting to VIEW_ONLY if it fails
  BEGIN
    v_role_enum := v_role_str::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    v_role_enum := 'VIEW_ONLY';
  END;

  INSERT INTO public.users (auth_user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role_enum
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
    
  RETURN NEW;
END;
$$;

-- 2. Reset Triggers on auth.users (Drop potentially bad UPDATE triggers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users; -- Just in case
DROP TRIGGER IF EXISTS on_user_update ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Cleanup the problematic user (So you can recreate them cleanly)
DELETE FROM auth.users WHERE email = 'erum.ateeque@gmail.com';
DELETE FROM public.users WHERE email = 'erum.ateeque@gmail.com';
