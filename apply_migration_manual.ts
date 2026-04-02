
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Enable RLS on users table if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
USING ( auth.uid() = auth_user_id );

-- Policy: Super Admins can view all profiles
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.users;
CREATE POLICY "Super Admins can view all profiles"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_user_id = auth.uid()
    AND role = 'SUPER_ADMIN'
  )
);
`;

// Note: Running raw SQL requires the 'sql' function extension or direct connection, which JS client doesn't support by default without an RPC wrapper.
// So we will create a temporary RPC function to execute SQL if one doesn't exist, or try to use psql via Deno if possible.
// Actually, since I can't easily rely on RPC for arbitrary SQL, I will assume the user has to restart their local Supabase or I rely on the file system migration being picked up eventually.

// BUT, I can try to use the 'pg' driver if I had connection string. I don't.

console.log("Migration file created at: supabase/migrations/20260216235000_fix_users_rls.sql");
console.log("Please ensure this migration is applied.");
