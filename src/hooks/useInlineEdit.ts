import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    isMatterCodeDuplicate,
    isInvoiceNumberDuplicate,
    generateMatterCode,
    generateInvoiceNumber,
} from '@/lib/codeGenerators';

// Regexes identifying an AUTO-generated code (same shape as the generators produce).
// If the stored code matches, it's safe to regenerate on case_type change.
// If it's been manually edited to something else, we leave it alone.
const AUTO_MATTER_CODE_REGEX = /^[A-Z]{2,3}\.[A-Z]{3}\.\d{3}\/[A-Z]{2}-\d{2}$/;
const AUTO_INVOICE_NUMBER_REGEX = /^INV-[A-Z]{2,3}\.[A-Z]{3}\.\d{2,3}\/[A-Z]{2}-\d{2}$/;

type SaveFn = (field: string, value: string | number | null) => Promise<void>;

export interface DuplicateError {
    type: 'matter_code' | 'invoice_number';
    value: string;
}

async function regenerateCodesForCaseTypeChange(caseId: string, newCaseType: string) {
    // Pull the bits we need: brand + current matter code + invoice info + client.
    const { data: caseRow, error: caseErr } = await supabase
        .from('cases')
        .select(`
            id,
            brand_name,
            matter_code,
            case_uploads(client),
            invoices(id, invoice_number)
        `)
        .eq('id', caseId)
        .maybeSingle();

    if (caseErr || !caseRow) return;

    const upload = Array.isArray(caseRow.case_uploads) ? caseRow.case_uploads[0] : caseRow.case_uploads;
    const invoice = Array.isArray(caseRow.invoices) ? caseRow.invoices[0] : caseRow.invoices;
    const client: string | undefined = upload?.client;
    const brand: string | undefined = caseRow.brand_name;

    // Regenerate matter code if it's auto-shaped and we have brand + client.
    if (brand && client && caseRow.matter_code && AUTO_MATTER_CODE_REGEX.test(caseRow.matter_code)) {
        const yearMatch = caseRow.matter_code.match(/-(\d{2})$/);
        const year = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : undefined;
        try {
            const newMatter = await generateMatterCode(brand, newCaseType, client, year);
            if (newMatter !== caseRow.matter_code) {
                await supabase.from('cases').update({ matter_code: newMatter }).eq('id', caseId);
            }
        } catch (e) {
            console.error('Failed to regenerate matter code:', e);
        }
    }

    // Regenerate invoice number if it's auto-shaped and we have brand + client.
    if (brand && client && invoice?.invoice_number && AUTO_INVOICE_NUMBER_REGEX.test(invoice.invoice_number)) {
        const yearMatch = invoice.invoice_number.match(/-(\d{2})$/);
        const year = yearMatch ? 2000 + parseInt(yearMatch[1], 10) : undefined;
        try {
            const newInvoiceNumber = await generateInvoiceNumber(brand, newCaseType, client, year);
            if (newInvoiceNumber !== invoice.invoice_number) {
                await supabase.from('invoices').update({ invoice_number: newInvoiceNumber }).eq('id', invoice.id);
            }
        } catch (e) {
            console.error('Failed to regenerate invoice number:', e);
        }
    }
}

function createSaver(
    table: string,
    idColumn: string,
    idValue: string,
    refetch: () => void,
    label?: string
): SaveFn {
    return async (field: string, value: string | number | null) => {
        const { error } = await supabase
            .from(table)
            .update({ [field]: value })
            .eq(idColumn, idValue);

        if (error) throw error;

        const displayName = label || field.replace(/_/g, ' ');
        toast.success(`${displayName} updated successfully`);
        refetch();
    };
}

export function useInlineEdit(caseId: string, refetch: () => void) {
    const [duplicateError, setDuplicateError] = useState<DuplicateError | null>(null);
    const queryClient = useQueryClient();

    // Cross-page caches (e.g. the Invoices list) won't auto-refresh because of
    // the global 5-minute staleTime — nudge them when related data changes.
    const invalidateInvoiceCaches = () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice-stats'] });
    };

    const baseSaveCaseField = createSaver('cases', 'id', caseId, refetch);

    const saveCaseField: SaveFn = async (field, value) => {
        if (field === 'matter_code' && typeof value === 'string' && value.trim()) {
            const isDuplicate = await isMatterCodeDuplicate(value.trim(), caseId);
            if (isDuplicate) {
                setDuplicateError({ type: 'matter_code', value: value.trim() });
                throw new Error('__handled__');
            }
        }

        await baseSaveCaseField(field, value);

        // When case_type changes, keep the matter code and invoice number in
        // sync so their embedded type segment (MKT/CUS) reflects reality.
        // Only regenerate codes that still look auto-generated — manually
        // edited ones are left alone.
        if (field === 'case_type' && typeof value === 'string' && value.trim()) {
            await regenerateCodesForCaseTypeChange(caseId, value.trim());
            invalidateInvoiceCaches();
        }
    };

    const baseSaveUploadField = createSaver('case_uploads', 'case_id', caseId, refetch);

    const saveUploadField: SaveFn = async (field, value) => {
        await baseSaveUploadField(field, value);

        // Keep invoices.amount_usd in sync with the fee so the Invoices list
        // reflects fee edits made from the Case Detail page.
        if (field === 'our_fee_usd') {
            await supabase
                .from('invoices')
                .update({ amount_usd: value })
                .eq('case_id', caseId);
            refetch();
            invalidateInvoiceCaches();
        }
    };

    const saveInDepthField: SaveFn = (field, value) =>
        createSaver('in_depth_stages', 'case_id', caseId, refetch)(field, value);

    const saveEnforcementField: SaveFn = (field, value) =>
        createSaver('enforcement_stages', 'case_id', caseId, refetch)(field, value);

    const saveFinalReportField: SaveFn = (field, value) =>
        createSaver('final_reports', 'case_id', caseId, refetch)(field, value);

    const saveDestructionField: SaveFn = (field, value) =>
        createSaver('destruction_stages', 'case_id', caseId, refetch)(field, value);

    const baseInvoiceSaver = createSaver('invoices', 'case_id', caseId, refetch);

    const saveInvoiceField: SaveFn = async (field, value) => {
        if (field === 'invoice_number' && typeof value === 'string' && value.trim()) {
            const isDuplicate = await isInvoiceNumberDuplicate(value.trim());
            if (isDuplicate) {
                setDuplicateError({ type: 'invoice_number', value: value.trim() });
                throw new Error('__handled__');
            }
        }
        await baseInvoiceSaver(field, value);

        // Keep case_uploads.our_fee_usd in sync with the invoice amount so the
        // Fee Summary on Case Detail reflects invoice amount edits.
        if (field === 'amount_usd') {
            await supabase
                .from('case_uploads')
                .update({ our_fee_usd: value })
                .eq('case_id', caseId);
            refetch();
        }
        invalidateInvoiceCaches();
    };

    const clearDuplicateError = () => setDuplicateError(null);

    return {
        saveCaseField,
        saveUploadField,
        saveInDepthField,
        saveEnforcementField,
        saveFinalReportField,
        saveDestructionField,
        saveInvoiceField,
        duplicateError,
        clearDuplicateError,
    };
}
