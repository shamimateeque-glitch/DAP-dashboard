import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

interface AlertPayload {
    type: string
    case_id?: string
    data?: any
}

// ── Alert display config ────────────────────────────────────────────────
const ALERT_META: Record<string, { label: string; emoji: string; color: string }> = {
    CASE_APPROVED:            { label: 'Case Approved',              emoji: '&#9989;',  color: '#16a34a' },
    CASE_REJECTED:            { label: 'Case Rejected',              emoji: '&#10060;',  color: '#dc2626' },
    FINAL_REPORT_SUBMITTED:   { label: 'Final Report Submitted',     emoji: '&#128203;', color: '#2563eb' },
    IN_DEPTH_DONE:            { label: 'In-Depth Investigation Done',emoji: '&#128270;', color: '#16a34a' },
    IN_DEPTH_DATE_CHANGED:    { label: 'In-Depth Date Changed',      emoji: '&#128197;', color: '#ea640f' },
    IN_DEPTH_DUE:             { label: 'In-Depth Due Soon',          emoji: '&#9200;',   color: '#ea640f' },
    ENFORCEMENT_DONE:         { label: 'Enforcement Done',           emoji: '&#9878;',   color: '#16a34a' },
    ENFORCEMENT_DATE_CHANGED: { label: 'Enforcement Date Changed',   emoji: '&#128197;', color: '#ea640f' },
    ENFORCEMENT_DUE:          { label: 'Enforcement Due Soon',       emoji: '&#9200;',   color: '#ea640f' },
    DESTRUCTION_DONE:         { label: 'Destruction Done',           emoji: '&#128293;', color: '#16a34a' },
    INVOICE_ISSUED:           { label: 'Invoice Issued',             emoji: '&#128176;', color: '#2563eb' },
    INVOICE_PAID:             { label: 'Invoice Paid',               emoji: '&#128181;', color: '#16a34a' },
    INVOICE_OVERDUE:          { label: 'Invoice Overdue',            emoji: '&#128680;', color: '#dc2626' },
    INVOICE_DUE:              { label: 'Invoice Due Today',          emoji: '&#9200;',   color: '#ea640f' },
}

