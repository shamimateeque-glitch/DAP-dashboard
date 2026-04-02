import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
    parseExcelFile,
    transformRow,
    validateRow,
    importCases,
    clearAllCases,
    ParsedCaseRow,
    ValidationError,
} from '@/lib/importCases';
import { validateExcelFile, sanitizeErrorMessage } from '@/lib/security';
import {
    Upload,
    FileSpreadsheet,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
} from 'lucide-react';

interface ImportCasesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

const ImportCasesModal: React.FC<ImportCasesModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
}) => {
    const { appUser } = useAuth();
    const [step, setStep] = useState<ImportStep>('upload');
    const [fileName, setFileName] = useState('');
    const [parsedRows, setParsedRows] = useState<ParsedCaseRow[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [skippedRows, setSkippedRows] = useState(0);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: { row: number; error: string }[] } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const resetState = () => {
        setStep('upload');
        setFileName('');
        setParsedRows([]);
        setValidationErrors([]);
        setSkippedRows(0);
        setProgress(0);
        setProgressText('');
        setImportResult(null);
        setIsDragging(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const processFile = async (file: File) => {
        const validation = validateExcelFile(file);
        if (!validation.valid) {
            toast.error(validation.error!);
            return;
        }

        try {
            setFileName(file.name);
            setProgressText('Parsing Excel file...');
            setStep('preview');

            const { rows } = await parseExcelFile(file);

            if (rows.length === 0) {
                toast.error('The Excel file contains no data rows.');
                setStep('upload');
                return;
            }

            // Transform all rows
            const transformed: ParsedCaseRow[] = [];
            let skipped = 0;
            const allErrors: ValidationError[] = [];

            for (let i = 0; i < rows.length; i++) {
                const parsed = transformRow(rows[i]);
                if (!parsed) {
                    skipped++;
                    continue;
                }

                const errors = validateRow(parsed, i);
                if (errors.length > 0) {
                    allErrors.push(...errors);
                }

                transformed.push(parsed);
            }

            setParsedRows(transformed);
            setValidationErrors(allErrors);
            setSkippedRows(skipped);

        } catch (err: any) {
            toast.error(sanitizeErrorMessage(err, 'Error processing file'));
            setStep('upload');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleImport = async () => {
        if (!appUser) {
            toast.error('You must be logged in to import cases');
            return;
        }

        // Filter out rows with validation errors
        const errorRows = new Set(validationErrors.map(e => e.row));
        const validRows = parsedRows.filter((_, i) => !errorRows.has(i + 2));

        if (validRows.length === 0) {
            toast.error('No valid rows to import. Please fix the errors and try again.');
            return;
        }

        setStep('importing');
        setProgress(0);

        try {
            const result = await importCases(
                validRows,
                supabase,
                appUser.id,
                appUser.full_name || appUser.email,
                (current, total) => {
                    const pct = Math.round((current / total) * 100);
                    setProgress(pct);
                    setProgressText(`Importing case ${current} of ${total}...`);
                }
            );

            setImportResult(result);
            setStep('done');

            if (result.success > 0) {
                toast.success(`Successfully imported ${result.success} cases!`);
                onSuccess();
            }

            if (result.failed > 0) {
                toast.warning(`${result.failed} cases failed to import.`);
            }

        } catch (err: any) {
            toast.error(sanitizeErrorMessage(err, 'Import failed'));
            setStep('preview');
        }
    };

    // Count rows with errors vs valid
    const errorRowSet = new Set(validationErrors.map(e => e.row));
    const validCount = parsedRows.length - errorRowSet.size;
    const errorCount = errorRowSet.size;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-500" />
                        Import Cases from Excel
                    </DialogTitle>
                    <DialogDescription>
                        Upload a Master Template Excel file to bulk-import cases.
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="py-6">
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                            }`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        >
                            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground mb-2">
                                Drag and drop your Excel file here, or
                            </p>
                            <label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                                <Button variant="outline" asChild>
                                    <span className="cursor-pointer">Browse Files</span>
                                </Button>
                            </label>
                            <p className="text-xs text-muted-foreground mt-3">
                                Supports .xlsx and .xls files (Master Template format)
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <div className="py-4 space-y-4 flex-1 min-h-0">
                        {/* File Info */}
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                            <FileSpreadsheet className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                    {parsedRows.length} rows parsed
                                    {skippedRows > 0 && `, ${skippedRows} empty rows skipped`}
                                </p>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium text-green-500">
                                        {validCount} Valid
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Ready to import
                                </p>
                            </div>
                            <div className={`p-3 rounded-lg border ${
                                errorCount > 0
                                    ? 'bg-red-500/10 border-red-500/20'
                                    : 'bg-muted/50 border-muted'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {errorCount > 0 ? (
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                    ) : (
                                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className={`text-sm font-medium ${
                                        errorCount > 0 ? 'text-red-500' : 'text-muted-foreground'
                                    }`}>
                                        {errorCount} Errors
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {errorCount > 0 ? 'Will be skipped' : 'No issues found'}
                                </p>
                            </div>
                        </div>

                        {/* Preview Table */}
                        <div>
                            <p className="text-sm font-medium mb-2">Preview (first 5 rows):</p>
                            <ScrollArea className="h-[180px] rounded-md border">
                                <div className="p-3">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">#</th>
                                                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Target Name</th>
                                                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Brand</th>
                                                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">City</th>
                                                <th className="text-left py-1.5 px-2 font-medium text-muted-foreground">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedRows.slice(0, 5).map((row, i) => (
                                                <tr key={i} className="border-b border-muted/50">
                                                    <td className="py-1.5 px-2 text-muted-foreground">{i + 1}</td>
                                                    <td className="py-1.5 px-2 truncate max-w-[140px]">{row.target_name}</td>
                                                    <td className="py-1.5 px-2">{row.brand_name}</td>
                                                    <td className="py-1.5 px-2">{row.city}</td>
                                                    <td className="py-1.5 px-2">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">
                                                            {row.case_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {parsedRows.length > 5 && (
                                        <p className="text-xs text-muted-foreground text-center mt-2">
                                            ...and {parsedRows.length - 5} more rows
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Validation Errors */}
                        {validationErrors.length > 0 && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/5 overflow-hidden">
                                <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                    <p className="text-sm font-semibold text-red-500">
                                        {errorCount} Row{errorCount !== 1 ? 's' : ''} with Validation Errors (will be skipped)
                                    </p>
                                </div>
                                <ScrollArea className="max-h-[120px]">
                                    <div className="p-2">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-red-500/15">
                                                    <th className="text-left py-1 px-2 font-medium text-red-400/80">Row</th>
                                                    <th className="text-left py-1 px-2 font-medium text-red-400/80">Field</th>
                                                    <th className="text-left py-1 px-2 font-medium text-red-400/80">Issue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {validationErrors.slice(0, 30).map((err, i) => (
                                                    <tr key={i} className="border-b border-red-500/10 last:border-0">
                                                        <td className="py-1.5 px-2 text-red-400 font-medium">{err.row}</td>
                                                        <td className="py-1.5 px-2 text-red-400">{err.field}</td>
                                                        <td className="py-1.5 px-2 text-red-300">{err.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {validationErrors.length > 30 && (
                                            <p className="text-xs text-muted-foreground text-center mt-1 pb-1">
                                                ...and {validationErrors.length - 30} more issues
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        )}

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={resetState}>
                                Choose Different File
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={validCount === 0}
                            >
                                Import {validCount} Cases
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* Step 3: Importing */}
                {step === 'importing' && (
                    <div className="py-8 space-y-4">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
                            <p className="text-sm font-medium">{progressText}</p>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-center text-muted-foreground">
                            Please don't close this window while importing...
                        </p>
                    </div>
                )}

                {/* Step 4: Done */}
                {step === 'done' && importResult && (
                    <div className="py-6 space-y-4">
                        <div className="text-center">
                            {importResult.failed === 0 ? (
                                <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" />
                            ) : (
                                <AlertTriangle className="mx-auto h-10 w-10 text-yellow-500 mb-3" />
                            )}
                            <h3 className="text-lg font-semibold">Import Complete</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
                                <p className="text-xs text-muted-foreground">Successfully Imported</p>
                            </div>
                            <div className={`p-3 rounded-lg text-center border ${
                                importResult.failed > 0
                                    ? 'bg-red-500/10 border-red-500/20'
                                    : 'bg-muted/50 border-muted'
                            }`}>
                                <p className={`text-2xl font-bold ${
                                    importResult.failed > 0 ? 'text-red-500' : 'text-muted-foreground'
                                }`}>{importResult.failed}</p>
                                <p className="text-xs text-muted-foreground">Failed</p>
                            </div>
                        </div>

                        {importResult.errors.length > 0 && (
                            <ScrollArea className="h-[100px] rounded-md border border-red-500/20 bg-red-500/5">
                                <div className="p-3 space-y-1">
                                    {importResult.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-400">
                                            Row {err.row}: {err.error}
                                        </p>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}

                        <DialogFooter>
                            <Button onClick={handleClose}>
                                Done
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default ImportCasesModal;
