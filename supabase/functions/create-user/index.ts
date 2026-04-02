import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { email, password, full_name, role, permissions } = await req.json()

        // 1. Create the user in Supabase Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, role }
        })

        if (authError) throw authError

        // 2. Create the user record in our 'users' table
        // The trigger might already do this if you have one, but let's be explicit 
        // or handle it if the trigger is missing.
        // In our schema, we have a 'users' table.
        const { data: userData, error: userTableError } = await supabaseAdmin
            .from('users')
            .upsert({
                auth_user_id: authUser.user.id,
                email,
                full_name,
                role,
                permissions: permissions || {
                    cases: { view: true, create: false, edit: false },
                    workflow: { view: true, edit: false },
                    invoices: { view: true, edit: false },
                    reports: { view: true, export: false },
                    admin: { users: false, settings: false }
                },
                is_active: true
            })
            .select()
            .single()

        if (userTableError) throw userTableError

        return new Response(JSON.stringify({ user: userData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
