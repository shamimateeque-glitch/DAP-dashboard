import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Using anon key, hope RLS allows or we need a service key. 
// Note: Based on previous migrations, 'authenticated' has ALL permissions in public schema. 

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
    console.log('Clearing transactional data...');

    // Child tables first
    const tables = [
        'alert_logs',
        'reminder_logs',
        'destruction_stages',
        'invoices',
        'final_reports',
        'enforcement_stages',
        'in_depth_stages',
        'case_uploads',
        'cases'
    ];

    for (const table of tables) {
        console.log(`Clearing ${table}...`);
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
            console.error(`Error clearing ${table}:`, error.message);
        }
    }

    console.log('Data cleared successfully.');
}

clearData();
