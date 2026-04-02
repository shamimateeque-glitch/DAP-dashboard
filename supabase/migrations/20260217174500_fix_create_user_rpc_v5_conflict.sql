-- FIX: Handle Duplicate Key Error in RPC v5
-- The error "duplicate key value violates unique constraint" happens if:
-- 1. We are inserting into auth.users (ID is random UUID, so collision is rare).
-- 2. We are inserting into public.users and the auth_user_id ALREADY exists.

-- This suggests that either:
-- A) A trigger is STILL firing and creating the public user before our manual insert.
-- B) The manual insert in our function is colliding with something.

-- SOLUTION: Use ON CONFLICT DO NOTHING for the public.users insert inside the RPC.
-- This makes the function resilient: if a trigger already did the job, our manual insert simply steps aside.

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions -- Ensure extensions are visible
AS $$
DECLARE
  v_uid uuid;
  v_role_enum public.user_role_enum;
  v_exists boolean;
BEGIN
  -- 1. Permission Check
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- 2. Email Check (in Auth)
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
  IF v_exists THEN 
    RETURN json_build_object('error', 'User with this email already exists.'); 
  END IF;

  -- 3. Role Validation
  BEGIN v_role_enum := p_role::public.user_role_enum; EXCEPTION WHEN OTHERS THEN v_role_enum := 'VIEW_ONLY'; END;

  -- 4. Generate ID
  v_uid := gen_random_uuid();

  -- 5. Insert into Auth Users
  INSERT INTO auth.users (
    id, email, encrypted_password, email_confirmed_at, 
    raw_user_meta_data, role, aud, created_at, updated_at
  ) VALUES (
    v_uid, 
    p_email, 
    crypt(p_password, gen_salt('bf')), 
    now(), 
    jsonb_build_object('full_name', p_full_name, 'role', v_role_enum), 
    'authenticated', 
    'authenticated', 
    now(), 
    now()
  );

  -- 6. Insert into Public Profile (Resilient)
  -- We use ON CONFLICT DO NOTHING to handle cases where a trigger might have raced us.
  -- Currently, we believe triggers are off/broken, but this makes it safe regardless.
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
  VALUES (v_uid, p_email, p_full_name, v_role_enum, true)
  ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      is_active = true;

  RETURN json_build_object('success', true, 'id', v_uid);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;
