# DAP CaseView Dashboard — Complete System Overview

> **Tech Stack:** React 18 + TypeScript + Vite | Supabase (PostgreSQL) | TanStack React Query | shadcn/ui | Recharts | date-fns | Tailwind CSS
> **Auth:** Supabase Auth (JWT) with role-based access control
> **Hosting:** Static build deployed via FTP with `.htaccess` routing

---

## 1. PURPOSE & DOMAIN

DAP CaseView is an **anti-counterfeiting case management system** used to track intellectual-property enforcement cases from initial reporting through investigation, enforcement, destruction of counterfeit goods, and invoicing. It serves three external clients: **OneWorld**, **A.A Associates**, and **SafeMark**.

The system manages the full lifecycle: case creation → client upload → client decision → investigation → enforcement → destruction → final reporting → invoicing → payment tracking.

---

## 2. USER ROLES & PERMISSIONS

| Role | Description |
|------|-------------|
| **SUPER_ADMIN** | Full access to everything — bypasses all permission checks |
| **DATA_ENTRY** | Can create/edit cases, workflow stages, invoices |
| **VIEW_ONLY** | Read-only access across all modules |

**Granular Permission Object (per user):**
```json
{
  "cases":    { "view": true, "create": false, "edit": false },
  "workflow": { "view": true, "edit": false },
  "invoices": { "view": true, "edit": false },
  "reports":  { "view": true, "export": false },
  "alerts":   { "view": true },
  "admin":    { "users": false, "settings": false }
}
```

---

## 3. DATABASE SCHEMA (14 Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | App users (extends Supabase auth) | email, full_name, role, is_active, permissions (JSONB) |
| **cases** | Core case entity | case_id (unique), target_name, target_category, city, province, brand_name, case_type (Market/Customs), case_status, matter_code |
| **case_uploads** | Upload-to-client records | case_id (FK), client, upload_date, our_fee_usd, decision_status, decision_date |
| **in_depth_stages** | In-depth investigation tracking | case_id (FK), due_date, status (IN_PROGRESS/DONE), status_date |
| **enforcement_stages** | Enforcement tracking | case_id (FK), due_date, status (IN_PROGRESS/DONE), status_date |
| **destruction_stages** | Destruction tracking | case_id (FK), due_date, status (IN_PROGRESS/DONE), status_date |
| **final_reports** | Final report submission tracking | case_id (FK), status (PENDING/DONE), due_date, submission_date |
| **invoices** | Invoice & payment tracking | case_id (FK), invoice_number (unique), issue_date, due_date, amount_usd, status (ISSUED/PAID/NOT_PAID) |
| **alert_logs** | Notification history | alert_type, case_id (FK), recipient_id (FK), email_status, is_read |
| **alert_configurations** | Per-user alert preferences | alert_type, user_id (FK), is_enabled |
| **reminder_logs** | Due-date reminder tracking | reminder_type, case_id (FK), scheduled_date, sent_at |
| **case_notes** | Case discussion/notes | case_id (FK), note_text, author_id (FK) |
| **user_preferences** | User settings (JSONB) | user_id, preference_key, preference_value |
| **system_settings** | Global config | setting_key (unique), setting_value (JSONB) |

**Case Status Enum:** `IN_HAND → UPLOADED → AWAITING_DECISION → APPROVED / REJECTED → IN_DEPTH → ENFORCEMENT → DESTRUCTION → CLOSED`

---

## 4. COMPLETE CASE LIFECYCLE WORKFLOW

```
                        IN_HAND
                           │
                    [Upload to Client]
                    (client, fee USD, matter code)
                           │
                        UPLOADED
                           │
                    [Client Decision]
                      /          \
                REJECTED       APPROVED
                 (END)          /      \
                          MARKET     CUSTOMS
                            │           │
                        IN_DEPTH        │
                      (due: +7d)        │
                            │           │
                        [DONE]          │
                            \          /
                          ENFORCEMENT
                          (due: Market +7d / Customs +15d)
                               │
                            [DONE]
                           /       \
                    DESTRUCTION   Final Report
                   (due: +1d)     (due: +7d, parallel)
                         │              │
                      [DONE]        [Submit]
                         │              │
                       CLOSED        Invoice
                                   (due: client terms)
                                   ISSUED → PAID
```

**Auto-Created Due Dates:**
- Market approved → In-Depth due = decision date + 7 days
- Customs approved → Enforcement due = decision date + 15 days
- In-Depth done → Enforcement due = completion + 7 days
- Enforcement done → Destruction due = completion + 1 day; Final Report due = completion + 7 days
- Final Report submitted → Invoice due = submission date + client payment terms

**Client Payment Terms:**
| Client | Days |
|--------|------|
| OneWorld | 90 days |
| A.A Associates | 90 days |
| SafeMark | 45 days |

---

