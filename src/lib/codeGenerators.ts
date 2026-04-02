import { supabase } from '@/lib/supabase';

// ─── Brand Abbreviations ────────────────────────────────────────────────────
export const BRAND_ABBREVIATIONS: Record<string, string> = {
  "Hugo Boss": "HUG",
  "Tommy Hilfiger": "TOM",
  "Calvin Klein": "CK",
  "Cavin Klein": "CK",
  "Puma": "PUM",
  "Guess": "GUS",
  "Porsche": "POR",
  "WD-40": "WD",
  "Harley davidson": "HD",
  "Harley Davidson": "HD",
  "Champion": "CHP",
  "Reebok": "RBK",
  "Levis": "LEV",
  "Levi's": "LEV",
  "New Balance": "NB",
  "Nike": "NK",
  "Gucci": "GUC",
  "Burberry": "BRB",
  "American Eagle": "AE",
  "BMW": "BMW",
  "Toyota": "TOY",
  "US polo": "USP",
  "U.S. Polo Assn": "USP",
  "Mars": "MRS",
  "Nutella": "NUT",
  "Biscoff Creamy": "BIS",
  "Skechers": "SKE",
  "Ordinary": "ORD",
  "Rolex": "RLX",
  "Patek Philip": "PTP",
};

// ─── Client Codes ────────────────────────────────────────────────────────────
export const CLIENT_CODES: Record<string, string> = {
  "ONEWORLD": "OW",
  "A.A ASSOCIATES": "AA",
  "SAFEMARK": "SM",
};

// ─── Case Type Codes ─────────────────────────────────────────────────────────
export const CASE_TYPE_CODES: Record<string, string> = {
  "Market": "MKT",
  "Customs": "CUS",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getBrandCode(brandName: string): string {
  // Exact match first
  if (BRAND_ABBREVIATIONS[brandName]) return BRAND_ABBREVIATIONS[brandName];
  // Case-insensitive match
  const lower = brandName.toLowerCase();
  for (const [key, code] of Object.entries(BRAND_ABBREVIATIONS)) {
    if (key.toLowerCase() === lower) return code;
  }
  // Fallback: first 2-3 uppercase chars
  const clean = brandName.replace(/[^a-zA-Z]/g, '');
  return clean.substring(0, Math.min(3, Math.max(2, clean.length))).toUpperCase();
}

export function getClientCode(client: string): string {
  return CLIENT_CODES[client] || CLIENT_CODES[client.toUpperCase()] || client.substring(0, 2).toUpperCase();
}

export function getCaseTypeCode(caseType: string): string {
  return CASE_TYPE_CODES[caseType] || caseType.substring(0, 3).toUpperCase();
}

function getYearSuffix(year?: number): string {
  const y = year ?? new Date().getFullYear();
  return String(y).slice(-2);
}

// ─── Matter Code: BRAND.TYPE.NNN/CLIENT-YY ───────────────────────────────────
// Serial is GLOBAL per year (across all brands/clients/types)

const MATTER_CODE_REGEX = /^[A-Z]{2,3}\.[A-Z]{3}\.(\d{3})\/[A-Z]{2}-(\d{2})$/;

export async function generateMatterCode(
  brandName: string,
  caseType: string,
  client: string,
  year?: number,
): Promise<string> {
  const brandCode = getBrandCode(brandName);
  const typeCode = getCaseTypeCode(caseType);
  const clientCode = getClientCode(client);
  const yy = getYearSuffix(year);

  // Query all matter codes for this year
  const { data } = await supabase
    .from('cases')
    .select('matter_code')
    .not('matter_code', 'is', null)
    .like('matter_code', `%-${yy}`);

  // Find max serial across ALL matter codes for this year
  let maxSerial = 0;
  if (data) {
    for (const row of data) {
      const match = row.matter_code?.match(MATTER_CODE_REGEX);
      if (match && match[2] === yy) {
        const serial = parseInt(match[1], 10);
        if (serial > maxSerial) maxSerial = serial;
      }
    }
  }

  // Loop to find a unique serial
  let nextSerial = maxSerial + 1;
  let code: string;
  for (let attempts = 0; attempts < 100; attempts++) {
    code = `${brandCode}.${typeCode}.${String(nextSerial).padStart(3, '0')}/${clientCode}-${yy}`;
    const { data: existing } = await supabase
      .from('cases')
      .select('id')
      .eq('matter_code', code)
      .limit(1);
    if (!existing || existing.length === 0) return code;
    nextSerial++;
  }

  // Fallback (should never reach here)
  return `${brandCode}.${typeCode}.${String(nextSerial).padStart(3, '0')}/${clientCode}-${yy}`;
}

// ─── Invoice Number: INV-BRAND.TYPE.NN/CLIENT-YY ────────────────────────────
// Serial is per brand+client+year

const INVOICE_NUM_REGEX = /^INV-([A-Z]{2,3})\.[A-Z]{3}\.(\d{2,3})\/([A-Z]{2})-(\d{2})$/;

export async function generateInvoiceNumber(
  brandName: string,
  caseType: string,
  client: string,
  year?: number,
): Promise<string> {
  const brandCode = getBrandCode(brandName);
  const typeCode = getCaseTypeCode(caseType);
  const clientCode = getClientCode(client);
  const yy = getYearSuffix(year);

  // Query all invoice numbers for this brand+client+year
  const pattern = `INV-${brandCode}.%/%${clientCode}-${yy}`;
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .not('invoice_number', 'is', null)
    .like('invoice_number', pattern);

  // Find max serial for this brand+client+year
  let maxSerial = 0;
  if (data) {
    for (const row of data) {
      const match = row.invoice_number?.match(INVOICE_NUM_REGEX);
      if (match && match[1] === brandCode && match[3] === clientCode && match[4] === yy) {
        const serial = parseInt(match[2], 10);
        if (serial > maxSerial) maxSerial = serial;
      }
    }
  }

  // Loop to find a unique serial
  let nextSerial = maxSerial + 1;
  let code: string;
  for (let attempts = 0; attempts < 100; attempts++) {
    code = `INV-${brandCode}.${typeCode}.${String(nextSerial).padStart(2, '0')}/${clientCode}-${yy}`;
    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('invoice_number', code)
      .limit(1);
    if (!existing || existing.length === 0) return code;
    nextSerial++;
  }

  return `INV-${brandCode}.${typeCode}.${String(nextSerial).padStart(2, '0')}/${clientCode}-${yy}`;
}

// ─── Duplicate Checks (for save-time validation) ────────────────────────────

export async function isMatterCodeDuplicate(matterCode: string, excludeCaseId?: string): Promise<boolean> {
  let query = supabase.from('cases').select('id').eq('matter_code', matterCode).limit(1);
  if (excludeCaseId) query = query.neq('id', excludeCaseId);
  const { data } = await query;
  return (data?.length ?? 0) > 0;
}

export async function isInvoiceNumberDuplicate(invoiceNumber: string): Promise<boolean> {
  const { data } = await supabase
    .from('invoices')
    .select('id')
    .eq('invoice_number', invoiceNumber)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
