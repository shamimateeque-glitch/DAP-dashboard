import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        // Helper to get date string offset
        const getDateOffset = (days: number) => {
            const d = new Date()
            d.setDate(d.getDate() + days)
            return d.toISOString().split('T')[0]
        }

        const targets = [0, 1, 2] // 0, 1, and 2 days before
        const targetDates = targets.map(getDateOffset)

        // 1. Check In-Depth Stages
        const { data: indepthStages } = await supabaseClient
            .from('in_depth_stages')
            .select('case_id, due_date')
            .eq('status', 'IN_PROGRESS')
            .in('due_date', targetDates)

        // 2. Check Enforcement Stages
        const { data: enforcementStages } = await supabaseClient
            .from('enforcement_stages')
            .select('case_id, due_date')
            .eq('status', 'IN_PROGRESS')
            .in('due_date', targetDates)

        // 3. Check Overdue Invoices
        const { data: invoices } = await supabaseClient
            .from('invoices')
            .select('id, case_id, due_date')
            .not('status', 'eq', 'PAID')
            .eq('due_date', todayStr) // Exactly due today

        const alertPromises = []

        // Process In-Depth
        if (indepthStages) {
            for (const stage of indepthStages) {
                alertPromises.push(
                    supabaseClient.functions.invoke('send-alert', {
                        body: { type: 'IN_DEPTH_DUE', case_id: stage.case_id }
                    })
                )
            }
        }

        // Process Enforcement
        if (enforcementStages) {
            for (const stage of enforcementStages) {
                alertPromises.push(
                    supabaseClient.functions.invoke('send-alert', {
                        body: { type: 'ENFORCEMENT_DUE', case_id: stage.case_id }
                    })
                )
            }
        }

        // Process Invoices
        if (invoices) {
            for (const inv of invoices) {
                alertPromises.push(
                    supabaseClient.functions.invoke('send-alert', {
                        body: { type: 'INVOICE_DUE', case_id: inv.case_id }
                    })
                )
            }
        }

        const results = await Promise.all(alertPromises)

        return new Response(JSON.stringify({
            message: 'Daily reminders processed',
            processed: results.length
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error('Error in daily-reminders function:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