## 5. MODULES & PAGES

### 5.1 Dashboard (Home Page)
**Route:** `/`

**KPI Cards:**
- Total Cases, In Hand, Uploaded, Approved, Rejected, In-Depth, Enforcement, Destruction, Closed
- Active Cases count
- Total Fee Uploaded, Total Fee Approved
- Total Paid, Total Outstanding, Overdue Count & Amount

**Workflow Health (3 cards):**
- In-Depth: In-Progress / Done / Overdue counts
- Enforcement: In-Progress / Done / Overdue counts
- Destruction: In-Progress / Done / Overdue counts

**Upcoming Deadlines (next 7 days):**
- Pending In-Depth, Enforcement, Destruction counts

**Charts:**
- Case Status Distribution (Pie)
- Monthly Trend — last 6 months (cases created vs. closed)
- Invoice Aging Distribution
- Client Performance breakdown
- By City breakdown

**Features:**
- Drag-to-reorder dashboard cards (persisted per user)
- Date range selector: Current Month, Quarter, Year, Custom

---

### 5.2 Cases Module
**Routes:** `/all-cases`, `/new-case`, `/cases/:id`, `/cases/:id/edit`, `/in-hand`, `/uploaded`, `/awaiting-decision`, `/approved`, `/rejected`, `/closed`

#### Case List (`/all-cases` and status-filtered views)
- Tabular listing with columns: Case ID, Matter Code, Brand, Target, City, Province, Client, Status, Reported Date, etc.
- Multi-status filtering, search (case ID, brand, target, client)
- Sortable columns, pagination
- Inline actions: Edit, Delete, Change Reporter
- Bulk actions: Import from Excel, Record Decision, Change Reporter
- Export: CSV, Excel, PDF

#### New Case Form (`/new-case`)
- Fields: Client, Brand (searchable combobox with 35+ brands), Target Name, Target Category, Target Address, City, Province (Pakistani provinces: Sindh, Punjab, KPK, Balochistan, Islamabad, AJK), Case Type (Market/Customs), Products, Reporter, Date
- Auto-generates Matter Code: `BRAND.TYPE.NNN/CLIENT-YY`
- Zod validation

#### Case Detail (`/cases/:id`)
**Tabbed interface with 7 sections:**

1. **Case Overview** — Basic info, status, inline editable fields (matter code, target, brand, location, products, case type, reporter)
2. **Client Upload** — Upload status, client, fee, decision status/date; Upload to Client action
3. **In-Depth Stage** — Status, due date, completion date; Update Workflow action
4. **Enforcement Stage** — Status, due date, completion date; Update Workflow action
5. **Final Report** — Status, due date, submission date; Submit Final Report action
6. **Destruction Stage** — Status, due date, completion date; Update Workflow action
7. **Invoices** — Invoice details, status, amount, dates; Send Invoice / Update Status actions

**All fields support inline editing** with real-time save to database.

#### Edit Case Form (`/cases/:id/edit`)
- Pre-populated form, same structure as New Case
- Updates existing record

---

### 5.3 Workflow Module
**Routes:** `/in-depth`, `/enforcement`, `/destruction`

Each route shows a **stage-specific list view** of cases at that workflow stage:
- Case filtering and search
- Status tracking (IN_PROGRESS / DONE)
- Due date monitoring with overdue highlighting
- Change reporter assignment
- Delete workflow records
- Update workflow status via modal

---

### 5.4 Invoices Module
**Routes:** `/all-invoices`, `/invoices-issued`, `/invoices-paid`, `/invoices-over-due`

- Tabular listing: Invoice #, Issue Date, Due Date, Amount (USD), Status, Days to Due/Overdue, Associated Case, Client, Brand
- Auto-generated invoice numbers: `INV-BRAND.TYPE.NN/CLIENT-YY`
- Status filtering: ISSUED, PAID, NOT_PAID, OVERDUE
- Search by invoice number or case details
- Sortable, paginated
- Actions: View, Mark as Paid, Delete
- Export: CSV, Excel, PDF

---

### 5.5 Reports Module

#### Finance Reports (R24–R29) — `/finance`

| Report | Name | Description |
|--------|------|-------------|
| R24 | Not Paid Invoices | Outstanding invoices with aging buckets, days to due, overdue highlighting |
| R25 | Paid Invoices | Historical paid invoices with payment dates |
| R26–R29 | Finance Dashboard | KPI cards (Total Issued, Collected, Outstanding, Collection Rate), Monthly Revenue trend chart, Revenue by Client/Brand/Province, Invoice Aging distribution |

**Aging Bucket System (8 buckets):**
- DUE_15: 8–15 days away
- DUE_7: 1–7 days away
- DUE_TODAY: Due today
- OVR_1_15: 1–15 days overdue
- OVR_16_30: 16–30 days overdue
- OVR_31_45: 31–45 days overdue
- OVR_46_60: 46–60 days overdue
- OVR_60PLUS: 60+ days overdue

