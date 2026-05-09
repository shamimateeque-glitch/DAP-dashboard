import * as XLSX from 'xlsx';
import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────
export interface RawExcelRow {
    [key: string]: any;
}

export interface ParsedCaseRow {
    // Case fields
    case_type?: string;
    matter_code?: string;
    case_id?: string;
    brand_name: string;
    products_name: string;
    target_name: string;
    target_category: string;
    target_address: string;
    city: string;
    province: string;
    case_reported_date: string;  // YYYY-MM-DD
    case_reported_by?: string;
    case_status: string;
    notes_description?: string;
    closed_date?: string;

    // Upload fields
    client?: string;          // ONEWORLD | A.A ASSOCIATES | SAFEMARK
    upload_date?: string;
    decision_status?: string; // APPROVED | REJECTED
    decision_date?: string;
    our_fee_usd?: number;

    // In-Depth fields
    indepth_due_date?: string;
    indepth_status?: string;
    indepth_status_date?: string;

    // Enforcement fields
    enforcement_due_date?: string;
    enforcement_status?: string;
    enforcement_status_date?: string;

    // Final Report fields
    final_report_due_date?: string;
    final_report_status?: string;
    final_report_status_date?: string;

    // Invoice fields
    invoice_number?: string;
    invoice_issue_date?: string;
    invoice_due_date?: string;
    invoice_amount_usd?: number;
    invoice_status?: string;
    invoice_status_date?: string;

    // Destruction fields
    destruction_due_date?: string;
    destruction_status?: string;
    destruction_status_date?: string;
}

export interface ValidationError {
    row: number;
    field: string;
    message: string;
}

export interface ImportResult {
    success: number;
    failed: number;
    errors: { row: number; error: string }[];
}

