import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
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

// Mirror RecordDecisionModal: when the client decision is set (inline or via
// modal), advance the case status and auto-create the next workflow stage.
// - REJECTED  → case_status = REJECTED (workflow ends)
// - APPROVED  → Customs: create Enforcement (+15d), status = ENFORCEMENT
//               Market:  create In-Depth (+7d),  status = APPROVED
//               (the stage-insert DB triggers then advance status further)
// - WAITING   → no-op
async function applyDecisionSideEffects(caseId: string, decision: string) {
    if (decision === 'REJECTED') {
        await supabase.from('cases').update({ case_status: 'REJECTED' }).eq('id', caseId);
        // Rejection ends the workflow — remove any auto-created downstream stages
        // (and the auto final report) so the case doesn't linger in the In-Depth /
        // Enforcement / Destruction queues. Invoices are left untouched.
        await supabase.from('destruction_stages').delete().eq('case_id', caseId);
        await supabase.from('enforcement_stages').delete().eq('case_id', caseId);
        await supabase.from('in_depth_stages').delete().eq('case_id', caseId);
        await supabase.from('final_reports').delete().eq('case_id', caseId);
        return;
    }
    if (decision !== 'APPROVED') return;

    const { data: caseRow } = await supabase
        .from('cases')
        .select('case_type, case_uploads(decision_date)')
        .eq('id', caseId)
        .maybeSingle();
    if (!caseRow) return;

    const upload = Array.isArray(caseRow.case_uploads) ? caseRow.case_uploads[0] : caseRow.case_uploads;

    // Fall back to today if no decision date has been recorded yet, and persist
    // it so the timeline + derived due dates stay consistent.
    const decisionDateStr = upload?.decision_date || new Date().toISOString().split('T')[0];
    if (!upload?.decision_date) {
        await supabase.from('case_uploads').update({ decision_date: decisionDateStr }).eq('case_id', caseId);
    }
    const decisionDate = new Date(decisionDateStr + 'T12:00:00');

    const isCustoms = caseRow.case_type === 'Customs' || caseRow.case_type === 'Custom';
    if (isCustoms) {
        await supabase.from('cases').update({ case_status: 'ENFORCEMENT' }).eq('id', caseId);
        const target = new Date(decisionDate);
        target.setDate(decisionDate.getDate() + 15);
        // Only create the stage if one doesn't already exist, so re-approving
        // doesn't reset in-flight enforcement progress.
        const { data: existing } = await supabase
            .from('enforcement_stages').select('id').eq('case_id', caseId).maybeSingle();
        if (!existing) {
            await supabase.from('enforcement_stages').insert(
                [{ case_id: caseId, due_date: format(target, 'yyyy-MM-dd'), status: 'IN_PROGRESS', updated_at: new Date().toISOString() }]
            );
        }
    } else {
        await supabase.from('cases').update({ case_status: 'APPROVED' }).eq('id', caseId);
        const target = new Date(decisionDate);
        target.setDate(decisionDate.getDate() + 7);
        // Only create the stage if one doesn't already exist, so re-approving
        // doesn't reset in-flight in-depth progress.
        const { data: existing } = await supabase
            .from('in_depth_stages').select('id').eq('case_id', caseId).maybeSingle();
        if (!existing) {
            await supabase.from('in_depth_stages').insert(
                [{ case_id: caseId, due_date: format(target, 'yyyy-MM-dd'), status: 'IN_PROGRESS', updated_at: new Date().toISOString() }]
            );
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
        // .select() makes the write report what it actually changed. Without it
        // an update that matches no rows — blocked by RLS, or filtered on a
        // stale id — returns no error and we'd claim success on a no-op.
        const { data, error } = await supabase
            .from(table)
            .update({ [field]: value })
            .eq(idColumn, idValue)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            throw new Error(`No ${table} row was updated — the change was not saved.`);
        }

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

        // Setting the client decision inline must advance the case status and
        // create the next stage, just like the Record Decision modal does.
        if (field === 'decision_status' && typeof value === 'string') {
            await applyDecisionSideEffects(caseId, value);
            refetch();
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
