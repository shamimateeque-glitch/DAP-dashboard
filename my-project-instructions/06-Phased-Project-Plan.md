# Operations Management Application
# Phased Project Plan
# Version 1.0

---

## EXECUTIVE SUMMARY

This document outlines a structured, phased approach to building the Operations Management Application. Each phase delivers working functionality that can be tested and validated before proceeding.

**Estimated Total Duration:** 8-12 weeks (depending on pace)
**Recommended Approach:** Complete each phase fully before moving to the next

---

## PHASE OVERVIEW

| Phase | Name | Duration | Deliverables |
|-------|------|----------|--------------|
| 0 | Setup & Foundation | 1 week | Project structure, Supabase setup, auth |
| 1 | Core Case Management | 2 weeks | Case CRUD, basic lists, filtering |
| 2 | Client Upload & Decision | 1 week | Upload flow, decision recording |
| 3 | Workflow Stages | 2 weeks | In-Depth, Enforcement, Destruction |
| 4 | Invoicing | 1 week | Invoice creation, status tracking |
| 5 | Alerts & Reminders | 1-2 weeks | Email notifications, scheduled jobs |
| 6 | Reports & Exports | 1-2 weeks | All reports, CSV/Excel/PDF export |
| 7 | Admin & Polish | 1 week | User management, settings, refinements |

---

## PHASE 0: SETUP & FOUNDATION (Week 1)

### Objectives
- Set up development environment
- Configure Supabase project
- Implement authentication
- Create basic application shell

### Tasks

#### 0.1 Supabase Setup
- [ ] Create Supabase project (cloud)
- [ ] Run database schema SQL (from 02-database-schema.sql)
- [ ] Verify all tables, indexes, and triggers created
- [ ] Enable Row Level Security on all tables
- [ ] Apply RLS policies
- [ ] Insert seed data (system settings, reminder configs)

#### 0.2 Project Setup
- [ ] Initialize React project with Vite + TypeScript
- [ ] Install dependencies:
  ```
  npm install @supabase/supabase-js react-router-dom @tanstack/react-query
  npm install react-hook-form zod @hookform/resolvers
  npm install tailwindcss postcss autoprefixer
  npm install lucide-react date-fns
  npm install -D @types/node
  ```
- [ ] Configure Tailwind CSS
- [ ] Set up folder structure:
  ```
  src/
  ├── components/
  │   ├── ui/           # Reusable UI components
  │   ├── forms/        # Form components
  │   └── layout/       # Layout components
  ├── pages/            # Page components
  ├── hooks/            # Custom hooks
  ├── lib/              # Utilities, Supabase client
  ├── types/            # TypeScript types
  └── contexts/         # React contexts
  ```
- [ ] Configure environment variables (.env)
- [ ] Set up Supabase client (src/lib/supabase.ts)

#### 0.3 Authentication
- [ ] Create Login page
- [ ] Create Password Reset page
- [ ] Implement AuthContext for session management
- [ ] Create ProtectedRoute component
- [ ] Implement sign in / sign out functionality
- [ ] Test authentication flow

#### 0.4 Application Shell
- [ ] Create main layout component
- [ ] Build sidebar navigation
- [ ] Build header with user menu
- [ ] Implement route configuration
- [ ] Create placeholder pages for all routes

### Deliverables
- Working login/logout flow
- Protected application with basic navigation
- Database fully configured in Supabase

### Validation Checklist
- [ ] Can log in with test user
- [ ] Cannot access app without authentication
- [ ] Navigation shows all menu items
- [ ] Database tables visible in Supabase dashboard

---

## PHASE 1: CORE CASE MANAGEMENT (Weeks 2-3)

### Objectives
- Implement full case CRUD operations
- Build case list with filtering and pagination
- Create case detail view

### Tasks

#### 1.1 TypeScript Types
- [ ] Define all types matching database schema:
  - Case, CaseUpload, InDepthStage, etc.
  - Enums: CaseStatus, Client, WorkflowStatus, etc.
- [ ] Create Zod schemas for validation

#### 1.2 Case List Page
- [ ] Build CaseList component
- [ ] Implement data fetching with React Query
- [ ] Create reusable DataTable component
- [ ] Add columns: Case ID, Target, Brand, Client, Province, Status, Date
- [ ] Implement status badge component
- [ ] Add pagination
- [ ] Implement sorting (default: newest first)

