-- Add an RPC for admins to reset a user's password
-- This properly hashes the password so GoTrue can verify it

CREATE OR REPLACE FUNCTION public.admin_reset_password(
    p_user_id uuid,
    p_new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  -- 1. Permission Check: Only SUPER_ADMIN can reset passwords
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid() AND role = 'SUPER_ADMIN'
  ) THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  -- 2. Validate password length
  IF length(p_new_password) < 6 THEN
    RETURN json_build_object('error', 'Password must be at least 6 characters');
  END IF;

  -- 3. Get the auth_user_id from the public.users table
  SELECT auth_user_id INTO v_auth_user_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_auth_user_id IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- 4. Update the password in auth.users
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = v_auth_user_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;
