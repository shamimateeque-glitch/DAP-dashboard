
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

const url = getEnv('VITE_SUPABASE_URL');
const key = getEnv('VITE_SUPABASE_ANON_KEY');

console.log('Testing Supabase Connection...');
console.log('URL:', url);
// Don't log full key for security
console.log('Key:', key ? key.substring(0, 10) + '...' : 'MISSING');

if (!url || !key) process.exit(1);

const supabase = createClient(url, key, {
    auth: {
        persistSession: false // Don't use local storage for this test
    }
});

async function testConnection() {
    console.log('Sending request to Supabase...');

    const start = Date.now();

    // Try a simple health check query 
    // querying a public table or just checking auth config
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));

    try {
        const request = supabase.from('system_settings').select('count', { count: 'exact', head: true });

        const { error } = await Promise.race([request, timeout]);
        const duration = Date.now() - start;

        if (error) {
            console.error('❌ Supabase Connecton Error:', error.message);
            console.error('Details:', error);
        } else {
            console.log(`✅ Connection Successful! (took ${duration}ms)`);
        }
    } catch (err) {
        const duration = Date.now() - start;
        console.error(`❌ Connection Failed (took ${duration}ms)`);
        console.error('Error:', err.message);
    }
}

testConnection();