// ── Column Name Mapping ─────────────────────────────────────────────────
// Maps Excel column headers (case-insensitive, trimmed) to internal keys
// NOTE: Export headers (from CaseList.tsx) are listed first for each group
//       so re-importing an exported file works seamlessly.
const COLUMN_MAP: Record<string, string> = {
    // ── Basic Case Info ──────────────────────────────────────────────────
    // Export headers
    'case id': 'case_id',
    'case type': 'case_type',
    'case_type': 'case_type',
    'matter code': 'matter_code',
    'target name': 'target_name',
    'brand': 'brand_name',
    'products': 'products_name',
    'client': 'client',
    'province': 'province',
    'city': 'city',
    'target address': 'target_address',
    'status': 'case_status',
    'reported date': 'case_reported_date',
    'submitted date': 'case_reported_date',
    'submitted by': 'case_reported_by',
    'reported by': 'case_reported_by',
    // Legacy / alternate headers
    'case_id': 'case_id',
    'matter_code': 'matter_code',
    'brand name': 'brand_name',
    'brand_name': 'brand_name',
    'product': 'products_name',
    'product name': 'products_name',
    'products name': 'products_name',
    'products_name': 'products_name',
    'target_name': 'target_name',
    'target_category': 'target_category',
    'target category': 'target_category',
    'target_address': 'target_address',
    'case_submission_date': 'case_reported_date',
    'case submission date': 'case_reported_date',
    'submission date': 'case_reported_date',
    'case submitted by': 'case_reported_by',
    'case_submitted_by': 'case_reported_by',
    'case_reported by': 'case_reported_by',
    'case reported by': 'case_reported_by',
    'case status': 'case_status',
    'case_status': 'case_status',

    // ── Upload / Client Info ─────────────────────────────────────────────
    // Export headers
    'upload date': 'upload_date',
    'our fee (usd)': 'our_fee_usd',
    'decision status': 'decision_status',
    'decision date': 'decision_date',
    // Legacy / alternate headers
    'case uploaded to': 'client',
    'case uploaded_to': 'client',
    'uploaded to': 'client',
    'case uploaded date': 'upload_date',
    'case uploaded_date': 'upload_date',
    'case upload date': 'upload_date',
    'our fee usd': 'our_fee_usd',
    'our_fee_usd': 'our_fee_usd',
    'fee': 'our_fee_usd',
    'case rejected (yes/no)': 'case_rejected',
    'case rejected': 'case_rejected',
    'case rejected date': 'case_rejected_date',
    'case approved (yes/no)': 'case_approved',
    'case approved': 'case_approved',
    'case_approved_date': 'case_approved_date',
    'case approved date': 'case_approved_date',

    // ── In-Depth Stage ───────────────────────────────────────────────────
    // Export headers
    'in-depth due date': 'indepth_due_date',
    'in-depth target date': 'indepth_due_date',
    'in-depth status': 'indepth_status',
    'in-depth completed date': 'indepth_status_date',
    // Legacy / alternate headers
    'indepth_due_date': 'indepth_due_date',
    'indepth due date': 'indepth_due_date',
    'in depth due date': 'indepth_due_date',
    'indepth target date': 'indepth_due_date',
    'indepth status': 'indepth_status',
    'in depth status': 'indepth_status',
    'indepth status date': 'indepth_status_date',
    'in depth status date': 'indepth_status_date',
    'in-depth status date': 'indepth_status_date',
    'indepth completed date': 'indepth_status_date',
    'in depth completed date': 'indepth_status_date',
    'indepth stage': 'indepth_status',
    'in depth stage': 'indepth_status',
    'in-depth stage': 'indepth_status',

    // ── Enforcement Stage ────────────────────────────────────────────────
    // Export headers
    'enforcement due date': 'enforcement_due_date',
    'enforcement target date': 'enforcement_due_date',
    'enforcement status': 'enforcement_status',
    'enforcement completed date': 'enforcement_status_date',
    // Legacy / alternate headers
    'enforcement_due_date': 'enforcement_due_date',
    'enforcment due date': 'enforcement_due_date',
    'enforcment status': 'enforcement_status',
    'enforcement stage': 'enforcement_status',
    'enforcment stage': 'enforcement_status',
    'enforcement status date': 'enforcement_status_date',
    'enforcment status date': 'enforcement_status_date',
    'enforcment completed date': 'enforcement_status_date',

    // ── Destruction Stage ────────────────────────────────────────────────
    // Export headers
    'destruction due date': 'destruction_due_date',
    'destruction status': 'destruction_status',
    'destruction completed date': 'destruction_status_date',
    // Legacy / alternate headers
    'destruction_due_date': 'destruction_due_date',
    'destruction_status': 'destruction_status',
    'destruction status date': 'destruction_status_date',
    'destruction_status_date': 'destruction_status_date',

    // ── Final Report ─────────────────────────────────────────────────────
    // Export headers
    'final report date': 'final_report_date',
    // Legacy / alternate headers
    'final report submission date': 'final_report_due_date',
    'final report submission due date': 'final_report_due_date',
    'final report submission status': 'final_report_status',
    'final report submission status date': 'final_report_status_date',

    // ── Invoice ──────────────────────────────────────────────────────────
    // Export headers
    'invoice number': 'invoice_number',
    'invoice issue date': 'invoice_issue_date',
    'invoice due date': 'invoice_due_date',
    'invoice amount (usd)': 'invoice_amount_usd',
    'invoice status': 'invoice_status',
    // Legacy / alternate headers
    'invoice_number': 'invoice_number',
    'invoice #': 'invoice_number',
    'invoice_amount': 'invoice_amount_usd',
    'invoice amount': 'invoice_amount_usd',
    'invoice_due_date': 'invoice_due_date',
    'invoice_issue_date': 'invoice_issue_date',
    'invoice status date': 'invoice_status_date',

    // ── Closure ──────────────────────────────────────────────────────────
    // Export headers
    'closed date': 'closed_date',
    // Legacy / alternate headers
    'closed_date': 'closed_date',
    'closure date': 'closed_date',

    // ── Notes ────────────────────────────────────────────────────────────
    'remarks/notes': 'notes_description',
    'remarks': 'notes_description',
    'notes': 'notes_description',
};

// ── Date Parsing ────────────────────────────────────────────────────────
function parseExcelDate(value: any): string | undefined {
    if (!value) return undefined;

    // Handle Excel serial date numbers
    if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            const y = date.y;
            const m = String(date.m).padStart(2, '0');
            const d = String(date.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return undefined;
    }

    const str = String(value).trim();
    if (!str) return undefined;

    // Try YYYY-MM-DD (already correct format)
    const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
        const [, year, month, day] = yyyymmdd;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try DD/MM/YYYY or MM/DD/YYYY (ambiguous format)
    const slashDate = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashDate) {
        const [, first, second, year] = slashDate;
        const a = parseInt(first, 10);
        const b = parseInt(second, 10);

        let day: number, month: number;

        if (a > 12 && b <= 12) {
            // First number > 12, must be DD/MM/YYYY
            day = a;
            month = b;
        } else if (b > 12 && a <= 12) {
            // Second number > 12, must be MM/DD/YYYY
            month = a;
            day = b;
        } else {
            // Both <= 12: ambiguous — default to DD/MM/YYYY (Pakistan standard)
            day = a;
            month = b;
        }

        // Validate ranges
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        console.warn(`[importCases] Invalid date values: "${str}" — day=${day}, month=${month}. Skipping.`);
        return undefined;
    }

    // Try YYYY/MM/DD
    const yyyySlash = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (yyyySlash) {
        const [, year, month, day] = yyyySlash;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return undefined;
}