#### 1.3 Case Filters
- [ ] Create FilterBar component
- [ ] Add filters: Status, Client, Brand, Province, Date Range
- [ ] Add search input (Case ID, Target Name, Brand)
- [ ] Implement filter state management
- [ ] Add "Clear Filters" button

#### 1.4 New Case Form
- [ ] Create NewCaseForm component
- [ ] Implement all required fields with validation
- [ ] Add province dropdown
- [ ] Add date picker for submitted date
- [ ] Implement form submission
- [ ] Show success/error feedback
- [ ] Redirect to case detail on success

#### 1.5 Case Detail Page
- [ ] Create CaseDetail component
- [ ] Display all case information
- [ ] Create tabbed interface (Details, Workflow, Invoice, Notes)
- [ ] Build Details tab with case information
- [ ] Show workflow progress indicator

#### 1.6 Edit Case
- [ ] Create EditCaseForm component
- [ ] Pre-populate with existing data
- [ ] Implement update functionality
- [ ] Handle optimistic updates

### Deliverables
- Fully functional case list with filters
- Create new case
- View case details
- Edit case information

### Validation Checklist
- [ ] Can create a new case
- [ ] Case ID auto-generated
- [ ] Can view all cases in list
- [ ] Filters work correctly
- [ ] Can view individual case details
- [ ] Can edit case information
- [ ] Changes persist after refresh

---

## PHASE 2: CLIENT UPLOAD & DECISION (Week 4)

### Objectives
- Implement upload to client functionality
- Implement decision recording
- Handle status transitions

### Tasks

#### 2.1 Upload to Client
- [ ] Create UploadToClientModal component
- [ ] Add client selection (OneWorld, AA, SafeMark)
- [ ] Add upload date picker
- [ ] Add fee input (required, numeric validation)
- [ ] Implement upload creation
- [ ] Verify case status changes to UPLOADED

#### 2.2 Record Decision
- [ ] Create RecordDecisionModal component
- [ ] Add Approved/Rejected radio buttons
- [ ] Add decision date picker
- [ ] Implement decision update
- [ ] Handle status transitions:
  - If Approved → Status = APPROVED
  - If Rejected → Status = REJECTED, Closed Date set

#### 2.3 Case Detail - Workflow Tab
- [ ] Display upload information
- [ ] Display decision information
- [ ] Add "Upload to Client" button (when case is IN_HAND)
- [ ] Add "Record Decision" button (when case is UPLOADED)
- [ ] Show workflow progress

#### 2.4 Client-wise Lists
- [ ] Create Uploaded cases list (filtered by status)
- [ ] Create Client-wise Uploaded list
- [ ] Create Approved/Rejected lists
- [ ] Create Client-wise Approved/Rejected lists

### Deliverables
- Upload case to client flow
- Record client decision flow
- Automatic status transitions
- Client-filtered case lists

### Validation Checklist
- [ ] Can upload case to client
- [ ] Fee is required at upload
- [ ] Case status changes to UPLOADED
- [ ] Can record Approved decision
- [ ] Can record Rejected decision
- [ ] Approved cases show status APPROVED
- [ ] Rejected cases show status REJECTED with closed date
- [ ] Client-wise lists filter correctly

---

## PHASE 3: WORKFLOW STAGES (Weeks 5-6)

### Objectives
- Implement In-Depth, Enforcement, Destruction stages
- Handle Final Report recording
- Implement auto-close on Destruction complete

### Tasks

#### 3.1 In-Depth Stage
- [ ] Auto-create In-Depth stage when case approved (or manual creation)
- [ ] Default target date = Approval + 7 days
- [ ] Create In-Depth edit modal
- [ ] Allow target date editing
- [ ] Allow marking as Done
- [ ] Record status date when status changes
- [ ] Add notes field

#### 3.2 Enforcement Stage
- [ ] Create Enforcement stage after In-Depth created
- [ ] Default target date = In-Depth target + 7 days
- [ ] Create Enforcement edit modal
- [ ] Same functionality as In-Depth

#### 3.3 Final Report
- [ ] Create Final Report modal
- [ ] Record submission date
- [ ] Display in workflow tab

