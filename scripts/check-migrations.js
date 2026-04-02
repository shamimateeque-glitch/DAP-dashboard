import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
function getEnvVars() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) return {};
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^['"](.*)['"]$/, '$1'); // remove quotes
                env[key] = val;
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = getEnvVars();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Could not find VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file.');
    console.log('Please ensure you have a .env file in the root directory.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigrations() {
    console.log('🔍 Checking database migrations state...\n');

    // 1. Check system_settings table
    const { error: settingsError } = await supabase.from('system_settings').select('id').limit(1);

    if (settingsError) {
        if (settingsError.code === '42P01') {
            console.log('❌ "system_settings" table NOT found.');
            console.log('   -> Run specific migration: 20260216214313_system_settings.sql');
        } else {
            console.log('❌ Error checking "system_settings":', settingsError.message);
        }
    } else {
        console.log('✅ "system_settings" table exists.');
    }

    // 2. Check cases table structure (for the missing columns issue)
    // We can't easily check column existence via simple select without potentially failing
    // But we can check if querying the new columns throws an error
    const { error: columnsError } = await supabase
        .from('cases')
        .select('case_reported_by, matter_code')
        .limit(1);

    if (columnsError) {
        if (columnsError.code === '42703') { // undefined_column
            console.log('❌ "cases" table is missing new columns (case_reported_by, matter_code).');
            console.log('   -> Run specific migration: 20260216220000_add_missing_case_columns.sql');
        } else {
            // It might be that the table itself is missing or some other error
            console.log('⚠️ Could not verify columns in "cases" table:', columnsError.message);
        }
    } else {
        console.log('✅ "cases" table has the new columns (case_reported_by, matter_code).');
    }

    console.log('\n--- check complete ---');
}

checkMigrations();
