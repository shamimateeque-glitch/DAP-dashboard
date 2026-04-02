/**
 * Security utilities for input sanitization, error handling, and file validation.
 */

// ─── Supabase Query Sanitization ────────────────────────────────────────────

/**
 * Escape special characters for Supabase ILIKE/LIKE patterns.
 * Prevents query injection via %, _, \, and , characters.
 */
export const escapeLikePattern = (input: string): string => {
    return input.replace(/[\\%_,()]/g, '\\$&');
};

// ─── Error Message Sanitization ─────────────────────────────────────────────

/**
 * Return a user-friendly error message, stripping internal DB details
 * (table names, constraint names, RLS hints, PGRST codes) in production.
 */
export const sanitizeErrorMessage = (error: any, fallback = 'An unexpected error occurred. Please try again.'): string => {
    if (!error) return fallback;

    const raw: string = error.message || error.details || '';

    // In development, show full error for debugging
    if (import.meta.env.DEV) {
        return raw || fallback;
    }

    // Known Supabase / Postgres error codes → friendly messages
    const code: string = error.code || '';

    if (code === '23505') return 'A record with this information already exists.';
    if (code === '23503') return 'This record is referenced by other data and cannot be modified.';
    if (code === '42501' || raw.includes('row-level security')) return 'You do not have permission to perform this action.';
    if (code === 'PGRST301' || code === '401') return 'Your session has expired. Please log in again.';
    if (code === '23502') return 'A required field is missing. Please check your input.';
    if (raw.includes('Failed to fetch') || raw.includes('NetworkError')) return 'Network error. Please check your connection and try again.';

    // Strip any remaining technical details
    if (code.startsWith('PGRST') || code.startsWith('2')) return fallback;

    // If the message looks safe (no SQL/table references), return it
    if (raw.length < 120 && !raw.includes('relation') && !raw.includes('constraint') && !raw.includes('policy')) {
        return raw;
    }

    return fallback;
};

// ─── File Upload Validation ─────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXCEL_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;  // 5 MB
const MAX_EXCEL_SIZE = 10 * 1024 * 1024; // 10 MB

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

export const validateImageFile = (file: File): FileValidationResult => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return { valid: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed.' };
    }
    if (file.size > MAX_IMAGE_SIZE) {
        return { valid: false, error: `Image must be under ${MAX_IMAGE_SIZE / 1024 / 1024}MB.` };
    }
    return { valid: true };
};

export const validateExcelFile = (file: File): FileValidationResult => {
    // Check extension first
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        return { valid: false, error: 'Please upload an Excel file (.xlsx or .xls).' };
    }
    // Check MIME type (may be empty for drag & drop in some browsers, so allow empty)
    if (file.type && !ALLOWED_EXCEL_TYPES.includes(file.type)) {
        return { valid: false, error: 'Invalid file type. Only Excel files are accepted.' };
    }
    if (file.size > MAX_EXCEL_SIZE) {
        return { valid: false, error: `Excel file must be under ${MAX_EXCEL_SIZE / 1024 / 1024}MB.` };
    }
    return { valid: true };
};

// ─── Export Sanitization (Formula Injection Prevention) ─────────────────────

/**
 * Sanitize a cell value for CSV/Excel export to prevent formula injection.
 * Cells starting with =, +, -, @, \t, \r can trigger formula execution in Excel.
 */
export const sanitizeExportValue = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    if (/^[=+\-@\t\r]/.test(value)) {
        return `'${value}`;
    }
    return value;
};

/**
 * Sanitize all string values in a row object for safe CSV/Excel export.
 */
export const sanitizeExportRow = (row: Record<string, unknown>): Record<string, unknown> => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        sanitized[key] = sanitizeExportValue(value);
    }
    return sanitized;
};
