-- FIX: Enable PGCrypto Extension in 'extensions' schema or force 'public'.
-- Sometimes extensions are installed in a separate schema (like 'extensions') and valid search path is needed.

-- 1. Try to create the extension explicitly in 'public' if not there
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- 2. If it says it exists but is in another schema, we need to ensure our function can find it.
-- We will update the function to explicitly use 'public.gen_salt' or 'extensions.gen_salt' if we knew for sure.
-- But safer is to just ensure the search_path includes where extensions are.

-- 3. Re-define the RPC function to be robust about the extension path
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions -- Add 'extensions' to search path in case pgcrypto is there
AS $$
DECLARE
  v_uid uuid;
  v_role_enum public.user_role_enum;
  v_exists boolean;
BEGIN
  -- Check Permissions
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- Check Email
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
  IF v_exists THEN RETURN json_build_object('error', 'User already exists'); END IF;

  -- Validate Role
  BEGIN v_role_enum := p_role::public.user_role_enum; EXCEPTION WHEN OTHERS THEN v_role_enum := 'VIEW_ONLY'; END;

  -- Generate ID
  v_uid := gen_random_uuid(); -- Native Postgres function, usually available without pgcrypto in newer PG

  -- Attempt Insert with explicit extension schema handling if needed
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at
  ) VALUES (
    v_uid, 
    p_email, 
    crypt(p_password, gen_salt('bf')), -- Expects gen_salt to be found in search_path
    now(), 
    jsonb_build_object('full_name', p_full_name, 'role', v_role_enum), 
    'authenticated', 
    'authenticated', 
    now(), 
    now()
  );

  -- Insert Profile
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
  VALUES (v_uid, p_email, p_full_name, v_role_enum, true);

  RETURN json_build_object('success', true, 'id', v_uid);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;