// ── Client Code Mapping ─────────────────────────────────────────────────
function mapClient(value: any): string | undefined {
    if (!value) return undefined;
    const str = String(value).trim().toUpperCase();
    if (!str) return undefined;

    // Exact matches
    const clientMap: Record<string, string> = {
        'OW': 'ONEWORLD',
        'ONEWORLD': 'ONEWORLD',
        'ONEWORLD IP': 'ONEWORLD',
        'ONE WORLD IP': 'ONEWORLD',
        'ONE WORLD': 'ONEWORLD',
        'AA': 'A.A ASSOCIATES',
        'A.A': 'A.A ASSOCIATES',
        'A.A ASSOCIATES': 'A.A ASSOCIATES',
        'A.A & ASSOCIATES': 'A.A ASSOCIATES',
        'AA & ASSOCIATES': 'A.A ASSOCIATES',
        'A.A AND ASSOCIATES': 'A.A ASSOCIATES',
        'A&A': 'A.A ASSOCIATES',
        'SM': 'SAFEMARK',
        'SAFEMARK': 'SAFEMARK',
        'SAFE MARK': 'SAFEMARK',
        'SAFE MARK IP': 'SAFEMARK',
        'SAFEMARK IP': 'SAFEMARK',
        'SAFE-MARK': 'SAFEMARK',
        'SAFE-MARK IP': 'SAFEMARK',
        'DI': 'DAP-IP',
        'DAP': 'DAP-IP',
        'DAP-IP': 'DAP-IP',
        'DAP IP': 'DAP-IP',
        'DAPIP': 'DAP-IP',
    };

    if (clientMap[str]) return clientMap[str];

    // Keyword matches (very robust)
    if (str.includes('WORLD')) return 'ONEWORLD';
    if (str.includes('SAFEMARK') || str.includes('SAFE MARK') || str.includes('SAFE-MARK')) return 'SAFEMARK';
    if (str.includes('SAFE') && str.includes('MARK')) return 'SAFEMARK';
    if (str.includes('ASSOCIATES') || str.includes('A.A') || str === 'AA') return 'A.A ASSOCIATES';
    if (str.includes('DAP-IP') || str.includes('DAP IP') || str === 'DAPIP' || str === 'DAP') return 'DAP-IP';

    // Single-letter code fallback (in case column has just initials)
    if (str === 'O' || str === 'OW') return 'ONEWORLD';
    if (str === 'S' || str === 'SM') return 'SAFEMARK';
    if (str === 'A') return 'A.A ASSOCIATES';

    // Log unrecognized values to help debugging
    console.warn(`[importCases] Unrecognized client value: "${String(value).trim()}" — upload record will be skipped for this case.`);
    return undefined;
}

// ── Status Mapping ──────────────────────────────────────────────────────
function mapWorkflowStatus(value: any): string | undefined {
    if (!value) return undefined;
    const str = String(value).trim().toLowerCase();
    if (str === 'done' || str === 'completed' || str === 'finished' || str === 'yes') return 'DONE';
    if (str === 'in-progress' || str === 'in progress' || str === 'ip' || str === 'in_progress' || str === 'active' || str === 'doing') return 'IN_PROGRESS';
    if (str === 'not started' || str === 'pending' || str === 'no' || str === 'todo') return undefined;
    return undefined;
}

