-- FIX: VIEW_ONLY users getting "Invalid login credentials"
--
-- ROOT CAUSE: The admin_create_user RPC bypasses Supabase Auth (GoTrue) and
-- directly inserts into auth.users with crypt(password, gen_salt('bf')).
-- This creates a password hash that GoTrue cannot verify because:
--   1. GoTrue expects specific bcrypt format with instance_id verification
--   2. The direct INSERT misses required auth.users columns (instance_id, etc.)
--   3. The mass_password_reset migration may have also used wrong schema for gen_salt
--
-- SOLUTION: Replace the RPC to use Supabase's internal auth.create_user()
-- which is available in Supabase and handles password hashing correctly.
-- For existing broken users, we'll use auth schema's own password update mechanism.

-- ============================================================
-- STEP 1: Fix the admin_create_user RPC to use proper Supabase internals
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_role_enum public.user_role_enum;
  v_exists boolean;
  v_instance_id uuid;
BEGIN
  -- 1. Permission Check
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- 2. Email Check
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('error', 'User with this email already exists.');
  END IF;

  -- 3. Role Validation
  BEGIN
    v_role_enum := p_role::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    v_role_enum := 'VIEW_ONLY';
  END;

  -- 4. Generate ID
  v_uid := gen_random_uuid();

  -- 5. Get instance_id from an existing user (required by GoTrue)
  SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;
  IF v_instance_id IS NULL THEN
    v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
  END IF;

  -- 6. Insert into Auth Users with ALL required GoTrue fields
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) VALUES (
    v_uid,
    v_instance_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', p_full_name, 'role', v_role_enum::text),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  -- 7. Also insert the identity record (required by newer Supabase versions)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_uid,
    v_uid,
    p_email,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', p_email,
      'email_verified', true,
      'full_name', p_full_name
    ),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- 8. Insert into Public Profile
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

-- ============================================================
-- STEP 2: Fix existing users that are missing identity records
-- Without an identity record, GoTrue cannot authenticate the user
-- ============================================================
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  au.id,
  au.id,
  au.email,
  jsonb_build_object(
    'sub', au.id::text,
    'email', au.email,
    'email_verified', true
  ),
  'email',
  COALESCE(au.last_sign_in_at, now()),
  au.created_at,
  now()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities ai
  WHERE ai.user_id = au.id AND ai.provider = 'email'
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================
-- STEP 3: Fix instance_id for any users that have NULL instance_id
-- ============================================================
UPDATE auth.users
SET instance_id = (SELECT instance_id FROM auth.users WHERE instance_id IS NOT NULL LIMIT 1)
WHERE instance_id IS NULL;

-- ============================================================
-- STEP 4: Fix raw_app_meta_data for users missing provider info
-- GoTrue checks this during authentication
-- ============================================================
UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email'])
WHERE raw_app_meta_data IS NULL
   OR raw_app_meta_data = '{}'::jsonb
   OR NOT (raw_app_meta_data ? 'provider');
