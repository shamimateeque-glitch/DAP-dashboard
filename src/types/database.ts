export type UserRole = 'SUPER_ADMIN' | 'DATA_ENTRY' | 'VIEW_ONLY' | 'INVESTIGATION_TEAM';
export type CaseStatus = 'IN_HAND' | 'UPLOADED' | 'AWAITING_DECISION' | 'APPROVED' | 'REJECTED' | 'IN_DEPTH' | 'ENFORCEMENT' | 'DESTRUCTION' | 'CLOSED';
export type FinalReportStatus = 'PENDING' | 'DONE';
export type Client = 'ONEWORLD' | 'A.A ASSOCIATES' | 'SAFEMARK' | 'DAP-IP';
export type DecisionStatus = 'WAITING' | 'APPROVED' | 'REJECTED';
export type WorkflowStatus = 'IN_PROGRESS' | 'DONE';
export type InvoiceStatus = 'ISSUED' | 'PAID' | 'NOT_PAID';

export interface User {
    id: string;
    auth_user_id: string;
    email: string;
    full_name: string;
    role: UserRole;
    is_active: boolean;
    avatar_url?: string;
    permissions: {
        cases: { view: boolean; create: boolean; edit: boolean };
        workflow: { view: boolean; edit: boolean };
        invoices: { view: boolean; edit: boolean };
        reports: { view: boolean; export: boolean };
        alerts: { view: boolean };
        admin: { users: boolean; settings: boolean };
    };
    created_at: string;
    updated_at: string;
}

export interface Case {
    id: string;
    case_id: string;
    target_name: string;
    target_category: string;
    target_address: string;
    city: string;
    province: string;
    brand_name: string;
    products_name: string;
    case_reported_date: string;
    case_reported_by?: string;
    case_type?: string;
    matter_code?: string;
    notes_description?: string;
    case_status: CaseStatus;
    closed_date?: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
    case_uploads?: CaseUpload[];
    in_depth_stages?: InDepthStage[];
    enforcement_stages?: EnforcementStage[];
    final_reports?: FinalReport[];
    invoices?: Invoice[];
    destruction_stages?: DestructionStage[];
}

export interface CaseUpload {
    id: string;
    case_id: string;
    client: Client;
    upload_date: string;
    our_fee_usd: number;
    decision_status?: DecisionStatus;
    decision_date?: string;
    created_at: string;
    updated_at: string;
}

export interface InDepthStage {
    id: string;
    case_id: string;
    due_date: string;
    status: WorkflowStatus;
    status_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface EnforcementStage {
    id: string;
    case_id: string;
    due_date: string;
    status: WorkflowStatus;
    status_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface FinalReport {
    id: string;
    case_id: string;
    status: FinalReportStatus;
    due_date?: string;
    submission_date?: string;
    status_date?: string;
    created_at: string;
}

export interface Invoice {
    id: string;
    case_id: string;
    invoice_number: string;
    issue_date: string;
    due_date: string;
    amount_usd: number;
    status: InvoiceStatus;
    status_date?: string;
    created_at: string;
    updated_at: string;
}

export interface DestructionStage {
    id: string;
    case_id: string;
    due_date: string;
    status: WorkflowStatus;
    status_date?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export type AlertType =
    | 'CASE_APPROVED'
    | 'CASE_REJECTED'
    | 'IN_DEPTH_DONE'
    | 'IN_DEPTH_DATE_CHANGED'
    | 'ENFORCEMENT_DONE'
    | 'ENFORCEMENT_DATE_CHANGED'
    | 'DESTRUCTION_DONE'
    | 'FINAL_REPORT_SUBMITTED'
    | 'INVOICE_ISSUED'
    | 'INVOICE_PAID'
    | 'INVOICE_OVERDUE';

export type ReminderType =
    | 'IN_DEPTH_DUE'
    | 'ENFORCEMENT_DUE'
    | 'INVOICE_DUE';

export interface AlertConfiguration {
    id: string;
    alert_type: AlertType;
    user_id: string;
    is_enabled: boolean;
    created_at: string;
}

export interface AlertLog {
    id: string;
    alert_type: AlertType;
    case_id?: string;
    recipient_id: string;
    sent_at: string;
    email_status: string;
}

export interface ReminderLog {
    id: string;
    reminder_type: ReminderType;
    case_id: string;
    scheduled_date: string;
    sent_at?: string;
    email_status: string;
}