function mapCaseStatus(value: any): string {
    if (!value) return 'IN_HAND';
    const str = String(value)
        .replace(/[\u00A0\uFEFF\u200B\u200C\u200D\u2060]/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    // Only map to valid case statuses:
    // IN_HAND, UPLOADED, APPROVED, REJECTED, IN_DEPTH, ENFORCEMENT, DESTRUCTION, CLOSED
    const statusMap: Record<string, string> = {
        'in hand': 'IN_HAND',
        'in_hand': 'IN_HAND',
        'in-hand': 'IN_HAND',
        'uploaded': 'UPLOADED',
        'approved': 'APPROVED',
        'rejected': 'REJECTED',
        'in depth': 'IN_DEPTH',
        'in_depth': 'IN_DEPTH',
        'in-depth': 'IN_DEPTH',
        'enforcement': 'ENFORCEMENT',
        'final report': 'ENFORCEMENT',
        'final_report': 'ENFORCEMENT',
        'invoiced': 'DESTRUCTION',
        'destruction': 'DESTRUCTION',
        'closed': 'CLOSED',
    };
    if (statusMap[str]) return statusMap[str];

    // Keyword fallback — only match valid case statuses
    if (str.includes('close')) return 'CLOSED';
    if (str.includes('destruct')) return 'DESTRUCTION';
    if (str.includes('enforce')) return 'ENFORCEMENT';
    if (str.includes('depth')) return 'IN_DEPTH';
    if (str.includes('reject')) return 'REJECTED';
    if (str.includes('approv')) return 'APPROVED';
    if (str.includes('upload')) return 'UPLOADED';

    // Unrecognized (e.g. "DONE") → default to IN_HAND, let inference logic decide
    console.warn(`[importCases] Unrecognized case status: "${String(value).trim()}" — defaulting to IN_HAND. Inference will determine actual status from workflow data.`);
    return 'IN_HAND';
}

function mapInvoiceStatus(value: any): string | undefined {
    if (!value) return undefined;

    // Strip invisible characters (non-breaking spaces, BOM, zero-width chars) then normalize
    const str = String(value)
        .replace(/[\u00A0\uFEFF\u200B\u200C\u200D\u2060]/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')   // remove special chars like ✓ . () etc.
        .replace(/\s+/g, ' ')       // collapse multiple spaces
        .trim();

    if (!str) return undefined;

    // PAID variations
    if (str === 'paid' || str === 'p' || str === 'yes paid' || str === 'paid in full'
        || str === 'payment received' || str === 'received' || str === 'cleared'
        || str === 'done' || str === 'completed' || str === 'finished') {
        return 'PAID';
    }

    // NOT_PAID variations
    if (str === 'not paid' || str === 'not_paid' || str === 'unpaid' || str === 'un paid'
        || str === 'np' || str === 'notpaid' || str === 'pending payment'
        || str === 'payment pending' || str === 'awaiting payment') {
        return 'NOT_PAID';
    }

    // ISSUED variations — collapsed into NOT_PAID since the UI treats them identically
    if (str === 'issued' || str === 'sent' || str === 'invoice sent' || str === 'invoiced'
        || str === 'billed' || str === 'submitted') {
        return 'NOT_PAID';
    }

    // Keyword fallback — check if the value contains key identifiers
    if (str.includes('paid') && !str.includes('not') && !str.includes('un')) return 'PAID';
    if (str.includes('not') || str.includes('unpaid') || str.includes('un paid')) return 'NOT_PAID';
    if (str.includes('issue') || str.includes('sent') || str.includes('bill')) return 'NOT_PAID';

    console.warn(`[importCases] Unrecognized invoice status: "${String(value).trim()}". Please check this value in your Excel file.`);
    return undefined;
}

// ── Province Normalization ────────────────────────────────────────────
// Valid provinces: Sindh, Punjab, KPK, Balochistan
function normalizeProvince(value: any): string {
    if (!value) return '';
    const str = String(value).trim();
    const lower = str.toLowerCase();

    const provinceMap: Record<string, string> = {
        'sindh': 'Sindh',
        'sind': 'Sindh',
        'punjab': 'Punjab',
        'kpk': 'KPK',
        'khyber pakhtunkhwa': 'KPK',
        'khyber': 'KPK',
        'nwfp': 'KPK',
        'balochistan': 'Balochistan',
        'baluchistan': 'Balochistan',
        'baloch': 'Balochistan',
    };

    if (provinceMap[lower]) return provinceMap[lower];

    // "Pakistan" is the country, not a province — default to empty so validation catches it
    if (lower === 'pakistan' || lower === 'pk') {
        console.warn(`[importCases] Province value "${str}" is a country, not a province. Defaulting to empty — validation will flag this row.`);
        return '';
    }

    // Keyword fallback
    if (lower.includes('sindh') || lower.includes('sind')) return 'Sindh';
    if (lower.includes('punjab')) return 'Punjab';
    if (lower.includes('kpk') || lower.includes('khyber') || lower.includes('pakhtun')) return 'KPK';
    if (lower.includes('baloch') || lower.includes('baluch')) return 'Balochistan';

    // Return as-is if unrecognized (might be a valid city-state or special case)
    return str;
}

function isYes(value: any): boolean {
    if (!value) return false;
    const str = String(value).trim().toLowerCase();
    return str === 'yes' || str === 'y' || str === 'true' || str === '1';
}

// ── Parse Excel File ────────────────────────────────────────────────────
export function parseExcelFile(file: File): Promise<{ rows: RawExcelRow[]; headers: string[] }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array', cellDates: false });

                // Read the first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON with header row
                const jsonData = XLSX.utils.sheet_to_json<RawExcelRow>(worksheet, {
                    defval: '',
                    raw: true,
                });

                // Get headers
                const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

                resolve({ rows: jsonData, headers });
            } catch (err) {
                reject(new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
    });
}

