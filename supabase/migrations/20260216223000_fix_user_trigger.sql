-- 1. Insert the initial Admin User (using the ID from your logs)
INSERT INTO public.users (
    auth_user_id, 
    email, 
    full_name, 
    role, 
    is_active, 
    permissions
)
VALUES (
    'ed92d9ac-0509-4318-a300-76c66aebe132', -- The ID from your console logs
    'admin@dap-ip.com',                     -- Assuming this is the email
    'System Admin',
    'SUPER_ADMIN',
    true,
    '{
        "cases": { "view": true, "create": true, "edit": true },
        "workflow": { "view": true, "edit": true },
        "invoices": { "view": true, "edit": true },
        "reports": { "view": true, "export": true },
        "admin": { "users": true, "settings": true }
    }'::jsonb
)
ON CONFLICT (auth_user_id) DO NOTHING;

-- 2. Create the Trigger to handle FUTURE signups automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name, role, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'VIEW_ONLY', -- Default role for new users
    '{
        "cases": { "view": true, "create": false, "edit": false },
        "workflow": { "view": true, "edit": false },
        "invoices": { "view": true, "edit": false },
        "reports": { "view": true, "export": false },
        "admin": { "users": false, "settings": false }
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
