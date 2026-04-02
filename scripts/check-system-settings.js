
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to read .env
function getEnv(key) {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return null;
    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

const url = getEnv('VITE_SUPABASE_URL');
const key = getEnv('VITE_SUPABASE_ANON_KEY');

if (!url || !key) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
    console.log('\n--- Checking Migration Status ---\n');

    // Check system_settings
    const { error } = await supabase.from('system_settings').select('id').limit(1);

    if (error) {
        if (error.code === '42P01') {
            console.log('🔴 STATUS: "system_settings" table DOES NOT EXIST.');
            console.log('   Action: Run migration "20260216214313_system_settings.sql" in Supabase SQL Editor.');
        } else {
            console.log('🔴 STATUS: Error checking "system_settings":', error.message);
        }
    } else {
        console.log('🟢 STATUS: "system_settings" table EXISTS and is accessible.');
    }

    console.log('\n---------------------------------\n');
}

check();