#### Client Reports (R30–R35) — `/client-reports`
Requires client selection (OneWorld, A.A Associates, SafeMark). **Excel + PDF export only (no CSV).**

| Report | Name | Description |
|--------|------|-------------|
| R30 | All Submitted Cases | Complete case list per client |
| R31 | Approved Cases Summary | Approved cases filtered by decision date |
| R32 | Rejected Cases Summary | Rejected cases |
| R33 | Active Case Status | Non-closed cases with all stage statuses |
| R34 | Enforcement Completed | Cases where enforcement is DONE |
| R35 | Invoice & Payment Details | Per-client invoice list with KPI summaries |

#### Pending Work Reports (R36–R42) — `/pending-work/*`

| Report | Route | Description |
|--------|-------|-------------|
| R36 | `/pending-work/upload` | Cases in IN_HAND awaiting upload to client |
| R37 | `/pending-work/decision` | Uploaded cases awaiting client decision |
| R38 | `/pending-work/in-depth` | Approved cases with pending in-depth investigation |
| R39 | `/pending-work/enforcement` | Cases with pending enforcement |
| R40 | `/pending-work/final-report` | Enforcement done, final report not submitted |
| R41 | `/pending-work/invoices` | Final report sent, invoice not yet issued |
| R42 | `/pending-work/destruction` | Enforcement done, destruction pending |

**Pending Work Hub** (`/pending-work`): Card-based dashboard showing count of pending items per stage with links to each detailed report.

All pending work reports feature: column selector with drag-to-reorder, search, pagination (10 rows/page), CSV/Excel/PDF export, due date color coding (Red=Overdue, Amber=Due Today, Orange=Due 2 days, Blue=Due 15 days).

R36–R42 display a **weekly email badge** (visual indicator for scheduled weekly email reports).

#### Custom Report Builder (R43–R47) — `/custom-report`

Ad-hoc report tool with selectable fields across all categories:
- Case Identity, Target/Raid Info, Brand & Client, Decision, In-Depth Stage, Enforcement Stage, Final Report, Destruction Stage, Invoice
- Column selection, ordering, visibility toggling
- Filtering, sorting, pagination
- Export: CSV, Excel, PDF (visible columns only)
- Preferences saved to localStorage

---

### 5.6 Alerts & Reminders Module
**Route:** `/alerts-reminders`

**Real-time Alert Types:**
| Category | Alerts |
|----------|--------|
| Case Updates | CASE_APPROVED, CASE_REJECTED |
| Workflow | IN_DEPTH_DONE, IN_DEPTH_DATE_CHANGED, ENFORCEMENT_DONE, ENFORCEMENT_DATE_CHANGED, DESTRUCTION_DONE |
| Reports | FINAL_REPORT_SUBMITTED |
| Invoicing | INVOICE_ISSUED, INVOICE_PAID, INVOICE_OVERDUE |

**Due Date Reminders:** IN_DEPTH_DUE, ENFORCEMENT_DUE, INVOICE_DUE

**Features:**
- Toggle individual alert types on/off per user
- Email notification settings
- Alert history with timestamps
- Mark single/all as read
- Header bell icon with unread count (polls every 30 seconds)

**Weekly Email Reports (scheduled):**
- Pending Upload, Pending Decision, Pending In-Depth, Pending Enforcement, Pending Final Report, Pending Invoices, Pending Destruction

---

### 5.7 Admin Module (SUPER_ADMIN only)

#### User Management (`/users`)
- List all users with role/status
- Create new user (modal)
- Edit user details, role assignment
- Manage granular permissions
- Activate/Deactivate users
- Reset password, Delete user

#### System Settings (`/settings`)
- Configurable system parameters
- Logo/branding upload
- Form-based configuration interface

---

## 6. KEY FEATURES & CAPABILITIES

### 6.1 Inline Editing
All case detail fields support click-to-edit with real-time persistence:
- Text fields, date pickers, dropdowns, comboboxes
- Province/City paired selector (Pakistani locations)
- Duplicate validation for matter codes and invoice numbers

### 6.2 Bulk Import
- Import cases from Excel files (.xlsx/.xls)
- Maps 80+ column header variants
- Batch insert with error reporting (success/failure counts)
- Supports re-importing previously exported data

### 6.3 Export System
| Format | Library | Features |
|--------|---------|----------|
| CSV | PapaParse (lazy-loaded) | Visible columns only, formula injection protection |
| Excel | XLSX (lazy-loaded) | Visible columns only, formula injection protection |
| PDF | jsPDF + AutoTable (lazy-loaded) | Title, timestamp, styled table with striped rows |

**WYSE Principle:** Export shows exactly what's visible on screen (columns and order).