#### 3.4 Destruction Stage
- [ ] Create Destruction stage after Enforcement done
- [ ] Default due date = day after Enforcement done
- [ ] Create Destruction edit modal
- [ ] **CRITICAL**: Auto-close case when Destruction marked Done
- [ ] Set case status = CLOSED and closed_date

#### 3.5 Workflow Lists
- [ ] Create In-Depth list page (In-Progress / Done tabs)
- [ ] Create Enforcement list page (In-Progress / Done tabs)
- [ ] Create Destruction list page (In-Progress / Done tabs)
- [ ] Add appropriate columns per requirements
- [ ] Add filters: Client, Brand, Province, Date Range, Status
- [ ] Default sort: Target Date (earliest first)

#### 3.6 Case Detail Integration
- [ ] Show all workflow stages in Workflow tab
- [ ] Show status badges for each stage
- [ ] Show due date warnings (overdue, due soon)
- [ ] Enable stage editing from case detail

### Deliverables
- Complete workflow stage management
- Auto-date calculations
- Auto-close functionality
- Workflow-specific lists

### Validation Checklist
- [ ] In-Depth created with correct default date
- [ ] Enforcement created with correct default date
- [ ] Can edit target dates
- [ ] Can mark stages as Done
- [ ] Status dates recorded correctly
- [ ] Final Report can be recorded
- [ ] Destruction auto-closes case when Done
- [ ] Workflow lists show correct data
- [ ] Filters work on workflow lists

---

## PHASE 4: INVOICING (Week 7)

### Objectives
- Implement invoice creation
- Implement status tracking
- Build invoice lists

### Tasks

#### 4.1 Invoice Creation
- [ ] Create invoice after Final Report submitted (or manual)
- [ ] Auto-generate invoice number (INV-YYYY-NNNN)
- [ ] Auto-calculate due date (Issue + 60 days)
- [ ] Initial status = ISSUED
- [ ] Fee retrieved from case_uploads.our_fee_usd

#### 4.2 Invoice Status Management
- [ ] Create UpdateInvoiceStatusModal
- [ ] Allow marking as PAID
- [ ] Allow marking as NOT_PAID
- [ ] Record status_date on change

#### 4.3 Case Detail - Invoice Tab
- [ ] Display invoice information
- [ ] Show invoice number, amount, dates, status
- [ ] Add status change buttons
- [ ] Show "Create Invoice" if none exists

#### 4.4 Invoice Lists
- [ ] Create All Invoices list
- [ ] Create Not Paid list
- [ ] Create Paid list
- [ ] Add filters: Client, Brand, Province, Status, Date Range
- [ ] Default sort: Due Date (earliest first)
- [ ] Show overdue indicators

#### 4.5 Summary Display
- [ ] Calculate and show Total Outstanding
- [ ] Calculate and show Overdue amount

### Deliverables
- Invoice creation flow
- Invoice status management
- Invoice lists with filters
- Outstanding/overdue visibility

### Validation Checklist
- [ ] Invoice created with correct number format
- [ ] Due date calculated correctly (issue + 60 days)
- [ ] Amount matches upload fee
- [ ] Can mark invoice as Paid
- [ ] Can mark invoice as Not Paid
- [ ] Status date recorded on change
- [ ] Invoice lists filter correctly
- [ ] Overdue invoices highlighted

---

## PHASE 5: ALERTS & REMINDERS (Weeks 8-9)

### Objectives
- Implement email notifications for alerts
- Implement scheduled reminders
- Build configuration interface

### Tasks

#### 5.1 Email Setup
- [ ] Choose email provider (Resend recommended for Supabase)
- [ ] Configure SMTP settings in Supabase
- [ ] Create email templates for each alert type
- [ ] Test email sending

#### 5.2 Event-Based Alerts (Edge Functions)
- [ ] Create Edge Function for sending alerts
- [ ] Implement triggers for:
  - CASE_APPROVED
  - CASE_REJECTED
  - IN_DEPTH_DONE
  - IN_DEPTH_DATE_CHANGED
  - ENFORCEMENT_DONE
  - ENFORCEMENT_DATE_CHANGED
  - DESTRUCTION_DONE
  - FINAL_REPORT_SUBMITTED
  - INVOICE_ISSUED
  - INVOICE_PAID
  - INVOICE_OVERDUE
