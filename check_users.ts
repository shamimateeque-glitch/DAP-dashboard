
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
    console.log("Checking RLS policies on public.users...");

    const { data, error } = await supabase
        .rpc('get_policies_for_table', { table_name: 'users' });

    if (error) {
        // If the RPC doesn't exist, we can't easily check policies via JS client without admin rights or direct SQL
        console.log("Could not fetch policies via RPC (function likely doesn't exist).");
        console.log("Attempting to insert a test user and check access if possible, or just print active roles.");
    } else {
        console.log("Policies:", data);
    }

    // Alternative: Try to select from users as a service role to see if data exists
    const { data: allUsers, error: userError } = await supabase.from('users').select('role, email').limit(5);
    if (userError) {
        console.error("Error fetching users:", userError);
    } else {
        console.log("Existing users:", allUsers);
    }
}

checkPolicies();
