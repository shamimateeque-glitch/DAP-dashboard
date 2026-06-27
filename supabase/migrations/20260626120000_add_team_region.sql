-- Region scoping for Investigation Team members.
-- Each team member gets an assigned province (and optional city); the app filters their
-- cases to that region. SUPER_ADMIN / DATA_ENTRY / VIEW_ONLY are unaffected.

-- 1. Region columns on the users table.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS assigned_province varchar(100),
  ADD COLUMN IF NOT EXISTS assigned_city     varchar(100);

-- 2. Extend admin_create_user to accept + persist the assigned region.
--    Drop the old 4-arg signature, recreate with the two optional region params.
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text,
    p_assigned_province text DEFAULT NULL,
    p_assigned_city text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  -- 6. Insert into Public Profile (Resilient), incl. assigned region.
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active, assigned_province, assigned_city)
  VALUES (v_uid, p_email, p_full_name, v_role_enum, true, p_assigned_province, p_assigned_city)
  ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      is_active = true,
      assigned_province = EXCLUDED.assigned_province,
      assigned_city = EXCLUDED.assigned_city;

  RETURN json_build_object('success', true, 'id', v_uid);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;