// ── Map Raw Row to Internal Format ──────────────────────────────────────
function mapRowToInternal(raw: RawExcelRow): Record<string, any> {
    const mapped: Record<string, any> = {};

    for (const [excelHeader, value] of Object.entries(raw)) {
        const normalizedHeader = excelHeader.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');

        // Try exact match first
        let internalKey = COLUMN_MAP[normalizedHeader];

        // Try with underscores restored
        if (!internalKey) {
            const withUnderscores = excelHeader.trim().toLowerCase();
            internalKey = COLUMN_MAP[withUnderscores];
        }

        // Fuzzy: try partial match
        if (!internalKey) {
            for (const [pattern, key] of Object.entries(COLUMN_MAP)) {
                if (normalizedHeader.includes(pattern) || pattern.includes(normalizedHeader)) {
                    internalKey = key;
                    break;
                }
            }
        }

        if (internalKey && internalKey !== '_skip_') {
            mapped[internalKey] = value;
        }
    }

    return mapped;
}

// ── Transform Row ───────────────────────────────────────────────────────
export function transformRow(raw: RawExcelRow): ParsedCaseRow | null {
    const m = mapRowToInternal(raw);

    // Skip empty rows (no target name or brand)
    if (!m.target_name && !m.brand_name) return null;

    // Determine decision status
    let decisionStatus: string | undefined;
    let decisionDate: string | undefined;

    // Direct mapping from export: "Decision Status" / "Decision Date"
    if (m.decision_status) {
        const ds = String(m.decision_status).trim().toUpperCase();
        if (ds === 'APPROVED' || ds === 'REJECTED') {
            decisionStatus = ds;
            decisionDate = parseExcelDate(m.decision_date);
        }
    }
    // Fallback: legacy yes/no columns
    if (!decisionStatus) {
        if (isYes(m.case_approved)) {
            decisionStatus = 'APPROVED';
            decisionDate = parseExcelDate(m.case_approved_date);
        } else if (isYes(m.case_rejected)) {
            decisionStatus = 'REJECTED';
            decisionDate = parseExcelDate(m.case_rejected_date);
        }
    }

    // Determine client from either "Client" or "Case Uploaded to"
    const client = mapClient(m.client) || mapClient(m.upload_client);

    // Normalize case type: "Custom" → "Customs", "market" → "Market"
    let caseType: string | undefined;
    if (m.case_type) {
        const ct = String(m.case_type).trim().toLowerCase();
        if (ct === 'customs' || ct === 'custom') caseType = 'Customs';
        else if (ct === 'market') caseType = 'Market';
        else caseType = String(m.case_type).trim(); // preserve original if unknown
    }

    const row: ParsedCaseRow = {
        case_type: caseType,
        case_id: m.case_id ? String(m.case_id).trim() : undefined,
        matter_code: m.matter_code ? String(m.matter_code).trim() : undefined,
        brand_name: String(m.brand_name || '').trim(),
        products_name: String(m.products_name || '').trim(),
        target_name: String(m.target_name || '').trim(),
        target_category: String(m.target_category || '').trim(),
        target_address: String(m.target_address || '').trim(),
        city: String(m.city || '').trim(),
        province: normalizeProvince(m.province),
        case_reported_date: parseExcelDate(m.case_reported_date) || new Date().toISOString().split('T')[0],
        case_reported_by: m.case_reported_by ? String(m.case_reported_by).trim() : undefined,
        case_status: mapCaseStatus(m.case_status),
        notes_description: m.notes_description ? String(m.notes_description).trim() : undefined,
        closed_date: parseExcelDate(m.closed_date),

        client,
        upload_date: parseExcelDate(m.upload_date),
        decision_status: decisionStatus,
        decision_date: decisionDate,
        our_fee_usd: (m.our_fee_usd !== undefined && m.our_fee_usd !== '') ? Number(m.our_fee_usd) : undefined,

        indepth_due_date: parseExcelDate(m.indepth_due_date),
        indepth_status: mapWorkflowStatus(m.indepth_status),
        indepth_status_date: parseExcelDate(m.indepth_status_date),

        enforcement_due_date: parseExcelDate(m.enforcement_due_date),
        enforcement_status: mapWorkflowStatus(m.enforcement_status),
        enforcement_status_date: parseExcelDate(m.enforcement_status_date),

        // "Final Report Date" from export maps to final_report_date (submission date)
        // Legacy columns use final_report_due_date / final_report_status_date
        final_report_due_date: parseExcelDate(m.final_report_date) || parseExcelDate(m.final_report_due_date),
        final_report_status: m.final_report_status ? String(m.final_report_status).trim() : undefined,
        final_report_status_date: parseExcelDate(m.final_report_status_date),

        invoice_number: m.invoice_number ? String(m.invoice_number).trim() : undefined,
        invoice_issue_date: parseExcelDate(m.invoice_issue_date),
        invoice_due_date: parseExcelDate(m.invoice_due_date),
        invoice_amount_usd: (m.invoice_amount_usd !== undefined && m.invoice_amount_usd !== '') ? Number(m.invoice_amount_usd) : undefined,
        invoice_status: mapInvoiceStatus(m.invoice_status),
        invoice_status_date: parseExcelDate(m.invoice_status_date),

        destruction_due_date: parseExcelDate(m.destruction_due_date),
        destruction_status: mapWorkflowStatus(m.destruction_status),
        destruction_status_date: parseExcelDate(m.destruction_status_date),
    };

    // ── Infer / Correct Case Status ────────────────────────────────────────
    // Always upgrade to CLOSED if destruction is DONE or invoice is PAID,
    // regardless of what the Excel "Status" column says.
    if (row.destruction_status === 'DONE' || row.invoice_status === 'PAID') {
        row.case_status = 'CLOSED';
    }
    // For basic statuses, infer a better status from workflow data
    else if (row.case_status === 'IN_HAND' || row.case_status === 'APPROVED' || row.case_status === 'UPLOADED') {
        if (row.destruction_status || row.destruction_due_date) {
            row.case_status = 'DESTRUCTION';
        } else if (row.final_report_status === 'DONE' || row.final_report_due_date) {
            row.case_status = 'ENFORCEMENT';
        } else if (row.enforcement_status || row.enforcement_due_date) {
            row.case_status = 'ENFORCEMENT';
        } else if (row.indepth_status || row.indepth_due_date) {
            row.case_status = 'IN_DEPTH';
        } else if (row.decision_status === 'APPROVED') {
            row.case_status = 'APPROVED';
        }
    }
    // Also correct explicit DESTRUCTION if destruction is actually DONE
    else if (row.case_status === 'DESTRUCTION' && row.destruction_status === 'DONE') {
        row.case_status = 'CLOSED';
    }

    return row;
}

