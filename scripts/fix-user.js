
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

const AUTH_ID = 'ed92d9ac-0509-4318-a300-76c66aebe132';
const EMAIL = 'admin@dap-ip.com';

async function fixUser() {
    console.log(`Checking public.users for Auth ID: ${AUTH_ID}`);

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', AUTH_ID)
        .maybeSingle();

    if (error) {
        console.error('Error checking user:', error.message);
        return;
    }

    if (data) {
        console.log('✅ User already exists:', data);
    } else {
        console.log('❌ User MISSING in public.users table!');
        console.log('Attempting to create user row...');

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
                auth_user_id: AUTH_ID,
                email: EMAIL,
                full_name: 'Admin User',
                role: 'SUPER_ADMIN', // Give admin role
                is_active: true,
                permissions: {
                    cases: { view: true, create: true, edit: true },
                    workflow: { view: true, edit: true },
                    invoices: { view: true, edit: true },
                    reports: { view: true, export: true },
                    admin: { users: true, settings: true }
                }
            })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to create user row:', insertError.message);
        } else {
            console.log('✅ User row created successfully:', newUser);
        }
    }
}

fixUser();