### 6.4 Auto-Generated Codes
- **Matter Code:** `BRAND.TYPE.NNN/CLIENT-YY` (global serial per year, 35+ brand abbreviations)
- **Invoice Number:** `INV-BRAND.TYPE.NN/CLIENT-YY` (per-brand serial)
- Duplicate detection before save

### 6.5 Security
- SQL injection prevention (`escapeLikePattern`)
- Error message sanitization (strips DB details)
- File validation (images: JPEG/PNG/WebP/GIF ≤5MB; Excel: XLSX/XLS ≤10MB)
- Export formula injection protection (blocks `=`, `+`, `-`, `@` prefixes)

### 6.6 Dark Theme
- Full dark/light theme toggle
- Glass-morphism cards with backdrop blur
- Persistent preference via localStorage

### 6.7 Responsive Design
- Mobile detection hook (breakpoint: 768px)
- Collapsible sidebar (56px collapsed / 220px expanded)
- Hover tooltips when sidebar collapsed

---

## 7. NAVIGATION STRUCTURE (Sidebar)

```
├── Dashboard                    /
├── Pending Work                 /pending-work
├── Cases (collapsible)
│   ├── All Cases                /all-cases
│   ├── New Case                 /new-case
│   ├── In-Hand                  /in-hand
│   ├── Uploaded                 /uploaded
│   ├── Awaiting Decision        /awaiting-decision
│   ├── Approved                 /approved
│   ├── Rejected                 /rejected
│   └── Closed                   /closed
├── Workflow (collapsible)
│   ├── In-Depth                 /in-depth
│   ├── Enforcement              /enforcement
│   └── Destruction              /destruction
├── Invoices (collapsible)
│   ├── All Invoices             /all-invoices
│   ├── Invoices Issued          /invoices-issued
│   ├── Invoices Paid            /invoices-paid
│   └── Invoices Over Due        /invoices-over-due
├── Reports (collapsible)
│   ├── Finance                  /finance
│   ├── Client Reports           /client-reports
│   ├── Pending Work             /pending-work
│   └── Custom Report            /custom-report
├── Alerts & Reminders           /alerts-reminders
└── Admin (collapsible, admin only)
    ├── Users                    /users
    └── Settings                 /settings
```

---

## 8. REPORT ID REFERENCE

| ID Range | Module | Status |
|----------|--------|--------|
| R01–R10 | Management Reports | Reserved / Not implemented |
| R11–R17 | Reporting Dept Reports | Reserved / Not implemented |
| R18–R23 | Investigation Reports | Reserved / Not implemented |
| R24–R29 | Finance Reports | ✅ Implemented |
| R30–R35 | Client Reports | ✅ Implemented |
| R36–R42 | Pending Work Reports | ✅ Implemented |
| R43–R47 | Custom Report Builder | ✅ Implemented |

**Note:** R01–R23 were originally planned but the report pages (ManagementReport, ReportingDeptReport, InvestigationReport) may have been removed or consolidated. The routes `/management`, `/reporting-dept`, and `/investigation` are not currently in the router.

---

## 9. BUSINESS RULES SUMMARY

1. **Customs cases skip In-Depth** — go straight to Enforcement after approval
2. **Each stage auto-creates the next** with calculated due dates
3. **Final Report is independent** — doesn't block case closure (parallel track)
4. **Only Destruction completion closes a case**
5. **Invoice due dates depend on client payment terms**, not workflow dates
6. **Matter codes and invoice numbers are auto-generated** with duplicate detection
7. **Overdue invoices are auto-detected** based on due date vs. current date
8. **Province data is Pakistan-specific**: Sindh, Punjab, KPK, Balochistan, Islamabad, AJK
9. **Three clients supported**: OneWorld (90d terms), A.A Associates (90d terms), SafeMark (45d terms)

---

## 10. WHAT'S NOT YET BUILT (Gaps / Expansion Opportunities)

1. **Reports R01–R23** — Management, Reporting Dept, and Investigation reports are reserved but not implemented
2. **Email delivery service** — Alert system tracks alerts in DB but no frontend email integration (likely handled by Supabase Edge Functions or external service)
3. **Document/file attachments** — No document upload/storage for case evidence
4. **Audit trail / activity log** — No change history tracking for cases
5. **Multi-language support** — English only
6. **Advanced analytics / BI dashboards** — Basic charts exist, no drill-down or trend analysis
7. **Client portal** — No external-facing client access
8. **API integrations** — No third-party system integrations
9. **Bulk operations** — Limited bulk actions (import exists, but no bulk status updates, bulk delete, etc.)
10. **Search across all modules** — Header search exists but scope is limited
11. **Mobile app** — Responsive web only, no native mobile
12. **Scheduled automated reports** — Weekly email badge is visual only; actual email scheduling may need backend work