- [ ] Log all sent alerts to alert_logs table

#### 5.3 Date-Based Reminders
- [ ] Create scheduled Edge Function (pg_cron or external scheduler)
- [ ] Run daily to check for:
  - In-Depth due dates (2, 1, 0 days before)
  - Enforcement due dates (2, 1, 0 days before)
  - Invoice due dates (15, 7, 0 days before; every 15 after until paid)
- [ ] Log reminders to reminder_logs table

#### 5.4 Alert Configuration UI
- [ ] Create Alerts & Reminders page
- [ ] Build alert configuration table
- [ ] Allow configuring recipients per alert type
- [ ] Allow enabling/disabling alerts

#### 5.5 Alert History
- [ ] Create Alert History tab
- [ ] Show sent alerts with date, type, recipient, status
- [ ] Show reminder history

### Deliverables
- Email alerts for all event types
- Scheduled reminders for due dates
- Configuration interface
- Alert/reminder history

### Validation Checklist
- [ ] Emails sent when events occur
- [ ] Reminders sent on correct dates
- [ ] Can configure alert recipients
- [ ] Alert history shows sent items
- [ ] Failed emails logged correctly

---

## PHASE 6: REPORTS & EXPORTS (Weeks 10-11)

### Objectives
- Implement all report views
- Implement export functionality (CSV, Excel, PDF)
- Build Financial Summary

### Tasks

#### 6.1 Install Export Libraries
- [ ] npm install xlsx jspdf jspdf-autotable papaparse

#### 6.2 Export Functionality
- [ ] Create exportToCSV utility function
- [ ] Create exportToExcel utility function
- [ ] Create exportToPDF utility function
- [ ] Add export buttons to all list pages
- [ ] Handle large data exports gracefully

#### 6.3 Report Pages
- [ ] Operational Reports:
  - All Cases, In-Hand, Uploaded, Approved, Rejected, Closed
- [ ] Client Reports:
  - OneWorld, AA, SafeMark (with counts and totals)
- [ ] Province Reports:
  - Province-wise All, Approved, Rejected
- [ ] Workflow Reports:
  - In-Depth (In-Progress/Done)
  - Enforcement (In-Progress/Done)
  - Destruction (In-Progress/Done)

#### 6.4 Financial Summary Report
- [ ] Create Financial Summary page
- [ ] Add filters: Client, Brand, Province, Date Range
- [ ] Show by-client breakdown:
  - Case Volume (Total, Approved, Rejected)
  - Fee Totals (Uploaded, Approved, Invoiced, Paid, Outstanding)
- [ ] Show Invoice Aging:
  - Not Yet Due, Due Today
  - Overdue 1-15, 16-30, 31-60, >60 days
- [ ] Export financial summary

#### 6.5 Closed Cases Report
- [ ] Create Closed Cases list
- [ ] Include all required columns per spec
- [ ] Show count and list
- [ ] Default sort: Closed Date (newest first)

### Deliverables
- All report views
- Export to CSV, Excel, PDF
- Financial Summary with aging
- Closed Cases report

### Validation Checklist
- [ ] All report pages accessible
- [ ] Filters work on all reports
- [ ] CSV export works correctly
- [ ] Excel export opens in Excel
- [ ] PDF export renders cleanly
- [ ] Financial Summary shows correct totals
- [ ] Invoice aging buckets correct
- [ ] Closed Cases list complete

---

## PHASE 7: ADMIN & POLISH (Week 12)

### Objectives
- Complete user management
- Add system settings
- Polish UI and fix bugs

### Tasks

#### 7.1 User Management
- [ ] Create Users list page
- [ ] Create Add User modal/page
- [ ] Implement user creation (via Edge Function for auth)
- [ ] Create Edit User page
- [ ] Implement permission editing
- [ ] Implement user deactivation
- [ ] Implement user reactivation

#### 7.2 System Settings
- [ ] Create Settings page
- [ ] Allow editing default days (In-Depth, Enforcement, Invoice Due)
- [ ] Allow editing ID prefixes