// ── Validate Row ────────────────────────────────────────────────────────
export function validateRow(row: ParsedCaseRow, index: number): ValidationError[] {
    const errors: ValidationError[] = [];
    const rowNum = index + 2; // +2 because Excel is 1-indexed and has a header row

    if (!row.target_name) errors.push({ row: rowNum, field: 'Target Name', message: 'Target Name is required' });
    if (!row.brand_name) errors.push({ row: rowNum, field: 'Brand', message: 'Brand is required' });
    if (!row.city) errors.push({ row: rowNum, field: 'City', message: 'City is required' });
    if (!row.province) errors.push({ row: rowNum, field: 'Province', message: 'Province is required' });
    if (!row.case_reported_date) errors.push({ row: rowNum, field: 'Submission Date', message: 'Case Submission Date is required' });

    return errors;
}

// ── Clear All Existing Cases ────────────────────────────────────────────
export async function clearAllCases(supabase: SupabaseClient): Promise<void> {
    // Delete child tables first (or rely on CASCADE), then cases
    // Order matters if no CASCADE: children first, parent last
    const tables = [
        'alert_logs',
        'destruction_stages',
        'invoices',
        'final_reports',
        'enforcement_stages',
        'in_depth_stages',
        'case_uploads',
        'cases',
    ];

    for (const table of tables) {
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

        if (error) {
            console.warn(`Warning clearing ${table}:`, error.message);
        }
    }
}

