-- Force update of the admin_create_user function to ensure latest version is active
-- This handles the case where the previous migration might not have applied correctly
-- or if there's a parameter mismatch.

DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  param_role public.user_role_enum;
BEGIN
  -- 1. Check permission: Only SUPER_ADMIN can run this
  -- We allow the calling user to be a SUPER_ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  END IF;

  -- 2. Check if email already exists in auth.users
  -- Uses strict parameter comparison
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'User with this email already exists in Auth.');
  END IF;

  -- 3. Validate Role Cast
  BEGIN
    param_role := p_role::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', 'Invalid role specified.');
  END;

  -- 4. Generate ID
  new_id := gen_random_uuid();

  -- 5. Insert into auth.users
  -- Including raw_app_meta_data for Dashboard visibility
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
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    is_super_admin
  ) VALUES (
    new_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    false
  );

  -- 6. Update the role in public.users
  -- The trigger 'on_auth_user_created' inserts the row with default role.
  -- We update it here with the requested role and name.
  UPDATE public.users
  SET role = param_role,
      full_name = p_full_name,
      is_active = true
  WHERE auth_user_id = new_id;

  RETURN json_build_object('success', true, 'id', new_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