#### 7.3 Permission Enforcement
- [ ] Verify all RLS policies working
- [ ] Test each role (SUPER_ADMIN, DATA_ENTRY, VIEW_ONLY)
- [ ] Hide UI elements based on permissions
- [ ] Show appropriate error messages for unauthorized actions

#### 7.4 UI Polish
- [ ] Review and fix responsive design
- [ ] Add loading states to all async operations
- [ ] Add error boundaries
- [ ] Improve form validation messages
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add toast notifications for actions

#### 7.5 Bug Fixes & Testing
- [ ] Full end-to-end testing of all flows
- [ ] Cross-browser testing
- [ ] Fix any discovered bugs
- [ ] Performance optimization if needed

### Deliverables
- Complete user management
- System settings
- Polished, production-ready application

### Validation Checklist
- [ ] Can create new users
- [ ] Can edit user roles and permissions
- [ ] Can deactivate/reactivate users
- [ ] System settings persist
- [ ] VIEW_ONLY users cannot edit
- [ ] DATA_ENTRY users limited to permissions
- [ ] SUPER_ADMIN has full access
- [ ] No console errors
- [ ] All flows work end-to-end

---

## DEPLOYMENT

### Pre-Deployment Checklist
- [ ] All phases complete and tested
- [ ] Environment variables configured for production
- [ ] Supabase production project created
- [ ] Production database migrated
- [ ] SMTP configured for production
- [ ] SSL certificate active
- [ ] First SuperAdmin account created

### Deployment Steps
1. Build production frontend: `npm run build`
2. Deploy frontend to hosting (Vercel, Netlify, or self-hosted)
3. Deploy Edge Functions to Supabase
4. Configure scheduled jobs
5. Run smoke tests on production
6. Create user accounts

### Post-Deployment
- [ ] Monitor error logs
- [ ] Verify email delivery
- [ ] Train users on system
- [ ] Document any issues
- [ ] Plan future enhancements

---

## FUTURE ENHANCEMENTS (Post-Launch)

1. **Dashboard** - Visual overview with charts
2. **Batch Operations** - Update multiple cases at once
3. **Advanced Search** - Full-text search across all fields
4. **Audit Log** - Track all user actions
5. **Custom Reports** - User-defined report builder
6. **API Integration** - Connect with external systems
7. **Mobile App** - Native iOS/Android apps
8. **Document Attachments** - File upload capability
9. **Calendar View** - Visual calendar of due dates
10. **Bulk Import** - Import cases from CSV

---

## PROMPTS FOR AI-ASSISTED DEVELOPMENT

When using AI tools to generate code, use prompts structured like:

### Example Prompt Format
```
Context: I'm building an Operations Management Application using:
- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- Supabase for backend (PostgreSQL + Auth)
- React Query for data fetching
- React Hook Form + Zod for forms

Current Phase: [Phase X - Name]

Task: [Specific task description]

Requirements:
- [Requirement 1]
- [Requirement 2]

Database Schema (relevant tables):
[Include relevant table definitions]

Please generate [component/function/etc.] that:
- [Specific instruction 1]
- [Specific instruction 2]
```

### Key Prompts by Phase

**Phase 0 - Supabase Client Setup:**
"Create a Supabase client configuration file for React with TypeScript that exports a configured client and type-safe database functions."

**Phase 1 - Case List:**
"Create a React component for displaying a paginated, filterable list of cases using TanStack Table, with columns for Case ID, Target Name, Brand, Client, Province, Status, and Submitted Date."

**Phase 2 - Upload Modal:**
"Create a modal component for uploading a case to a client, with fields for client selection (OneWorld/AA/SafeMark), upload date, and fee amount. Use React Hook Form with Zod validation."

**Phase 5 - Email Alert:**
"Create a Supabase Edge Function that sends an email notification when a case is approved, using Resend as the email provider."

---

## SUCCESS CRITERIA

The application is considered successfully delivered when:

1. ✅ All phases complete and tested
2. ✅ No missed stage or invoice deadlines (alerts working)
3. ✅ Owner can get status in under one minute
4. ✅ Staff can update cases without using spreadsheets
5. ✅ Reports export cleanly to CSV/Excel/PDF
6. ✅ User access properly controlled by role
7. ✅ System runs reliably without errors

---

**Document End**