// ── Import Cases into Supabase ──────────────────────────────────────────
export async function importCases(
    rows: ParsedCaseRow[],
    supabase: SupabaseClient,
    userId: string,
    userName: string,
    onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
    const result: ImportResult = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const excelRow = i + 2; // Excel row number

        onProgress?.(i + 1, rows.length);

        try {
            // 1. Insert into `cases` table
            // Determine Case Status — always honour destruction DONE / invoice PAID as CLOSED
            let finalStatus = row.case_status;

            // Force CLOSED if destruction is done or invoice is paid (regardless of Excel status)
            if (row.destruction_status === 'DONE' || row.invoice_status === 'PAID') {
                finalStatus = 'CLOSED';
            }
            // Infer from workflow data if status is basic
            else if (!finalStatus || finalStatus === 'IN_HAND') {
                if (row.destruction_status || row.destruction_due_date) finalStatus = 'DESTRUCTION';
                else if (row.final_report_status_date || row.final_report_due_date) finalStatus = 'ENFORCEMENT';
                else if (row.enforcement_status || row.enforcement_due_date) finalStatus = 'ENFORCEMENT';
                else if (row.indepth_status || row.indepth_due_date) finalStatus = 'IN_DEPTH';
                else if (row.decision_status === 'APPROVED') finalStatus = 'APPROVED';
                else if (row.decision_status === 'REJECTED') finalStatus = 'REJECTED';
                else if (row.client || row.upload_date) finalStatus = 'UPLOADED';
                else finalStatus = 'IN_HAND';
            }

            const casePayload: Record<string, any> = {
                case_type: row.case_type || null,
                target_name: row.target_name,
                target_category: row.target_category || 'Unknown',
                target_address: row.target_address || 'N/A',
                city: row.city,
                province: row.province,
                brand_name: row.brand_name,
                products_name: row.products_name || 'N/A',
                case_reported_date: row.case_reported_date,
                case_reported_by: row.case_reported_by || userName,
                case_status: finalStatus,
                created_by: userId,
            };

            // Case ID is auto-generated by DB trigger — do not set manually

            // Only set matter_code if provided in Excel — no auto-generation
            if (row.matter_code) {
                casePayload.matter_code = row.matter_code;
            }

            if (row.notes_description) casePayload.notes_description = row.notes_description;
            if (row.closed_date) casePayload.closed_date = row.closed_date;

            const { data: caseData, error: caseError } = await supabase
                .from('cases')
                .insert(casePayload)
                .select('id')
                .single();

            if (caseError) throw new Error(`Case insert failed: ${caseError.message}`);

            const caseId = caseData.id;

            // 2. Insert case_uploads if client data exists
            // client is required by the DB — only insert when we have a valid client value
            if (row.client) {
                const uploadPayload: Record<string, any> = {
                    case_id: caseId,
                    client: row.client,
                    upload_date: row.upload_date || row.case_reported_date,
                };
                if (row.our_fee_usd !== undefined && row.our_fee_usd !== null) uploadPayload.our_fee_usd = row.our_fee_usd;
                if (row.decision_status) uploadPayload.decision_status = row.decision_status;
                if (row.decision_date) uploadPayload.decision_date = row.decision_date;

                const { error: uploadError } = await supabase
                    .from('case_uploads')
                    .insert(uploadPayload);

                if (uploadError) {
                    result.errors.push({ row: excelRow, error: `Upload failed: ${uploadError.message}` });
                }
            }

            // 3. Insert in_depth_stages if data exists
            if (row.indepth_due_date || row.indepth_status) {
                const indepthPayload: Record<string, any> = {
                    case_id: caseId,
                    due_date: row.indepth_due_date || row.case_reported_date,
                    status: row.indepth_status || 'IN_PROGRESS',
                };
                if (row.indepth_status_date) indepthPayload.status_date = row.indepth_status_date;

                const { error: indepthError } = await supabase
                    .from('in_depth_stages')
                    .insert(indepthPayload);

                if (indepthError) {
                    result.errors.push({ row: excelRow, error: `In-Depth failed: ${indepthError.message}` });
                }
            }

            // 4. Insert enforcement_stages if data exists
            //    Also auto-create if in-depth is DONE but no enforcement data in Excel
            const hasEnforcementData = row.enforcement_due_date || row.enforcement_status;
            const indepthIsDone = row.indepth_status && row.indepth_status.toUpperCase() === 'DONE';
            if (hasEnforcementData || indepthIsDone) {
                let enfDueDate = row.enforcement_due_date;
                if (!enfDueDate && indepthIsDone) {
                    // Auto-calculate: in-depth completion + 7 days
                    const baseDate = row.indepth_status_date
                        ? new Date(row.indepth_status_date)
                        : new Date();
                    baseDate.setDate(baseDate.getDate() + 7);
                    enfDueDate = baseDate.toISOString().split('T')[0];
                }
                const enforcementPayload: Record<string, any> = {
                    case_id: caseId,
                    due_date: enfDueDate || row.case_reported_date,
                    status: row.enforcement_status || 'IN_PROGRESS',
                };
                if (row.enforcement_status_date) enforcementPayload.status_date = row.enforcement_status_date;

                const { error: enfError } = await supabase
                    .from('enforcement_stages')
                    .insert(enforcementPayload);

                if (enfError) {
                    result.errors.push({ row: excelRow, error: `Enforcement failed: ${enfError.message}` });
                }
            }

            // 5. Insert final_reports if data exists
            if (row.final_report_due_date || row.final_report_status_date || (row.final_report_status && row.final_report_status.toLowerCase() === 'done')) {
                const frStatus = (row.final_report_status && row.final_report_status.toLowerCase() === 'done') ? 'DONE' : 'PENDING';
                const reportPayload: Record<string, any> = {
                    case_id: caseId,
                    status: frStatus,
                    due_date: row.final_report_due_date || null,
                    submission_date: row.final_report_status_date || row.final_report_due_date || new Date().toISOString().split('T')[0],
                };
                if (frStatus === 'DONE') {
                    reportPayload.status_date = row.final_report_status_date || new Date().toISOString();
                }

                const { error: reportError } = await supabase
                    .from('final_reports')
                    .insert(reportPayload);

                if (reportError) {
                    result.errors.push({ row: excelRow, error: `Final Report failed: ${reportError.message}` });
                }
            }

            // 6. Insert invoices if data exists (invoice_number is required — no auto-generation)
            if (row.invoice_number) {
                const today = new Date().toISOString().split('T')[0];

                // Warn if invoice has no recognized status — will default to ISSUED
                if (!row.invoice_status) {
                    console.warn(`[importCases] Row ${excelRow}: Invoice "${row.invoice_number}" has no recognized status — defaulting to ISSUED. If this invoice is PAID, it may incorrectly appear as OVERDUE.`);
                }

                const invoicePayload: Record<string, any> = {
                    case_id: caseId,
                    invoice_number: row.invoice_number,
                    issue_date: row.invoice_issue_date || row.invoice_due_date || today,
                    due_date: row.invoice_due_date || row.invoice_issue_date || today,
                    amount_usd: (row.invoice_amount_usd !== undefined && row.invoice_amount_usd !== null) ? row.invoice_amount_usd : (row.our_fee_usd ?? 0),
                    status: row.invoice_status || 'NOT_PAID',
                };
                if (row.invoice_status_date) invoicePayload.status_date = row.invoice_status_date;

                const { error: invoiceError } = await supabase
                    .from('invoices')
                    .insert(invoicePayload);

                if (invoiceError) {
                    result.errors.push({ row: excelRow, error: `Invoice failed: ${invoiceError.message}` });
                }
            }

            // 7. Insert destruction_stages if data exists
            if (row.destruction_due_date || row.destruction_status) {
                const destructionPayload: Record<string, any> = {
                    case_id: caseId,
                    due_date: row.destruction_due_date || row.case_reported_date,
                    status: row.destruction_status || 'IN_PROGRESS',
                };
                if (row.destruction_status_date) destructionPayload.status_date = row.destruction_status_date;

                const { error: destError } = await supabase
                    .from('destruction_stages')
                    .insert(destructionPayload);

                if (destError) {
                    result.errors.push({ row: excelRow, error: `Destruction failed: ${destError.message}` });
                }
            }

            // 8. Fix final case_status — DB triggers may have overwritten it.
            // Force CLOSED status and set best available closed_date.
            if (finalStatus === 'CLOSED') {
                const closedDate = row.closed_date
                    || row.destruction_status_date   // destruction completion date
                    || row.enforcement_status_date   // enforcement completion date
                    || row.invoice_status_date        // invoice payment date
                    || new Date().toISOString().split('T')[0];
                await supabase
                    .from('cases')
                    .update({
                        case_status: 'CLOSED',
                        closed_date: closedDate,
                    })
                    .eq('id', caseId);
            }

            result.success++;
        } catch (err: any) {
            result.failed++;
            result.errors.push({ row: excelRow, error: err.message || 'Unknown error' });
        }
    }

    return result;
}
