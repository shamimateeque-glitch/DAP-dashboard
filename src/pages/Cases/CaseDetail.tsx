import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Calendar,
    MapPin,
    Tag,
    User,
    Clock,
    CheckCircle2,
    Circle,
    Trash2,
    Edit2,
    Zap,
    FileText,
    DollarSign,
    RotateCcw
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatusBadge from '@/components/StatusBadge';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import UploadToClientModal from '@/components/forms/UploadToClientModal';
import RecordDecisionModal from '@/components/forms/RecordDecisionModal';
import SendInvoiceModal from '@/components/forms/SendInvoiceModal';
import UpdateWorkflowModal from '@/components/forms/UpdateWorkflowModal';
import SubmitFinalReportModal from '@/components/forms/SubmitFinalReportModal';
import UpdateInvoiceStatusModal from '@/components/forms/UpdateInvoiceStatusModal';
import { usePermissions } from '@/hooks/usePermissions';
import { sanitizeErrorMessage } from '@/lib/security';
import { getPaymentTermDays, normalizeClientName } from '@/lib/paymentTerms';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import DuplicateErrorDialog from '@/components/DuplicateErrorDialog';
import InlineEditField from '@/components/inline-edit/InlineEditField';
import InlineEditSelect from '@/components/inline-edit/InlineEditSelect';
import InlineEditDate from '@/components/inline-edit/InlineEditDate';
import InlineEditCombobox from '@/components/inline-edit/InlineEditCombobox';
import InlineEditProvinceCity from '@/components/inline-edit/InlineEditProvinceCity';

// Parse a date string (YYYY-MM-DD or ISO) as local date without timezone shift
const toLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
};

const CaseDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { can, isAdmin } = usePermissions();

    const { data: caseData, isLoading, error, refetch } = useQuery({
        queryKey: ['case', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('cases')
                .select(`
          *,
          case_uploads (*),
          in_depth_stages (*),
          enforcement_stages (*),
          final_reports (*),
          invoices (*),
          destruction_stages (*)
        `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch combobox options for inline editing
    const { data: comboboxOptions } = useQuery({
        queryKey: ['combobox-options'],
        queryFn: async () => {
            const [brandsRes, categoriesRes] = await Promise.all([
                supabase.from('cases').select('brand_name').not('brand_name', 'is', null),
                supabase.from('cases').select('target_category').not('target_category', 'is', null),
            ]);
            return {
                brands: [...new Set((brandsRes.data || []).map(r => r.brand_name).filter(Boolean))],
                categories: [...new Set((categoriesRes.data || []).map(r => r.target_category).filter(Boolean))],
                reporters: ["Rana Abubakar", "Rana Adil", "Rana Hasnain", "Faheem", "Muhammad Qaiser"],
            };
        },
        staleTime: 5 * 60 * 1000,
    });

    const [uploadModalOpen, setUploadModalOpen] = React.useState(false);
    const [decisionModalOpen, setDecisionModalOpen] = React.useState(false);
    const [invoiceModalOpen, setInvoiceModalOpen] = React.useState(false);
    const [workflowModalOpen, setWorkflowModalOpen] = React.useState(false);
    const [workflowStage, setWorkflowStage] = React.useState<'in_depth' | 'enforcement' | 'destruction'>('in_depth');
    const [finalReportModalOpen, setFinalReportModalOpen] = React.useState(false);
    const [invoiceStatusModalOpen, setInvoiceStatusModalOpen] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
    const [isReopenDialogOpen, setIsReopenDialogOpen] = React.useState(false);
    const [isReopening, setIsReopening] = React.useState(false);

    const {
        saveCaseField,
        saveUploadField,
        saveInDepthField,
        saveEnforcementField,
        saveFinalReportField,
        saveDestructionField,
        saveInvoiceField,
        duplicateError,
        clearDuplicateError,
    } = useInlineEdit(id || '', refetch);

    const openWorkflowModal = (stage: 'in_depth' | 'enforcement' | 'destruction') => {
        setWorkflowStage(stage);
        setWorkflowModalOpen(true);
    };

    const getRel = (rel: any) => {
        if (!rel) return null;
        return Array.isArray(rel) ? rel[0] : rel;
    };

    const getDueDateColor = (dateStr: string | undefined | null) => {
        if (!dateStr) return "text-white";

        const date = toLocalDate(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const compareDate = new Date(date);
        compareDate.setHours(0, 0, 0, 0);

        const diffDays = Math.ceil((compareDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return "text-red-500 font-bold";
        return "text-orange-500 font-bold";
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('cases')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Case deleted successfully');
            navigate('/all-cases');
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error deleting case'));
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
        }
    };

    // Reopen a REJECTED case: flip it back to the Decision Waiting stage so
    // the team can re-record the client's decision. Only available on rejected
    // cases (closed cases have downstream records that shouldn't be touched).
    const handleReopen = async () => {
        setIsReopening(true);
        try {
            const { error: uploadErr } = await supabase
                .from('case_uploads')
                .update({ decision_status: 'WAITING', decision_date: null })
                .eq('case_id', id);
            if (uploadErr) throw uploadErr;

            const { error: caseErr } = await supabase
                .from('cases')
                .update({ case_status: 'UPLOADED' })
                .eq('id', id);
            if (caseErr) throw caseErr;

            toast.success('Case reopened — back to Decision Waiting');
            refetch();
        } catch (error: any) {
            toast.error(sanitizeErrorMessage(error, 'Error reopening case'));
        } finally {
            setIsReopening(false);
            setIsReopenDialogOpen(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error || !caseData) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold">Case not found</h2>
                <Button variant="link" onClick={() => navigate('/all-cases')}>
                    Back to all cases
                </Button>
            </div>
        );
    }

    const isCustoms = caseData.case_type === 'Customs' || caseData.case_type === 'Custom';

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            // Prefer history back so users return to the list they came from
                            // (e.g. All Invoices with filters applied). Fall back to all cases
                            // if there's no history (deep link / direct URL entry).
                            if (window.history.length > 1) {
                                navigate(-1);
                            } else {
                                navigate('/all-cases');
                            }
                        }}
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl tracking-tight">
                                <span className="text-muted-foreground text-lg font-normal">{caseData.case_id}</span>
                                {getRel(caseData.case_uploads) && (
                                    <span className="ml-2 text-lg font-bold text-foreground">
                                        ({normalizeClientName(getRel(caseData.case_uploads).client)})
                                    </span>
                                )}
                            </h2>
                            <StatusBadge status={caseData.case_status} />
                        </div>
                        <p className="text-muted-foreground">{caseData.target_name} • {caseData.brand_name} • {caseData.products_name}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {can('cases', 'edit') && (
                        <Button variant="outline" onClick={() => navigate(`/cases/${id}/edit`)}>Edit Case</Button>
                    )}
                    {isAdmin && (
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteDialogOpen(true)}
                            disabled={isDeleting}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Case
                        </Button>
                    )}

                    {can('cases', 'edit') && (
                        <>
                            {caseData.case_status === 'IN_HAND' && (
                                <Button onClick={() => setUploadModalOpen(true)}>
                                    Upload to Client
                                </Button>
                            )}
                            {caseData.case_status === 'UPLOADED' && (
                                <Button onClick={() => setDecisionModalOpen(true)}>
                                    Record Decision
                                </Button>
                            )}
                            {caseData.case_status === 'REJECTED' && (
                                <Button variant="outline" onClick={() => setIsReopenDialogOpen(true)}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Reopen Case
                                </Button>
                            )}

                            {['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED'].includes(caseData.case_status) && (
                                <>
                                    {!isCustoms && (getRel(caseData.in_depth_stages)?.status !== 'DONE') && (
                                        <Button onClick={() => openWorkflowModal('in_depth')}>
                                            Update In-Depth
                                        </Button>
                                    )}

                                    {(isCustoms
                                        ? (getRel(caseData.enforcement_stages) && getRel(caseData.enforcement_stages)?.status !== 'DONE')
                                        : (getRel(caseData.in_depth_stages)?.status === 'DONE' && getRel(caseData.enforcement_stages)?.status !== 'DONE')
                                    ) && (
                                        <Button onClick={() => openWorkflowModal('enforcement')}>
                                            Update Enforcement
                                        </Button>
                                    )}

                                    {getRel(caseData.enforcement_stages)?.status === 'DONE' && getRel(caseData.final_reports)?.status === 'PENDING' && (
                                        <Button onClick={() => setFinalReportModalOpen(true)}>
                                            Submit Final Report
                                        </Button>
                                    )}

                                    {getRel(caseData.final_reports)?.status === 'DONE' && !getRel(caseData.invoices) && (
                                        <Button onClick={() => setInvoiceModalOpen(true)}>
                                            Invoice Issued?
                                        </Button>
                                    )}

                                    {getRel(caseData.invoices) && getRel(caseData.invoices)?.status !== 'PAID' && (
                                        <Button onClick={() => setInvoiceStatusModalOpen(true)}>
                                            Paid?
                                        </Button>
                                    )}

                                    {getRel(caseData.enforcement_stages)?.status === 'DONE' && (getRel(caseData.destruction_stages)?.status !== 'DONE') && (
                                        <Button onClick={() => openWorkflowModal('destruction')}>
                                            Update Destruction
                                        </Button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="workflow">Workflow</TabsTrigger>
                            <TabsTrigger value="invoice">Invoice</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>

                        {/* ===================== DETAILS TAB ===================== */}
                        <TabsContent value="details" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Case Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Case Type
                                            </p>
                                            <InlineEditSelect
                                                value={caseData.case_type}
                                                options={[
                                                    { label: 'Customs', value: 'Customs' },
                                                    { label: 'Market', value: 'Market' },
                                                ]}
                                                onSave={(v) => saveCaseField('case_type', v)}
                                                canEdit={can('cases', 'edit') && !['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED'].includes(caseData.case_status)}
                                                className="font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Target Name
                                            </p>
                                            <InlineEditField
                                                value={caseData.target_name}
                                                onSave={(v) => saveCaseField('target_name', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="text-xl font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <User className="h-4 w-4" /> Client
                                            </p>
                                            <InlineEditSelect
                                                value={getRel(caseData.case_uploads)?.client}
                                                displayValue={normalizeClientName(getRel(caseData.case_uploads)?.client) || undefined}
                                                options={[
                                                    { label: 'OneWorld', value: 'OneWorld' },
                                                    { label: 'A.A Associates', value: 'A.A Associates' },
                                                    { label: 'SafeMark', value: 'SafeMark' },
                                                ]}
                                                onSave={(v) => saveUploadField('client', v)}
                                                canEdit={can('cases', 'edit') && !!getRel(caseData.case_uploads)}
                                                className="font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Category
                                            </p>
                                            <InlineEditCombobox
                                                value={caseData.target_category}
                                                options={comboboxOptions?.categories || []}
                                                onSave={(v) => saveCaseField('target_category', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="font-medium"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Brand
                                            </p>
                                            <InlineEditCombobox
                                                value={caseData.brand_name}
                                                options={comboboxOptions?.brands || []}
                                                onSave={(v) => saveCaseField('brand_name', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <MapPin className="h-4 w-4" /> Province & City
                                            </p>
                                            <InlineEditProvinceCity
                                                province={caseData.province}
                                                city={caseData.city}
                                                onSave={async (prov, cty) => {
                                                    const { error } = await supabase
                                                        .from('cases')
                                                        .update({ province: prov, city: cty })
                                                        .eq('id', id);
                                                    if (error) throw error;
                                                    toast.success('Location updated successfully');
                                                    refetch();
                                                }}
                                                canEdit={can('cases', 'edit')}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Products
                                            </p>
                                            <InlineEditField
                                                value={caseData.products_name}
                                                onSave={(v) => saveCaseField('products_name', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="font-semibold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <User className="h-4 w-4" /> Case Reported By
                                            </p>
                                            <InlineEditCombobox
                                                value={caseData.case_reported_by}
                                                options={comboboxOptions?.reporters || []}
                                                onSave={(v) => saveCaseField('case_reported_by', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="font-semibold"
                                                allowAdd={false}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Tag className="h-4 w-4" /> Matter Code
                                            </p>
                                            <InlineEditField
                                                value={caseData.matter_code}
                                                onSave={(v) => saveCaseField('matter_code', v)}
                                                canEdit={can('cases', 'edit')}
                                                className="font-mono font-black"
                                                placeholder="Not assigned"
                                                inputClassName="font-mono text-blue-600 font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1 md:col-span-2 border-t pt-4">
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <MapPin className="h-4 w-4" /> Target Address
                                            </p>
                                            <InlineEditField
                                                value={caseData.target_address}
                                                onSave={(v) => saveCaseField('target_address', v)}
                                                canEdit={can('cases', 'edit')}
                                                type="textarea"
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1 md:col-span-2 border-t pt-4">
                                            <p className="text-sm font-medium text-muted-foreground">Notes / Description</p>
                                            <InlineEditField
                                                value={caseData.notes_description}
                                                onSave={(v) => saveCaseField('notes_description', v)}
                                                canEdit={can('cases', 'edit')}
                                                type="textarea"
                                                className="text-sm whitespace-pre-wrap"
                                                placeholder="No additional notes provided."
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ===================== WORKFLOW TAB ===================== */}
                        <TabsContent value="workflow" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Workflow Progress</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">

                                        {/* 1. Case In Hand */}
                                        <div className="relative flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="z-10 bg-primary rounded-full p-1 shadow-lg">
                                                    <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Case In Hand</p>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                        Submitted on{' '}
                                                        <InlineEditDate
                                                            value={caseData.case_reported_date}
                                                            onSave={(v) => saveCaseField('case_reported_date', v)}
                                                            canEdit={can('cases', 'edit')}
                                                            className="text-sm text-muted-foreground"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 2. Uploaded to Client */}
                                        <div className="relative flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.case_uploads) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                    {getRel(caseData.case_uploads) ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                </div>
                                                <div>
                                                    <p className="font-semibold">Uploaded to Client</p>
                                                    {getRel(caseData.case_uploads) ? (
                                                        <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                                                            <InlineEditSelect
                                                                value={getRel(caseData.case_uploads).client}
                                                                displayValue={normalizeClientName(getRel(caseData.case_uploads).client)}
                                                                options={[
                                                                    { label: 'OneWorld', value: 'OneWorld' },
                                                                    { label: 'A.A Associates', value: 'A.A Associates' },
                                                                    { label: 'SafeMark', value: 'SafeMark' },
                                                                ]}
                                                                onSave={(v) => saveUploadField('client', v)}
                                                                canEdit={can('workflow', 'edit')}
                                                                className="text-sm text-muted-foreground font-medium"
                                                            />
                                                            <span>on</span>
                                                            <InlineEditDate
                                                                value={getRel(caseData.case_uploads).upload_date}
                                                                onSave={(v) => saveUploadField('upload_date', v)}
                                                                canEdit={can('workflow', 'edit')}
                                                                className="text-sm text-muted-foreground"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground italic">Pending upload</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. Client Decision */}
                                        <div className="relative flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.case_uploads)?.decision_status === 'APPROVED' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                    {getRel(caseData.case_uploads)?.decision_status === 'APPROVED' ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-semibold">Client Decision:</p>
                                                        {getRel(caseData.case_uploads) ? (
                                                            <InlineEditSelect
                                                                value={getRel(caseData.case_uploads).decision_status || 'WAITING'}
                                                                options={[
                                                                    { label: 'Waiting', value: 'WAITING' },
                                                                    { label: 'Approved', value: 'APPROVED' },
                                                                    { label: 'Rejected', value: 'REJECTED' },
                                                                ]}
                                                                onSave={(v) => saveUploadField('decision_status', v)}
                                                                canEdit={can('workflow', 'edit')}
                                                                className="font-semibold"
                                                            />
                                                        ) : (
                                                            <span>Waiting</span>
                                                        )}
                                                    </div>
                                                    {getRel(caseData.case_uploads)?.decision_status && getRel(caseData.case_uploads)?.decision_status !== 'WAITING' ? (
                                                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                                                            {getRel(caseData.case_uploads).decision_status} on{' '}
                                                            <InlineEditDate
                                                                value={getRel(caseData.case_uploads).decision_date}
                                                                onSave={(v) => saveUploadField('decision_date', v)}
                                                                canEdit={can('workflow', 'edit')}
                                                                className="text-sm text-muted-foreground"
                                                            />
                                                        </div>
                                                    ) : (
                                                        (() => {
                                                            const upload = getRel(caseData.case_uploads);
                                                            if (upload) {
                                                                const deadline = addDays(toLocalDate(upload.upload_date), 7);
                                                                const colorClass = getDueDateColor(deadline.toISOString());
                                                                return (
                                                                    <p className={cn("text-sm", colorClass)}>
                                                                        Due Date: {format(deadline, 'MMM dd, yyyy')}
                                                                    </p>
                                                                );
                                                            }
                                                            return <p className="text-sm text-muted-foreground italic">Awaiting decision</p>;
                                                        })()
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {['APPROVED', 'IN_DEPTH', 'ENFORCEMENT', 'DESTRUCTION', 'CLOSED'].includes(caseData.case_status) && (
                                            <>
                                                {/* 4. In-Depth Investigation */}
                                                <div className="relative flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`z-10 rounded-full p-1 shadow-lg ${
                                                            isCustoms
                                                                ? 'bg-muted text-muted-foreground opacity-50'
                                                                : getRel(caseData.in_depth_stages)?.status === 'DONE'
                                                                    ? 'bg-primary text-primary-foreground'
                                                                    : getRel(caseData.in_depth_stages)
                                                                        ? 'bg-blue-500 text-white'
                                                                        : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                            {isCustoms
                                                                ? <Circle className="h-8 w-8" />
                                                                : getRel(caseData.in_depth_stages)?.status === 'DONE'
                                                                    ? <CheckCircle2 className="h-8 w-8" />
                                                                    : <Circle className="h-8 w-8" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className={`font-semibold ${isCustoms ? 'opacity-50' : ''}`}>In-Depth Investigation</p>
                                                                {isCustoms ? (
                                                                    <Badge variant="outline" className="text-muted-foreground">SKIPPED</Badge>
                                                                ) : (
                                                                    getRel(caseData.in_depth_stages) && (
                                                                        <InlineEditSelect
                                                                            value={getRel(caseData.in_depth_stages).status}
                                                                            options={[
                                                                                { label: 'In Progress', value: 'IN_PROGRESS' },
                                                                                { label: 'Done', value: 'DONE' },
                                                                            ]}
                                                                            onSave={(v) => saveInDepthField('status', v)}
                                                                            canEdit={can('workflow', 'edit')}
                                                                        />
                                                                    )
                                                                )}
                                                            </div>
                                                            {isCustoms ? (
                                                                <p className="text-sm text-muted-foreground italic">N/A — Customs cases skip In-Depth</p>
                                                            ) : (
                                                                (() => {
                                                                    const stage = getRel(caseData.in_depth_stages);
                                                                    if (!stage) return <p className="text-sm text-muted-foreground italic">Not started</p>;

                                                                    const colorClass = stage.status === 'DONE' ? "text-muted-foreground" : getDueDateColor(stage.due_date);
                                                                    return (
                                                                        <div className={cn("text-sm flex items-center gap-1 flex-wrap", colorClass)}>
                                                                            Due Date:{' '}
                                                                            <InlineEditDate
                                                                                value={stage.due_date}
                                                                                onSave={(v) => saveInDepthField('due_date', v)}
                                                                                canEdit={can('workflow', 'edit')}
                                                                                className={cn("text-sm", colorClass)}
                                                                            />
                                                                            {stage.status === 'DONE' && stage.status_date && (
                                                                                <span className="flex items-center gap-1">
                                                                                    • Done on{' '}
                                                                                    <InlineEditDate
                                                                                        value={stage.status_date}
                                                                                        onSave={(v) => saveInDepthField('status_date', v)}
                                                                                        canEdit={can('workflow', 'edit')}
                                                                                        className="text-sm text-muted-foreground"
                                                                                    />
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isCustoms && can('workflow', 'edit') && (
                                                        <Button variant="ghost" size="sm" onClick={() => openWorkflowModal('in_depth')}>Edit</Button>
                                                    )}
                                                </div>

                                                {/* 5. Enforcement */}
                                                <div className="relative flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.enforcement_stages)?.status === 'DONE' ? 'bg-primary text-primary-foreground' : getRel(caseData.enforcement_stages) ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                            {getRel(caseData.enforcement_stages)?.status === 'DONE' ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold">Enforcement</p>
                                                                {getRel(caseData.enforcement_stages) && (
                                                                    <InlineEditSelect
                                                                        value={getRel(caseData.enforcement_stages).status}
                                                                        options={[
                                                                            { label: 'In Progress', value: 'IN_PROGRESS' },
                                                                            { label: 'Done', value: 'DONE' },
                                                                        ]}
                                                                        onSave={(v) => saveEnforcementField('status', v)}
                                                                        canEdit={can('workflow', 'edit')}
                                                                    />
                                                                )}
                                                            </div>
                                                            {(() => {
                                                                const stage = getRel(caseData.enforcement_stages);
                                                                if (!stage) {
                                                                    const upload = getRel(caseData.case_uploads);
                                                                    if (isCustoms && upload?.decision_status === 'APPROVED' && upload?.decision_date) {
                                                                        const deadline = addDays(toLocalDate(upload.decision_date), 15);
                                                                        const colorClass = getDueDateColor(deadline.toISOString());
                                                                        return (
                                                                            <p className={cn("text-sm", colorClass)}>
                                                                                Due Date: {format(deadline, 'MMM dd, yyyy')}
                                                                            </p>
                                                                        );
                                                                    }
                                                                    return <p className="text-sm text-muted-foreground italic">Not started</p>;
                                                                }

                                                                const colorClass = stage.status === 'DONE' ? "text-muted-foreground" : getDueDateColor(stage.due_date);
                                                                return (
                                                                    <div className={cn("text-sm flex items-center gap-1 flex-wrap", colorClass)}>
                                                                        Due Date:{' '}
                                                                        <InlineEditDate
                                                                            value={stage.due_date}
                                                                            onSave={(v) => saveEnforcementField('due_date', v)}
                                                                            canEdit={can('workflow', 'edit')}
                                                                            className={cn("text-sm", colorClass)}
                                                                        />
                                                                        {stage.status === 'DONE' && stage.status_date && (
                                                                            <span className="flex items-center gap-1">
                                                                                • Done on{' '}
                                                                                <InlineEditDate
                                                                                    value={stage.status_date}
                                                                                    onSave={(v) => saveEnforcementField('status_date', v)}
                                                                                    canEdit={can('workflow', 'edit')}
                                                                                    className="text-sm text-muted-foreground"
                                                                                />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    {can('workflow', 'edit') && (
                                                        <Button variant="ghost" size="sm" onClick={() => openWorkflowModal('enforcement')}>Edit</Button>
                                                    )}
                                                </div>

                                                {/* 6. Final Report */}
                                                <div className="relative flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.final_reports)?.status === 'DONE' ? 'bg-primary text-primary-foreground' : getRel(caseData.final_reports) ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                            {getRel(caseData.final_reports)?.status === 'DONE' ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold">Final Report</p>
                                                                {getRel(caseData.final_reports) && (
                                                                    <InlineEditSelect
                                                                        value={getRel(caseData.final_reports).status}
                                                                        options={[
                                                                            { label: 'Pending', value: 'PENDING' },
                                                                            { label: 'Done', value: 'DONE' },
                                                                        ]}
                                                                        onSave={(v) => saveFinalReportField('status', v)}
                                                                        canEdit={can('workflow', 'edit')}
                                                                    />
                                                                )}
                                                            </div>
                                                            {(() => {
                                                                const report = getRel(caseData.final_reports);
                                                                if (!report) return <p className="text-sm text-muted-foreground italic">Not started</p>;

                                                                if (report.status === 'DONE') {
                                                                    return (
                                                                        <div className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
                                                                            {report.due_date && (
                                                                                <span className="flex items-center gap-1">
                                                                                    Due:{' '}
                                                                                    <InlineEditDate
                                                                                        value={report.due_date}
                                                                                        onSave={(v) => saveFinalReportField('due_date', v)}
                                                                                        canEdit={can('workflow', 'edit')}
                                                                                        className="text-sm text-muted-foreground"
                                                                                    />
                                                                                    {' • '}
                                                                                </span>
                                                                            )}
                                                                            <span className="flex items-center gap-1">
                                                                                Submitted on{' '}
                                                                                <InlineEditDate
                                                                                    value={report.submission_date}
                                                                                    onSave={(v) => saveFinalReportField('submission_date', v)}
                                                                                    canEdit={can('workflow', 'edit')}
                                                                                    className="text-sm text-muted-foreground"
                                                                                />
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }

                                                                const colorClass = report.due_date ? getDueDateColor(report.due_date) : "text-muted-foreground";
                                                                return (
                                                                    <div className={cn("text-sm flex items-center gap-1", colorClass)}>
                                                                        {report.due_date ? (
                                                                            <>
                                                                                Due Date:{' '}
                                                                                <InlineEditDate
                                                                                    value={report.due_date}
                                                                                    onSave={(v) => saveFinalReportField('due_date', v)}
                                                                                    canEdit={can('workflow', 'edit')}
                                                                                    className={cn("text-sm", colorClass)}
                                                                                />
                                                                            </>
                                                                        ) : (
                                                                            'Pending submission'
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    {getRel(caseData.final_reports)?.status === 'PENDING' && can('workflow', 'edit') && (
                                                        <Button variant="ghost" size="sm" onClick={() => setFinalReportModalOpen(true)}>Submit</Button>
                                                    )}
                                                </div>

                                                {/* 7. Invoice & Payment */}
                                                <div className="relative flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.invoices)?.status === 'PAID' ? 'bg-green-500 text-white' : getRel(caseData.invoices) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                            {getRel(caseData.invoices)?.status === 'PAID' ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold">Invoice & Payment</p>
                                                                {getRel(caseData.invoices) && (
                                                                    <InlineEditSelect
                                                                        value={getRel(caseData.invoices).status}
                                                                        options={[
                                                                            { label: 'Issued', value: 'ISSUED' },
                                                                            { label: 'Paid', value: 'PAID' },
                                                                            { label: 'Not Paid', value: 'NOT_PAID' },
                                                                        ]}
                                                                        onSave={(v) => saveInvoiceField('status', v)}
                                                                        canEdit={can('invoices', 'edit')}
                                                                    />
                                                                )}
                                                            </div>
                                                            {(() => {
                                                                const inv = getRel(caseData.invoices);
                                                                const report = getRel(caseData.final_reports);
                                                                const today = new Date();
                                                                today.setHours(0, 0, 0, 0);

                                                                if (inv) {
                                                                    const dueDateObj = toLocalDate(inv.due_date);
                                                                    const isOverdue = inv.status !== 'PAID' && today > dueDateObj;
                                                                    const colorClass = inv.status === 'PAID' ? "text-green-500" : isOverdue ? "text-red-500" : "text-orange-500";
                                                                    const statusText = isOverdue ? "Overdue" : inv.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase());

                                                                    return (
                                                                        <div className="flex flex-col">
                                                                            <div className={cn("text-sm font-bold flex items-center gap-1 flex-wrap", colorClass)}>
                                                                                <InlineEditField
                                                                                    value={inv.invoice_number}
                                                                                    onSave={(v) => saveInvoiceField('invoice_number', v)}
                                                                                    canEdit={can('invoices', 'edit')}
                                                                                    className={cn("text-sm font-bold", colorClass)}
                                                                                />
                                                                                <span>• Due:</span>
                                                                                <InlineEditDate
                                                                                    value={inv.due_date}
                                                                                    onSave={(v) => saveInvoiceField('due_date', v)}
                                                                                    canEdit={can('invoices', 'edit')}
                                                                                    className={cn("text-sm font-bold", colorClass)}
                                                                                />
                                                                                <span className="ml-1 text-[10px] font-normal opacity-80 uppercase">({statusText})</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <p className="text-sm text-muted-foreground italic">Not invoiced</p>
                                                                        {report?.status === 'DONE' && report?.submission_date && (() => {
                                                                            const clientName = getRel(caseData.case_uploads)?.client;
                                                                            const days = getPaymentTermDays(clientName);
                                                                            const invoiceDueDate = addDays(toLocalDate(report.submission_date), days);
                                                                            return <p className="text-xs text-orange-500 font-bold mt-0.5">Expected Due: {format(invoiceDueDate, 'MMM dd, yyyy')} (EXPECTED)</p>
                                                                        })()}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 8. Destruction */}
                                                <div className="relative flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`z-10 rounded-full p-1 shadow-lg ${getRel(caseData.destruction_stages)?.status === 'DONE' ? 'bg-primary text-primary-foreground' : getRel(caseData.destruction_stages) ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                                                            {getRel(caseData.destruction_stages)?.status === 'DONE' ? <CheckCircle2 className="h-8 w-8" /> : <Circle className="h-8 w-8" />}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold">Destruction Stage</p>
                                                                {getRel(caseData.destruction_stages) && (
                                                                    <InlineEditSelect
                                                                        value={getRel(caseData.destruction_stages).status}
                                                                        options={[
                                                                            { label: 'In Progress', value: 'IN_PROGRESS' },
                                                                            { label: 'Done', value: 'DONE' },
                                                                        ]}
                                                                        onSave={(v) => saveDestructionField('status', v)}
                                                                        canEdit={can('workflow', 'edit')}
                                                                    />
                                                                )}
                                                            </div>
                                                            {(() => {
                                                                const stage = getRel(caseData.destruction_stages);
                                                                if (!stage) return <p className="text-sm text-muted-foreground italic">Not started</p>;

                                                                const colorClass = stage.status === 'DONE' ? "text-muted-foreground" : getDueDateColor(stage.due_date);
                                                                return (
                                                                    <div className={cn("text-sm flex items-center gap-1 flex-wrap", colorClass)}>
                                                                        Due:{' '}
                                                                        <InlineEditDate
                                                                            value={stage.due_date}
                                                                            onSave={(v) => saveDestructionField('due_date', v)}
                                                                            canEdit={can('workflow', 'edit')}
                                                                            className={cn("text-sm", colorClass)}
                                                                        />
                                                                        {stage.status === 'DONE' && stage.status_date && (
                                                                            <span className="flex items-center gap-1">
                                                                                • Done on{' '}
                                                                                <InlineEditDate
                                                                                    value={stage.status_date}
                                                                                    onSave={(v) => saveDestructionField('status_date', v)}
                                                                                    canEdit={can('workflow', 'edit')}
                                                                                    className="text-sm text-muted-foreground"
                                                                                />
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    {can('workflow', 'edit') && (
                                                        <Button variant="ghost" size="sm" onClick={() => openWorkflowModal('destruction')}>Edit</Button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ===================== INVOICE TAB ===================== */}
                        <TabsContent value="invoice" className="mt-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Invoice Information</CardTitle>
                                        <CardDescription>Billing and payment details for this case.</CardDescription>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {getRel(caseData.invoices) ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                                                <InlineEditField
                                                    value={getRel(caseData.invoices).invoice_number}
                                                    onSave={(v) => saveInvoiceField('invoice_number', v)}
                                                    canEdit={can('invoices', 'edit')}
                                                    className="text-lg font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                                <InlineEditSelect
                                                    value={getRel(caseData.invoices).status}
                                                    options={[
                                                        { label: 'Issued', value: 'ISSUED' },
                                                        { label: 'Paid', value: 'PAID' },
                                                        { label: 'Not Paid', value: 'NOT_PAID' },
                                                    ]}
                                                    onSave={(v) => saveInvoiceField('status', v)}
                                                    canEdit={can('invoices', 'edit')}
                                                    className="text-sm font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Amount (USD)</p>
                                                <InlineEditField
                                                    value={getRel(caseData.invoices).amount_usd}
                                                    displayValue={`$${getRel(caseData.invoices).amount_usd}`}
                                                    onSave={(v) => saveInvoiceField('amount_usd', parseFloat(v))}
                                                    canEdit={can('invoices', 'edit')}
                                                    type="number"
                                                    className="text-lg font-bold text-primary"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                                                <InlineEditDate
                                                    value={getRel(caseData.invoices).due_date}
                                                    onSave={(v) => saveInvoiceField('due_date', v)}
                                                    canEdit={can('invoices', 'edit')}
                                                    className="font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                                                <InlineEditDate
                                                    value={getRel(caseData.invoices).issue_date}
                                                    onSave={(v) => saveInvoiceField('issue_date', v)}
                                                    canEdit={can('invoices', 'edit')}
                                                    className="font-semibold"
                                                />
                                            </div>
                                            {getRel(caseData.invoices).status_date && (
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium text-muted-foreground">Status Date</p>
                                                    <InlineEditDate
                                                        value={getRel(caseData.invoices).status_date}
                                                        onSave={(v) => saveInvoiceField('status_date', v)}
                                                        canEdit={can('invoices', 'edit')}
                                                        className="font-semibold"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                            <p className="text-muted-foreground">No invoice has been generated for this case yet.</p>
                                            {!getRel(caseData.case_uploads) ? (
                                                <p className="text-sm text-amber-600 mt-2 font-medium">
                                                    You must upload the case to a client before generating an invoice.
                                                </p>
                                            ) : can('invoices', 'edit') ? (
                                                <Button
                                                    variant="outline"
                                                    className="mt-4"
                                                    onClick={() => setInvoiceModalOpen(true)}
                                                >
                                                    Update Invoice
                                                </Button>
                                            ) : null}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* ===================== RIGHT SIDEBAR ===================== */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3 border-b border-white/5">
                            <CardTitle className="text-lg">Timeline & Deadlines</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {/* 1. Created */}
                            <div className="flex items-center gap-3">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Case Created</p>
                                    <p className="text-xs font-medium text-white">{format(toLocalDate(caseData.case_reported_date), 'MMM dd, yyyy')}</p>
                                </div>
                            </div>

                            {/* 2. Uploaded Due Date */}
                            {(() => {
                                const deadline = addDays(toLocalDate(caseData.case_reported_date), 7).toISOString();
                                const isDone = !!getRel(caseData.case_uploads);
                                const colorClass = isDone ? "text-green-500" : getDueDateColor(deadline);
                                return (
                                    <div className="flex items-center gap-3">
                                        <Calendar className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Upload Deadline</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {format(new Date(deadline), 'MMM dd, yyyy')}
                                                {isDone && <span className="ml-1 text-[9px] font-normal opacity-80">(Completed)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 2b. Client Decision Deadline */}
                            {(() => {
                                const upload = getRel(caseData.case_uploads);
                                const hasDecision = !!upload?.decision_status && upload.decision_status !== 'WAITING';
                                const deadline = upload ? addDays(toLocalDate(upload.upload_date), 7).toISOString() : null;
                                const colorClass = hasDecision
                                    ? "text-green-500"
                                    : deadline
                                        ? getDueDateColor(deadline)
                                        : "text-muted-foreground";
                                return (
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Client Decision</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {hasDecision && upload?.decision_date
                                                    ? format(toLocalDate(upload.decision_date), 'MMM dd, yyyy')
                                                    : deadline
                                                        ? format(new Date(deadline), 'MMM dd, yyyy')
                                                        : 'Not uploaded'}
                                                {hasDecision && (
                                                    <span className="ml-1 text-[9px] font-normal opacity-80">
                                                        ({upload?.decision_status === 'APPROVED' ? 'Approved' : 'Rejected'})
                                                    </span>
                                                )}
                                                {!hasDecision && deadline && (
                                                    <span className="ml-1 text-[9px] font-normal opacity-80">(Due)</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 3. In-Depth Due Date */}
                            {(() => {
                                if (isCustoms) {
                                    return (
                                        <div className="flex items-center gap-3">
                                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">In-Depth Deadline</p>
                                                <p className="text-xs font-bold text-muted-foreground">
                                                    N/A <span className="ml-1 text-[9px] font-normal opacity-80">(Skipped)</span>
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }
                                const stage = getRel(caseData.in_depth_stages);
                                const isDone = stage?.status === 'DONE';
                                const colorClass = isDone ? "text-green-500" : stage?.due_date ? getDueDateColor(stage.due_date) : "text-muted-foreground";
                                return (
                                    <div className="flex items-center gap-3">
                                        <Calendar className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">In-Depth Deadline</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {stage?.due_date ? format(toLocalDate(stage.due_date), 'MMM dd, yyyy') : 'Not started'}
                                                {isDone && <span className="ml-1 text-[9px] font-normal opacity-80">(Completed)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 4. Enforcement Due Date */}
                            {(() => {
                                const stage = getRel(caseData.enforcement_stages);
                                const isDone = stage?.status === 'DONE';

                                const upload = getRel(caseData.case_uploads);
                                const customsFallbackDate = isCustoms && !stage && upload?.decision_status === 'APPROVED' && upload?.decision_date
                                    ? addDays(toLocalDate(upload.decision_date), 15).toISOString()
                                    : null;

                                const effectiveDueDate = stage?.due_date || customsFallbackDate;
                                const colorClass = isDone ? "text-green-500" : effectiveDueDate ? getDueDateColor(effectiveDueDate) : "text-muted-foreground";
                                return (
                                    <div className="flex items-center gap-3">
                                        <Zap className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Enforcement Deadline</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {effectiveDueDate ? format(toLocalDate(effectiveDueDate), 'MMM dd, yyyy') : 'Not started'}
                                                {isDone && <span className="ml-1 text-[9px] font-normal opacity-80">(Completed)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 5. Final Report Due Date */}
                            {(() => {
                                const report = getRel(caseData.final_reports);
                                const isDone = report?.status === 'DONE';
                                const colorClass = isDone ? "text-green-500" : report?.due_date ? getDueDateColor(report.due_date) : "text-muted-foreground";
                                return (
                                    <div className="flex items-center gap-3">
                                        <FileText className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Final Report Date</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {report?.submission_date
                                                    ? format(toLocalDate(report.submission_date), 'MMM dd, yyyy')
                                                    : report?.due_date
                                                        ? format(toLocalDate(report.due_date), 'MMM dd, yyyy')
                                                        : 'Not started'}
                                                {isDone && <span className="ml-1 text-[9px] font-normal opacity-80">(Submitted)</span>}
                                                {report && !isDone && report.due_date && <span className="ml-1 text-[9px] font-normal opacity-80">(Due)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 5b. Invoice Issue Date */}
                            {(() => {
                                const inv = getRel(caseData.invoices);
                                const colorClass = inv?.issue_date ? "text-green-500" : "text-red-500";
                                return (
                                    <div className="flex items-center gap-3">
                                        <DollarSign className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Issue Date</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {inv?.issue_date
                                                    ? format(toLocalDate(inv.issue_date), 'MMM dd, yyyy')
                                                    : 'Not issued'}
                                                {inv?.issue_date && <span className="ml-1 text-[9px] font-normal opacity-80">(Issued)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 6. Destruction Due Date */}
                            {(() => {
                                const stage = getRel(caseData.destruction_stages);
                                const isDone = stage?.status === 'DONE';
                                const colorClass = isDone ? "text-green-500" : stage?.due_date ? getDueDateColor(stage.due_date) : "text-muted-foreground";
                                return (
                                    <div className="flex items-center gap-3">
                                        <Trash2 className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Destruction Deadline</p>
                                            <p className={cn("text-xs font-bold", colorClass)}>
                                                {stage?.due_date ? format(toLocalDate(stage.due_date), 'MMM dd, yyyy') : 'Not started'}
                                                {isDone && <span className="ml-1 text-[9px] font-normal opacity-80">(Completed)</span>}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 7. Invoice Due Date */}
                            {(() => {
                                const inv = getRel(caseData.invoices);
                                const report = getRel(caseData.final_reports);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);

                                let colorClass = "text-muted-foreground";
                                if (inv) {
                                    if (inv.status === 'PAID') {
                                        colorClass = "text-green-500";
                                    } else {
                                        const dueDateObj = toLocalDate(inv.due_date);
                                        colorClass = today > dueDateObj ? "text-red-500 font-bold" : "text-orange-500 font-bold";
                                    }
                                } else if (report?.status === 'DONE' && report?.submission_date) {
                                    const clientName = getRel(caseData.case_uploads)?.client;
                                    const days = getPaymentTermDays(clientName);
                                    const calcDate = addDays(toLocalDate(report.submission_date), days);
                                    colorClass = getDueDateColor(calcDate.toISOString());
                                }

                                return (
                                    <div className="flex items-center gap-3">
                                        <DollarSign className={cn("h-3.5 w-3.5", colorClass.split(' ')[0])} />
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Invoice Due Date</p>
                                            {(() => {
                                                let displayDate = 'Not invoiced';
                                                let statusText = '';

                                                if (inv?.due_date) {
                                                    displayDate = format(toLocalDate(inv.due_date), 'MMM dd, yyyy');
                                                    const dueDateObj = toLocalDate(inv.due_date);

                                                    if (inv.status === 'PAID') {
                                                        statusText = "(Paid)";
                                                    } else if (today > dueDateObj) {
                                                        statusText = "(Overdue)";
                                                    } else if (inv.status === 'ISSUED') {
                                                        statusText = "(Issued)";
                                                    } else {
                                                        statusText = `(${inv.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())})`;
                                                    }
                                                } else if (report?.status === 'DONE' && report?.submission_date) {
                                                    const clientName = getRel(caseData.case_uploads)?.client;
                                                    const days = getPaymentTermDays(clientName);
                                                    const calcDate = addDays(toLocalDate(report.submission_date), days);
                                                    displayDate = format(calcDate, 'MMM dd, yyyy');
                                                    statusText = "(Expected)";
                                                }

                                                return (
                                                    <p className={cn("text-xs font-bold", colorClass)}>
                                                        {displayDate}
                                                        {statusText && <span className="ml-1 text-[9px] font-normal opacity-80 uppercase">{statusText}</span>}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="pt-2 border-t border-white/5 flex items-center gap-3">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <div>
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Last Updated</p>
                                    <p className="text-[10px] text-muted-foreground">{format(new Date(caseData.updated_at), 'PPPp')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Next Due Date Card */}
                    {(() => {
                        const getDueDateInfo = () => {
                            let dDate = addDays(toLocalDate(caseData.case_reported_date), 7);
                            let label = "Submission Due Date";

                            const upload = getRel(caseData.case_uploads);
                            const inDepth = getRel(caseData.in_depth_stages);
                            const enforcement = getRel(caseData.enforcement_stages);
                            const destruction = getRel(caseData.destruction_stages);
                            const invoice = getRel(caseData.invoices);
                            const finalReport = getRel(caseData.final_reports);

                            if (invoice && invoice.status === 'PAID') {
                                dDate = toLocalDate(invoice.due_date);
                                label = "Completed";
                            } else if (invoice && invoice.status !== 'PAID' && invoice.due_date) {
                                dDate = toLocalDate(invoice.due_date);
                                label = "Invoice Due Date";
                            } else if (finalReport && finalReport.status === 'DONE' && finalReport.submission_date) {
                                const days = upload?.client ? getPaymentTermDays(upload.client) : 60;
                                dDate = addDays(toLocalDate(finalReport.submission_date), days);
                                label = "Expected Invoice Due Date";
                            } else if (finalReport && finalReport.status === 'PENDING' && finalReport.due_date) {
                                dDate = toLocalDate(finalReport.due_date);
                                label = "Final Report Due Date";
                            } else if (destruction && destruction.status !== 'DONE' && destruction.due_date) {
                                dDate = toLocalDate(destruction.due_date);
                                label = "Destruction Due Date";
                            } else if (enforcement && enforcement.status !== 'DONE' && enforcement.due_date) {
                                dDate = toLocalDate(enforcement.due_date);
                                label = "Enforcement Due Date";
                            } else if (isCustoms && !enforcement && upload?.decision_status === 'APPROVED' && upload?.decision_date) {
                                dDate = addDays(toLocalDate(upload.decision_date), 15);
                                label = "Enforcement Due Date";
                            } else if (!isCustoms && inDepth && inDepth.status !== 'DONE' && inDepth.due_date) {
                                dDate = toLocalDate(inDepth.due_date);
                                label = "In-Depth Due Date";
                            } else if (upload && (!upload.decision_status || upload.decision_status === 'WAITING')) {
                                dDate = addDays(toLocalDate(upload.upload_date), 7);
                                label = "Client Decision Due Date";
                            }

                            return { date: dDate, label };
                        };

                        const { date: dueDate, label: dueDateLabel } = getDueDateInfo();
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const dueDateFlat = new Date(dueDate);
                        dueDateFlat.setHours(0, 0, 0, 0);

                        const diffDays = Math.ceil((dueDateFlat.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                        let statusColor = "border-green-500/50 bg-green-500/10 text-green-600";
                        if (diffDays < 0) {
                            statusColor = "border-red-500/50 bg-red-500/10 text-red-600";
                        } else if (diffDays <= 2) {
                            statusColor = "border-orange-500/50 bg-orange-500/10 text-orange-600";
                        }

                        return (
                            <Card className={cn("border-2 shadow-sm", statusColor)}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-bold uppercase tracking-wider">{dueDateLabel}</CardTitle>
                                        <Calendar className="h-4 w-4" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-black">{format(dueDate, 'PPP')}</div>
                                    <p className="text-xs font-semibold mt-1 opacity-80">
                                        {diffDays < 0
                                            ? `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`
                                            : diffDays === 0
                                                ? 'Due Today'
                                                : `${diffDays} day${diffDays === 1 ? '' : 's'} remaining`}
                                    </p>
                                </CardContent>
                            </Card>
                        );
                    })()}

                    {/* Fee Summary Card */}
                    <Card className="gradient-primary text-primary-foreground">
                        <CardHeader>
                            <CardTitle className="text-lg">Fee Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <InlineEditField
                                    value={getRel(caseData.case_uploads)?.our_fee_usd || '0.00'}
                                    displayValue={`$${getRel(caseData.case_uploads)?.our_fee_usd || '0.00'}`}
                                    onSave={async (v) => {
                                        const numericFee = parseFloat(v);
                                        if (isNaN(numericFee) || numericFee < 0) {
                                            toast.error('Please enter a valid fee amount');
                                            throw new Error('Invalid fee');
                                        }
                                        await saveUploadField('our_fee_usd', numericFee);
                                    }}
                                    canEdit={can('cases', 'edit') && !!getRel(caseData.case_uploads)}
                                    type="number"
                                    className="text-3xl font-bold"
                                    inputClassName="h-10 text-xl font-bold bg-white/20 border-white/30 text-primary-foreground placeholder:text-primary-foreground/50"
                                />
                                <p className="text-primary-foreground/80 text-sm mt-1">
                                    {getRel(caseData.case_uploads) ? `Uploaded to ${normalizeClientName(getRel(caseData.case_uploads).client)}` : 'In Hand (Not yet uploaded)'}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-primary-foreground/20 space-y-3">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase opacity-70">Invoice Status</p>
                                    <p className="text-sm font-bold">
                                        {getRel(caseData.invoices)?.status
                                            ? getRel(caseData.invoices).status.replace('_', ' ')
                                            : getRel(caseData.final_reports)?.status === 'DONE' ? 'PENDING ISSUANCE' : 'IN PROGRESS'}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase opacity-70">Invoice Due Date</p>
                                    <p className="text-sm font-bold">
                                        {getRel(caseData.invoices)?.due_date
                                            ? format(toLocalDate(getRel(caseData.invoices).due_date), 'PPP')
                                            : getRel(caseData.final_reports)?.status === 'DONE' && getRel(caseData.final_reports)?.submission_date
                                                ? format(addDays(toLocalDate(getRel(caseData.final_reports).submission_date), getPaymentTermDays(getRel(caseData.case_uploads)?.client)), 'PPP')
                                                : 'Awaiting report submission'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Modals */}
            {id && (
                <>
                    <UploadToClientModal
                        caseId={id}
                        isOpen={uploadModalOpen}
                        onClose={() => setUploadModalOpen(false)}
                        onSuccess={refetch}
                        brandName={caseData?.brand_name}
                        caseType={caseData?.case_type}
                    />
                    <RecordDecisionModal
                        caseId={id}
                        caseType={caseData.case_type}
                        isOpen={decisionModalOpen}
                        onClose={() => setDecisionModalOpen(false)}
                        onSuccess={refetch}
                    />
                    <SendInvoiceModal
                        caseId={id}
                        isOpen={invoiceModalOpen}
                        onClose={() => setInvoiceModalOpen(false)}
                        onSuccess={refetch}
                        defaultAmount={getRel(caseData.case_uploads)?.our_fee_usd}
                        clientName={getRel(caseData.case_uploads)?.client}
                        finalReportDate={getRel(caseData.final_reports)?.submission_date}
                        brandName={caseData?.brand_name}
                        caseType={caseData?.case_type}
                    />
                    <UpdateWorkflowModal
                        caseId={id}
                        stage={workflowStage}
                        caseType={caseData.case_type}
                        isOpen={workflowModalOpen}
                        onClose={() => setWorkflowModalOpen(false)}
                        onSuccess={refetch}
                        currentData={
                            workflowStage === 'in_depth'
                                ? getRel(caseData.in_depth_stages)
                                : workflowStage === 'enforcement'
                                    ? getRel(caseData.enforcement_stages)
                                    : getRel(caseData.destruction_stages)
                        }
                    />
                    <SubmitFinalReportModal
                        caseId={id}
                        isOpen={finalReportModalOpen}
                        onClose={() => setFinalReportModalOpen(false)}
                        onSuccess={refetch}
                    />
                    {getRel(caseData.invoices) && (
                        <UpdateInvoiceStatusModal
                            invoiceId={getRel(caseData.invoices).id}
                            isOpen={invoiceStatusModalOpen}
                            onClose={() => setInvoiceStatusModalOpen(false)}
                            onSuccess={refetch}
                            currentStatus={getRel(caseData.invoices).status}
                            currentStatusDate={getRel(caseData.invoices).status_date}
                        />
                    )}
                </>
            )}
            <AlertDialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reopen this rejected case?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The case will go back to the Decision Waiting stage so you can record a new client decision. The upload (client and fee) is kept; only the decision is cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isReopening}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleReopen();
                            }}
                            disabled={isReopening}
                        >
                            {isReopening ? 'Reopening...' : 'Reopen Case'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this case
                            and all associated records.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Case"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <DuplicateErrorDialog
                open={!!duplicateError}
                onClose={clearDuplicateError}
                title={duplicateError?.type === 'matter_code' ? 'Duplicate Matter Code' : 'Duplicate Invoice Number'}
                value={duplicateError?.value || ''}
                description={
                    duplicateError?.type === 'matter_code'
                        ? 'Each case must have a unique matter code. Please modify the serial number or other parts to create a unique code.'
                        : 'Each invoice must have a unique number. Please modify the serial number or other parts to create a unique number.'
                }
            />
        </div>
    );
};

export default CaseDetail;
