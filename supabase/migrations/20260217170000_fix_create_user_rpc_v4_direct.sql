-- FIX: Admin Create User RPC (V4 - Direct Insertion)
-- This version REMOVES reliance on triggers entirely for user creation.
-- It inserts into BOTH auth.users and public.users directly in the same transaction.
-- This guarantees that if the RPC succeeds, the public user profile DOES exist.

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges
SET search_path = public -- Secure search path
AS $$
DECLARE
  new_uid uuid;
  v_role_enum public.user_role_enum;
BEGIN
  -- 1. Validate Caller is Super Admin
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  END IF;

  -- 2. Check if user exists in auth (Pre-check)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'User with this email already exists.');
  END IF;

  -- 3. Validate Role
  BEGIN
    v_role_enum := p_role::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    v_role_enum := 'VIEW_ONLY';
  END;

  -- 4. Generate UUID
  new_uid := gen_random_uuid();

  -- 5. Insert into AUTH.USERS (The Login Account)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_uid,
    '00000000-0000-0000-0000-000000000000', -- Default Supabase instance ID
    p_email,
    crypt(p_password, gen_salt('bf')), -- Hash password
    now(), -- Auto-confirm email
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', v_role_enum),
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- 6. Insert into PUBLIC.USERS (The Profile) - CRITICAL STEP
  -- We do this DIRECTLY here. We do NOT rely on a trigger.
  INSERT INTO public.users (
    auth_user_id,
    email,
    full_name,
    role,
    is_active
  ) VALUES (
    new_uid,
    p_email,
    p_full_name,
    v_role_enum,
    true
  );

  RETURN json_build_object('success', true, 'id', new_uid);

EXCEPTION WHEN OTHERS THEN
  -- If anything fails, the entire transaction rolls back (both auth and public inserts)
  RETURN json_build_object('error', SQLERRM);
END;
$$;
