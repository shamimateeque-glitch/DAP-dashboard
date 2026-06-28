-- Make admin_create_user produce FULLY-registered Supabase Auth users.
--
-- The previous version inserted only into auth.users, so users had no auth.identities
-- record and were missing internal fields. Such users don't appear in the Authentication
-- dashboard and can't log in. This version also:
--   - lowercases/trims the email (login lowercases, so stored email must match),
--   - sets raw_app_meta_data, instance_id and the NOT-NULL token columns,
--   - creates the matching auth.identities (email provider) row.

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
  v_email text;
BEGIN
  -- 1. Permission check
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'SUPER_ADMIN') THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  v_email := lower(trim(p_email));

  -- 2. Email uniqueness
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN json_build_object('error', 'User with this email already exists.');
  END IF;

  -- 3. Role validation
  BEGIN v_role_enum := p_role::public.user_role_enum; EXCEPTION WHEN OTHERS THEN v_role_enum := 'VIEW_ONLY'; END;

  v_uid := gen_random_uuid();

  -- 4. Auth user (with the fields GoTrue needs to recognise + log in the user)
  INSERT INTO auth.users (
    instance_id, id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, role, aud, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, v_email, crypt(p_password, gen_salt('bf')), now(),
    jsonb_build_object('full_name', p_full_name, 'role', v_role_enum),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    'authenticated', 'authenticated', now(), now(),
    '', '', '', '', ''
  );

  -- 5. Email identity (required for password login + dashboard visibility)
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_uid::text, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- 6. App profile (role + assigned region)
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active, assigned_province, assigned_city)
  VALUES (v_uid, v_email, p_full_name, v_role_enum, true, p_assigned_province, p_assigned_city)
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
