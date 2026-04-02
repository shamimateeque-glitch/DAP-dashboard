-- Create the RPC function to allow Admins to create users directly
-- This version fixes the ambiguous column reference by using parameter aliases
drop function if exists admin_create_user(text, text, text, text);

create or replace function admin_create_user(
    p_email text,
    p_password text,
    p_full_name text,
    p_role text
)
returns json
security definer
as $$
declare
  new_id uuid;
begin
  -- Check permission: Only SUPER_ADMIN can run this
  if not exists (
    select 1 from public.users 
    where auth_user_id = auth.uid() 
    and role = 'SUPER_ADMIN'
  ) then
    return json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  end if;

  -- Check if email already exists in auth.users
  if exists (select 1 from auth.users where email = p_email) then
    return json_build_object('error', 'User with this email already exists.');
  end if;

  -- Generate ID
  new_id := gen_random_uuid();

  -- Insert into auth.users
  insert into auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    aud,
    role
  ) values (
    new_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', p_full_name),
    'authenticated',
    'authenticated'
  );

  -- Update the role in public.users to the desired role
  -- We explicitly reference the table column to avoid ambiguity with the parameter
  update public.users
  set role = p_role::user_role_enum
  where auth_user_id = new_id;

  return json_build_object('success', true, 'id', new_id);

exception when others then
  return json_build_object('error', SQLERRM);
end;
$$ language plpgsql;
