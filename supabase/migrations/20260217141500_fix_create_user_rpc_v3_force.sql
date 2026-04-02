-- Drop and recreate the admin_create_user function to address potential parameter conflicts or logic errors.
-- We are removing the redundant strict email existence content as a first debugging step
-- to see if that resolves the blocking issue, while maintaining core functionality.

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
  user_exists boolean;
BEGIN
  -- 1. Check permission by explicitly querying public.users for the caller
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  END IF;

  -- 2. Explicitly check for email existence in auth.users using a variable to avoid ambiguity
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) INTO user_exists;
  
  IF user_exists THEN
    RETURN json_build_object('error', 'User with this email already exists in Auth.');
  END IF;

  -- 3. Validate Role Cast
  BEGIN
    param_role := p_role::public.user_role_enum;
  EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', 'Invalid role specified: ' || p_role);
  END;

  -- 4. Generate ID
  new_id := gen_random_uuid();

  -- 5. Insert into auth.users
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
  -- The trigger 'on_auth_user_created' fires after the auth.users insert.
  -- We wait briefly (implicitly via transaction) and then update.
  -- If for some reason the trigger didn't fire (rare), this update might miss, so we'll handle upsert just in case.
  
  INSERT INTO public.users (auth_user_id, email, full_name, role, is_active)
  VALUES (new_id, p_email, p_full_name, param_role, true)
  ON CONFLICT (auth_user_id) DO UPDATE
  SET role = EXCLUDED.role,
      full_name = EXCLUDED.full_name,
      is_active = true;

  RETURN json_build_object('success', true, 'id', new_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
