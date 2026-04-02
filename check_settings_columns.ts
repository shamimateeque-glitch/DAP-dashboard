
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// You might need to set these env vars or just hardcode for this check if known
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else {
        console.log('Row sample:', data);
    }
}

checkColumns();
