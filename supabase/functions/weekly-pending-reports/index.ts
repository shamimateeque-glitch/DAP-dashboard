import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

// ─── Types ──────────────────────────────────────────────────────────────────

type ReportType = 'upload' | 'decision' | 'in-depth' | 'enforcement' | 'final-report' | 'invoices' | 'destruction';

interface ColumnDef {
    key: string;
    label: string;
}

// ─── Report column definitions (mirrors PendingWorkReport.tsx) ──────────────

function getReportConfig(reportType: ReportType): { title: string; columnDefs: ColumnDef[] } {
    switch (reportType) {
        case 'upload':
            return {
                title: 'Pending Upload to Client',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_by', label: 'Reported By' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                ],
            };
        case 'decision':
            return {
                title: 'Waiting for Client Decision',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'our_fee_usd', label: 'Our Fee (USD)' },
                    { key: 'decision_status', label: 'Decision Status' },
                ],
            };
        case 'in-depth':
            return {
                title: 'Pending In-Depth Investigation',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_due_date', label: 'In-Depth Due Date' },
                ],
            };
        case 'enforcement':
            return {
                title: 'Pending Enforcement',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enf_status', label: 'Enforcement Status' },
                    { key: 'enf_due_date', label: 'Enforcement Due Date' },
                ],
            };
        case 'final-report':
            return {
                title: 'Pending Final Report to Client',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_status', label: 'In-Depth Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enf_status', label: 'Enforcement Status' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_status', label: 'Final Report Status' },
                    { key: 'final_report_due_date', label: 'Final Report Due Date' },
                ],
            };
        case 'invoices':
            return {
                title: 'Pending Invoices to Client',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_status', label: 'Decision Status' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_date', label: 'Final Report Submission Date' },
                    { key: 'inv_number', label: 'Invoice Number' },
                    { key: 'inv_status', label: 'Invoice Status' },
                    { key: 'inv_amount_usd', label: 'Invoice Amount (USD)' },
                    { key: 'inv_due_date', label: 'Invoice Due Date' },
                ],
            };
        case 'destruction':
            return {
                title: 'Pending Destruction',
                columnDefs: [
                    { key: 'case_id', label: 'Case ID' },
                    { key: 'matter_code', label: 'Matter Code' },
                    { key: 'case_type', label: 'Case Type' },
                    { key: 'target_name', label: 'Target Name' },
                    { key: 'target_category', label: 'Target Category' },
                    { key: 'target_address', label: 'Target Address' },
                    { key: 'city', label: 'City' },
                    { key: 'client', label: 'Client' },
                    { key: 'brand_name', label: 'Brand' },
                    { key: 'products_name', label: 'Products' },
                    { key: 'case_reported_date', label: 'Reported Date' },
                    { key: 'upload_date', label: 'Upload Date' },
                    { key: 'decision_date', label: 'Decision Date' },
                    { key: 'case_status', label: 'Case Status' },
                    { key: 'indepth_done_date', label: 'In-Depth Completed Date' },
                    { key: 'enforcement_done_date', label: 'Enforcement Completed Date' },
                    { key: 'final_report_date', label: 'Final Report Submission Date' },
                    { key: 'inv_status', label: 'Invoice Status' },
                    { key: 'dest_status', label: 'Destruction Status' },
                    { key: 'dest_due_date', label: 'Destruction Due Date' },
                ],
            };
    }
}

// ─── Helpers (ported from PendingWorkReport.tsx) ────────────────────────────

const getFirst = (rel: any) => (Array.isArray(rel) ? rel[0] : rel);

function normalizeClientName(clientName?: string): string {
    if (!clientName) return '';
    const upper = clientName.trim().toUpperCase();
    if (upper === 'ONEWORLD' || upper.includes('ONEWORLD')) return 'OneWorld';
    if (upper === 'A.A ASSOCIATES' || upper === 'AA' || upper === 'A.A' || upper.includes('ASSOCIATES')) return 'A.A Associates';
    if (upper === 'SAFEMARK' || upper === 'SAFE MARK' || upper.includes('SAFEMARK')) return 'SafeMark';
    if (upper === 'DAP-IP' || upper === 'DAP IP' || upper === 'DAPIP' || upper === 'DI') return 'DAP-IP';
    return clientName;
}

