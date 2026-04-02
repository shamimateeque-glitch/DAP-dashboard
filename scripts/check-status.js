
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function getEnv(key) {
    try {
        const content = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
        const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
    } catch { return null; }
}

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_ANON_KEY'));

async function check() {
    console.log('\n--- DIAGNOSTIC CHECK ---\n');

    // Check system_settings
    const { error: sysErr } = await supabase.from('system_settings').select('id').limit(1);
    const sysReady = !sysErr || sysErr.code !== '42P01';
    console.log(`System Settings Table: ${sysReady ? '✅ FOUND (Migration Applied)' : '❌ MISSING (Run system_settings.sql)'}`);

    // Check cases columns
    const { error: colErr } = await supabase.from('cases').select('case_reported_by, matter_code').limit(1);
    // 42703 is undefined_column
    const colsReady = !colErr;
    console.log(`Cases Columns (reported_by): ${colsReady ? '✅ FOUND' : '❌ MISSING (Run add_missing_case_columns.sql)'}`);

    console.log('\n------------------------\n');
}

check();