// ── Email template ──────────────────────────────────────────────────────
function buildEmailHtml(alertType: string, recipientName: string, caseData: any) {
    const meta = ALERT_META[alertType] || { label: alertType.replace(/_/g, ' '), emoji: '&#128276;', color: '#2563eb' }

    const caseInfo = caseData ? `
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px 12px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;">Case ID</td><td style="padding:8px 12px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #1e293b;font-weight:600;">${caseData.case_id || 'N/A'}</td></tr>
            <tr><td style="padding:8px 12px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;">Target Name</td><td style="padding:8px 12px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #1e293b;font-weight:600;">${caseData.target_name || 'N/A'}</td></tr>
            <tr><td style="padding:8px 12px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;">Brand</td><td style="padding:8px 12px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #1e293b;font-weight:600;">${caseData.brand_name || 'N/A'}</td></tr>
            <tr><td style="padding:8px 12px;color:#94a3b8;font-size:13px;">Status</td><td style="padding:8px 12px;color:#f1f5f9;font-size:13px;font-weight:600;">${caseData.case_status || 'N/A'}</td></tr>
        </table>
    ` : ''

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
            <!-- Header -->
            <div style="text-align:center;padding:24px 0;">
                <h1 style="margin:0;color:#f1f5f9;font-size:22px;font-weight:700;">DAP Dashboard</h1>
                <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Deduct & Protect</p>
            </div>

            <!-- Card -->
            <div style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
                <!-- Alert Banner -->
                <div style="background:${meta.color};padding:20px 24px;text-align:center;">
                    <span style="font-size:32px;">${meta.emoji}</span>
                    <h2 style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">${meta.label}</h2>
                </div>

                <!-- Body -->
                <div style="padding:24px;">
                    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 16px;">
                        Hi <strong style="color:#f1f5f9;">${recipientName}</strong>,
                    </p>
                    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 16px;">
                        A new alert has been triggered on the DAP Dashboard:
                    </p>

                    ${caseInfo}

                    <div style="text-align:center;margin:24px 0 8px;">
                        <a href="${Deno.env.get('SITE_URL') || 'https://your-dashboard-url.com'}"
                           style="display:inline-block;background:${meta.color};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                            View on Dashboard
                        </a>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="text-align:center;padding:24px 0;">
                <p style="color:#475569;font-size:12px;margin:0;">
                    You are receiving this because you enabled "${meta.label}" alerts.
                </p>
                <p style="color:#475569;font-size:12px;margin:4px 0 0;">
                    Manage your preferences in Alerts & Reminders settings.
                </p>
            </div>
        </div>
    </body>
    </html>`
}

// ── Main handler ────────────────────────────────────────────────────────
serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const GMAIL_USER = Deno.env.get('GMAIL_USER') || ''
        const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') || ''
        const REPLY_TO = 'deductandprotect@gmail.com'

        const { type, case_id, data }: AlertPayload = await req.json()

        // 1. Get recipients who have this alert enabled
        const { data: configs, error: configError } = await supabaseClient
            .from('alert_configurations')
            .select('user_id, users(email, full_name)')
            .eq('alert_type', type)
            .eq('is_enabled', true)

        if (configError) throw configError

        if (!configs || configs.length === 0) {
            console.log(`No recipients found for alert type: ${type}`)
            return new Response(JSON.stringify({ message: 'No recipients found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        // 2. Fetch case details if case_id is provided
        let caseData = null
        if (case_id) {
            const { data: c } = await supabaseClient
                .from('cases')
                .select('case_id, target_name, brand_name, case_status, province, city')
                .eq('id', case_id)
                .single()
            caseData = c
        }

        const meta = ALERT_META[type] || { label: type.replace(/_/g, ' '), emoji: '', color: '#2563eb' }

        // 3. Send emails via Gmail SMTP and log to database
        const sendResults = await Promise.all(configs.map(async (config: any) => {
            const recipient = config.users
            if (!recipient?.email) return { success: false, error: 'No email found' }

            let emailSent = false

            if (GMAIL_USER && GMAIL_APP_PASSWORD) {
                try {
                    const client = new SMTPClient({
                        connection: {
                            hostname: 'smtp.gmail.com',
                            port: 465,
                            tls: true,
                            auth: {
                                username: GMAIL_USER,
                                password: GMAIL_APP_PASSWORD,
                            },
                        },
                    })

                    await client.send({
                        from: `DAP Dashboard <${GMAIL_USER}>`,
                        to: recipient.email,
                        replyTo: REPLY_TO,
                        subject: `${meta.label}${caseData?.case_id ? ' - ' + caseData.case_id : ''} | DAP Dashboard`,
                        html: buildEmailHtml(type, recipient.full_name || 'Team Member', caseData),
                    })

                    await client.close()
                    emailSent = true
                    console.log(`Email sent to ${recipient.email} for ${type}`)
                } catch (emailErr) {
                    console.error(`Failed to send email to ${recipient.email}:`, emailErr)
                }
            } else {
                console.warn('GMAIL credentials not set — skipping email, logging only.')
            }

            // Log the alert to the database
            const { error: logError } = await supabaseClient
                .from('alert_logs')
                .insert([{
                    alert_type: type,
                    case_id: case_id,
                    recipient_id: config.user_id,
                    sent_at: new Date().toISOString(),
                    email_status: emailSent ? 'SENT' : 'FAILED'
                }])

            return {
                email: recipient.email,
                success: emailSent,
                logged: !logError,
            }
        }))

        return new Response(JSON.stringify({
            message: 'Alerts processed',
            type,
            recipients: configs.length,
            results: sendResults
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        console.error('Error in send-alert function:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