function getClientName(c: any): string {
    const upload = getFirst(c.case_uploads);
    if (upload?.client) return normalizeClientName(upload.client);
    if (c.matter_code) {
        const match = c.matter_code.match(/\/([A-Z]{2})-/);
        if (match) {
            const code = match[1];
            if (code === 'OW') return 'OneWorld';
            if (code === 'SM') return 'SafeMark';
            if (code === 'AA') return 'A.A Associates';
            if (code === 'DI') return 'DAP-IP';
        }
    }
    return 'N/A';
}

function fmtDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    } catch {
        return dateStr;
    }
}

// ─── Flatten case data into row objects per report type ─────────────────────
// Mirrors exactly PendingWorkReport.tsx flattenRow()

function flattenRow(c: any, reportType: ReportType): Record<string, any> | null {
    const upload = getFirst(c.case_uploads);
    const inDepth = getFirst(c.in_depth_stages);
    const enforcement = getFirst(c.enforcement_stages);
    const finalReport = getFirst(c.final_reports);
    const invoice = getFirst(c.invoices);
    const destruction = getFirst(c.destruction_stages);

    const base: Record<string, any> = {
        id: c.id,
        case_id: c.case_id,
        matter_code: c.matter_code || '-',
        target_name: c.target_name,
        brand_name: c.brand_name,
        client: getClientName(c),
        case_type: c.case_type || '-',
        case_status: c.case_status,
        province: c.province || '-',
        city: c.city || '-',
    };

    switch (reportType) {
        case 'upload':
            if (c.case_status !== 'IN_HAND') return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_by: c.case_reported_by || '-',
                case_reported_date: c.case_reported_date,
            };

        case 'decision':
            if (c.case_status !== 'UPLOADED') return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                our_fee_usd: upload?.our_fee_usd ?? '-',
                decision_status: upload?.decision_status || 'Pending',
            };

        case 'in-depth':
            if (
                !(c.case_status === 'APPROVED' || c.case_status === 'IN_DEPTH') ||
                (inDepth && inDepth.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth?.status || 'Pending',
                indepth_due_date: inDepth?.due_date || null,
            };

        case 'enforcement':
            if (
                !inDepth || inDepth.status !== 'DONE' ||
                (enforcement && enforcement.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth.status || '-',
                indepth_done_date: inDepth.status_date || null,
                enf_status: enforcement?.status || 'Pending',
                enf_due_date: enforcement?.due_date || null,
            };

        case 'final-report':
            if (
                !enforcement || enforcement.status !== 'DONE' ||
                (finalReport && finalReport.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_status: inDepth?.status || '-',
                indepth_done_date: inDepth?.status_date || null,
                enf_status: enforcement.status || '-',
                enforcement_done_date: enforcement.status_date || null,
                final_report_status: finalReport?.status || 'Pending',
                final_report_due_date: finalReport?.due_date || null,
            };

        case 'invoices':
            if (
                !finalReport || finalReport.status !== 'DONE' ||
                (invoice && (invoice.status === 'PAID' || invoice.status === 'ISSUED'))
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_status: upload?.decision_status || '-',
                decision_date: upload?.decision_date || null,
                indepth_done_date: inDepth?.status_date || null,
                enforcement_done_date: enforcement?.status_date || null,
                final_report_date: finalReport.submission_date || null,
                inv_number: invoice?.invoice_number || '-',
                inv_status: invoice?.status || 'Pending',
                inv_amount_usd: invoice?.amount_usd ?? '-',
                inv_due_date: invoice?.due_date || null,
            };

        case 'destruction':
            if (
                !enforcement || enforcement.status !== 'DONE' ||
                (destruction && destruction.status === 'DONE')
            ) return null;
            return {
                ...base,
                target_category: c.target_category || '-',
                target_address: c.target_address || '-',
                products_name: c.products_name || '-',
                case_reported_date: c.case_reported_date,
                upload_date: upload?.upload_date || null,
                decision_date: upload?.decision_date || null,
                indepth_done_date: inDepth?.status_date || null,
                enforcement_done_date: enforcement.status_date || null,
                final_report_date: finalReport?.submission_date || null,
                inv_status: invoice?.status || '-',
                dest_status: destruction?.status || 'Pending',
                dest_due_date: destruction?.due_date || null,
            };
    }
}

// ─── Generate Excel buffer from rows + columns ─────────────────────────────

function generateExcel(rows: Record<string, any>[], columnDefs: ColumnDef[]): Uint8Array {
    const DATE_KEYS = [
        'case_reported_date', 'upload_date', 'decision_date', 'due_date',
        'indepth_due_date', 'indepth_done_date', 'enf_due_date', 'enforcement_done_date',
        'final_report_date', 'final_report_due_date', 'inv_due_date', 'dest_due_date',
    ];
    const CURRENCY_KEYS = ['our_fee_usd', 'inv_amount_usd'];

    const exportRows = rows.map(row => {
        const out: Record<string, any> = {};
        for (const col of columnDefs) {
            let val = row[col.key];
            if (DATE_KEYS.includes(col.key)) {
                val = val ? fmtDate(val) : '';
            } else if (CURRENCY_KEYS.includes(col.key)) {
                val = val != null && val !== '-' ? `$${Number(val).toLocaleString()}` : '';
            }
            out[col.label] = val ?? '';
        }
        return out;
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new Uint8Array(buf);
}

// ─── Build email HTML ──────────────────────────────────────────────────────

function buildEmailHtml(reportTitle: string, dateStr: string, reportType: ReportType): string {
    const siteUrl = Deno.env.get('SITE_URL') || 'https://caseview.dap-ip.com';
    const reportPath = `${siteUrl}/pending-work/${reportType}`;
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
            <div style="text-align:center;padding:24px 0;">
                <h1 style="margin:0;color:#f1f5f9;font-size:22px;font-weight:700;">DAP Dashboard</h1>
                <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Deduct & Protect</p>
            </div>
            <div style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
                <div style="background:#2563eb;padding:20px 24px;text-align:center;">
                    <span style="font-size:32px;">&#128202;</span>
                    <h2 style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">Weekly Pending Report</h2>
                </div>
                <div style="padding:24px;">
                    <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0 0 16px;">
                        Please find attached the weekly pending report as of <strong style="color:#f1f5f9;">${dateStr}</strong>.
                    </p>
                    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                        <tr>
                            <td style="padding:8px 12px;color:#94a3b8;font-size:13px;border-bottom:1px solid #1e293b;">Report</td>
                            <td style="padding:8px 12px;color:#f1f5f9;font-size:13px;border-bottom:1px solid #1e293b;font-weight:600;">${reportTitle}</td>
                        </tr>
                        <tr>
                            <td style="padding:8px 12px;color:#94a3b8;font-size:13px;">Generated</td>
                            <td style="padding:8px 12px;color:#f1f5f9;font-size:13px;font-weight:600;">${dateStr}</td>
                        </tr>
                    </table>
                    <div style="text-align:center;margin:24px 0 8px;">
                        <a href="${reportPath}"
                           style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;">
                            View on Dashboard
                        </a>
                    </div>
                </div>
            </div>
            <div style="text-align:center;padding:24px 0;">
                <p style="color:#475569;font-size:12px;margin:0;">
                    This is an automated weekly report from DAP Dashboard.
                </p>
                <p style="color:#475569;font-size:12px;margin:4px 0 0;">
                    Manage settings in Alerts & Reminders > Weekly Reports.
                </p>
            </div>
        </div>
    </body>
    </html>`;
}

// ─── Main handler ───────────────────────────────────────────────────────────

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
        const FROM_EMAIL = GMAIL_USER
        const REPLY_TO = 'deductandprotect@gmail.com'

        // 0. Check if current PKT day/time matches the configured schedule
        //    The cron runs every hour; we only proceed when the schedule matches.
        const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
        const forceRun = body?.force === true

        const { data: allSettings, error: settingsError } = await supabaseClient
            .from('weekly_report_settings')
            .select('*')

        if (settingsError) throw settingsError

        if (!forceRun) {
            // Read schedule from first row (global setting, same across all rows)
            const scheduleDay = allSettings?.[0]?.schedule_day || 'Monday'
            const scheduleTime = allSettings?.[0]?.schedule_time || '08:00'
            const [schedHStr, schedMStr] = scheduleTime.split(':')
            const scheduledHour = parseInt(schedHStr, 10)
            const scheduledMinute = parseInt(schedMStr || '0', 10)

            // Current time in PKT (UTC+5)
            const nowUtc = new Date()
            const pktOffset = 5 * 60 * 60 * 1000
            const nowPkt = new Date(nowUtc.getTime() + pktOffset)
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const currentDay = dayNames[nowPkt.getUTCDay()]
            const currentHour = nowPkt.getUTCHours()
            const currentMinute = nowPkt.getUTCMinutes()

            if (currentDay !== scheduleDay || currentHour !== scheduledHour || currentMinute !== scheduledMinute) {
                console.log(`Schedule check: current ${currentDay} ${currentHour}:${String(currentMinute).padStart(2,'0')} PKT ≠ configured ${scheduleDay} ${scheduleTime} PKT — skipping.`)
                return new Response(JSON.stringify({ message: 'Not scheduled now', currentDay, currentHour, currentMinute, scheduleDay, scheduleTime }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }
            console.log(`Schedule match: ${currentDay} ${currentHour}:${String(currentMinute).padStart(2,'0')} PKT — proceeding.`)
        } else {
            console.log('Force run requested — skipping schedule check.')
        }

        // 1. Filter to enabled settings with email addresses
        const activeSettings = (allSettings || []).filter(
            (s: any) => s.is_enabled && s.email_addresses && s.email_addresses.trim().length > 0
        )

        if (activeSettings.length === 0) {
            console.log('No active weekly report settings found — nothing to send.')
            return new Response(JSON.stringify({ message: 'No active reports configured' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Fetch all cases with relations (single query, same as PendingWorkReport)
        const { data: cases, error: casesError } = await supabaseClient
            .from('cases')
            .select(`
                *,
                case_uploads(*),
                in_depth_stages(*),
                enforcement_stages(*),
                final_reports(*),
                invoices(*),
                destruction_stages(*)
            `)
            .order('created_at', { ascending: false })

        if (casesError) throw casesError

        const allCases = cases || []
        const today = new Date()
        const dateStr = fmtDate(today.toISOString())
        const dateFileStr = today.toISOString().split('T')[0]

        const results: any[] = []

        // 3. Process each active report
        for (const setting of activeSettings) {
            const reportType = setting.report_type as ReportType
            const config = getReportConfig(reportType)
            const emails = setting.email_addresses.split(',').map((e: string) => e.trim()).filter(Boolean)

            try {
                // Flatten rows using the same logic as PendingWorkReport
                const rows = allCases
                    .map((c: any) => flattenRow(c, reportType))
                    .filter(Boolean) as Record<string, any>[]

                // Generate Excel
                const excelBuffer = generateExcel(rows, config.columnDefs)
                const base64Excel = btoa(String.fromCharCode(...excelBuffer))
                const fileName = `${config.title.replace(/ /g, '-')}_${dateFileStr}.xlsx`

                // Send email via Gmail SMTP
                let emailSent = false
                let errorMessage = ''

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
                            from: `DAP Weekly Report <${FROM_EMAIL}>`,
                            to: emails,
                            replyTo: REPLY_TO,
                            subject: `Weekly Pending Report – ${config.title}`,
                            html: buildEmailHtml(config.title, dateStr, reportType),
                            attachments: [
                                {
                                    filename: fileName,
                                    content: excelBuffer,
                                    encoding: 'binary',
                                    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                },
                            ],
                        })

                        await client.close()
                        emailSent = true
                        console.log(`[${reportType}] Email sent to ${emails.join(', ')} (${rows.length} rows)`)
                    } catch (emailErr: any) {
                        errorMessage = emailErr.message || 'Email send failed'
                        console.error(`[${reportType}] Email error:`, emailErr)
                    }
                } else {
                    console.warn('GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping email, logging only.')
                    errorMessage = 'Gmail SMTP not configured'
                }

                // Log result
                await supabaseClient
                    .from('weekly_email_logs')
                    .insert([{
                        report_type: reportType,
                        email_addresses: emails.join(', '),
                        row_count: rows.length,
                        sent_at: new Date().toISOString(),
                        email_status: emailSent ? 'SENT' : 'FAILED',
                        error_message: errorMessage || null,
                    }])

                results.push({
                    report_type: reportType,
                    title: config.title,
                    rows: rows.length,
                    emails: emails.join(', '),
                    status: emailSent ? 'SENT' : 'FAILED',
                })

            } catch (reportErr: any) {
                console.error(`[${reportType}] Error processing report:`, reportErr)

                // Log failure
                await supabaseClient
                    .from('weekly_email_logs')
                    .insert([{
                        report_type: reportType,
                        email_addresses: emails.join(', '),
                        row_count: 0,
                        sent_at: new Date().toISOString(),
                        email_status: 'FAILED',
                        error_message: reportErr.message || 'Unknown error',
                    }])

                results.push({
                    report_type: reportType,
                    title: config.title,
                    rows: 0,
                    status: 'FAILED',
                    error: reportErr.message,
                })
            }
        }

        return new Response(JSON.stringify({
            message: 'Weekly pending reports processed',
            processed: results.length,
            results,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('Error in weekly-pending-reports function:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
