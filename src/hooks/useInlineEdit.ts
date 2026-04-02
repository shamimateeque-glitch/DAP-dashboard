import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { isMatterCodeDuplicate, isInvoiceNumberDuplicate } from '@/lib/codeGenerators';

type SaveFn = (field: string, value: string | number | null) => Promise<void>;

export interface DuplicateError {
    type: 'matter_code' | 'invoice_number';
    value: string;
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

    const baseSaveCaseField = createSaver('cases', 'id', caseId, refetch);

    const saveCaseField: SaveFn = async (field, value) => {
        if (field === 'matter_code' && typeof value === 'string' && value.trim()) {
            const isDuplicate = await isMatterCodeDuplicate(value.trim(), caseId);
            if (isDuplicate) {
                setDuplicateError({ type: 'matter_code', value: value.trim() });
                throw new Error('__handled__');
            }
        }
        return baseSaveCaseField(field, value);
    };

    const saveUploadField: SaveFn = (field, value) =>
        createSaver('case_uploads', 'case_id', caseId, refetch)(field, value);

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
        return baseInvoiceSaver(field, value);
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
