-- Create a new migration to improve the admin_create_user function
-- This version adds the necessary metadata for Supabase Dashboard to recognize the users

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
BEGIN
  -- 1. Check permission: Only SUPER_ADMIN can run this
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE auth_user_id = auth.uid() 
    AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  END IF;

  -- 2. Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'User with this email already exists in Auth.');
  END IF;

  -- 3. Generate ID
  new_id := gen_random_uuid();

  -- 4. Insert into auth.users with standard Supabase metadata
  -- We include raw_app_meta_data and instance_id to ensure visibility in the Dashboard
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
    '00000000-0000-0000-0000-000000000000', -- Default instance_id
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb, -- Essential for Dashboard visibility
    jsonb_build_object('full_name', p_full_name),
    'authenticated',
    'authenticated',
    now(),
    now(),
    '', -- Empty tokens
    '',
    '',
    false
  );

  -- 5. Update the role in public.users to the desired role
  -- The trigger 'on_auth_user_created' will have already inserted the row into public.users
  -- with the default 'VIEW_ONLY' role.
  UPDATE public.users
  set role = p_role::user_role_enum,
      full_name = p_full_name -- Sync name just in case
  WHERE auth_user_id = new_id;

  RETURN json_build_object('success', true, 'id', new_id);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
