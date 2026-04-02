-- Enable pgcrypto for password hashing if not already enabled
create extension if not exists pgcrypto;

-- Create the RPC function to allow Admins to create users directly
-- This bypasses Auth API rate limits and complex Edge Function setups
create or replace function admin_create_user(
    email text,
    password text,
    full_name text,
    role text
)
returns json
security definer
as $$
declare
  new_id uuid;
begin
  -- Check permission: Only SUPER_ADMIN can run this
  -- We assume the executing user is authenticated (auth.uid() is not null)
  if not exists (
    select 1 from public.users 
    where auth_user_id = auth.uid() 
    and role = 'SUPER_ADMIN'
  ) then
    return json_build_object('error', 'Unauthorized: Only Super Admins can create users.');
  end if;

  -- Check if email already exists
  if exists (select 1 from auth.users where auth.users.email = admin_create_user.email) then
    return json_build_object('error', 'User with this email already exists.');
  end if;

  -- Generate ID
  new_id := gen_random_uuid();

  -- Insert into auth.users
  -- This will trigger 'on_auth_user_created' (from previous migration) 
  -- which automagically inserts into 'public.users'
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
    email,
    crypt(password, gen_salt('bf')),
    now(), -- Auto confirm email
    jsonb_build_object('full_name', full_name),
    'authenticated',
    'authenticated'
  );

  -- Update the role in public.users to the desired role
  -- The trigger 'handle_new_user' likely sets it to 'VIEW_ONLY' by default
  update public.users
  set role = admin_create_user.role
  where auth_user_id = new_id;

  return json_build_object('success', true, 'id', new_id);

exception when others then
  return json_build_object('error', SQLERRM);
end;
$$ language plpgsql;
