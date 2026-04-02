# Operations Management Application
# UI/UX Screen Descriptions & Wireframes
# Version 1.0

---

## 1. GLOBAL LAYOUT

### 1.1 Application Shell
```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                         │
│  [Logo] Operations Manager    [Search...]    [🔔] [User ▼]      │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                    │
│  SIDEBAR   │  MAIN CONTENT AREA                                 │
│            │                                                    │
│  Dashboard │  [Page Title]                   [Action Buttons]   │
│  Cases ▼   │  ─────────────────────────────────────────────     │
│  Workflow ▼│                                                    │
│  Invoices ▼│  [Filters Bar]                                     │
│  Reports ▼ │                                                    │
│  Alerts    │  [Data Table / Content]                            │
│  Admin ▼   │                                                    │
│            │                                                    │
│            │                                                    │
│            │  ─────────────────────────────────────────────     │
│            │  [Pagination]                                      │
└────────────┴────────────────────────────────────────────────────┘
```

### 1.2 Header Components
- **Logo/App Name**: "Operations Manager" - links to Dashboard
- **Global Search**: Search cases by ID, target name, brand name
- **Notification Bell**: Shows count of unread alerts
- **User Menu**: 
  - Dropdown showing: User name, role
  - Options: Profile, Settings (if admin), Sign Out

### 1.3 Sidebar Navigation
Collapsible navigation with icons and labels:

```
📊 Dashboard

📁 Cases
   └─ All Cases
   └─ New Case
   └─ In-Hand
   └─ Uploaded
   └─ Approved
   └─ Rejected

⚙️ Workflow
   └─ In-Depth
   └─ Enforcement
   └─ Destruction

💰 Invoices
   └─ All Invoices
   └─ Not Paid
   └─ Paid

📈 Reports
   └─ Operational
   └─ By Client
   └─ By Province
   └─ Workflow
   └─ Financial

🔔 Alerts & Reminders

⚡ Admin (SuperAdmin only)
   └─ Users
   └─ Settings
```

**Visibility Rules:**
- VIEW_ONLY: Sees only areas they have permission for
- DATA_ENTRY: Sees all operational areas
- SUPER_ADMIN: Sees everything including Admin

---

## 2. AUTHENTICATION SCREENS

### 2.1 Login Page
```
┌─────────────────────────────────────────────────┐
│                                                 │
│           [Logo]                                │
│     Operations Management                       │
│                                                 │
│     ┌─────────────────────────────────┐        │
│     │  Email                          │        │
│     │  [________________________]     │        │
│     │                                 │        │
│     │  Password                       │        │
│     │  [________________________]     │        │
│     │                                 │        │
│     │  [        Sign In         ]     │        │
│     │                                 │        │
│     │  Forgot password?               │        │
│     └─────────────────────────────────┘        │
│                                                 │
│     Note: Contact admin for account access      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- No "Sign Up" link (accounts created by admin only)
- Show error for invalid credentials
- Redirect to Dashboard on success
- "Forgot password?" sends reset email

### 2.2 Password Reset
```
┌─────────────────────────────────────────────────┐
│                                                 │
│           Reset Password                        │
│                                                 │
│     Enter your email to receive a reset link    │
│                                                 │
│     Email                                       │
│     [_________________________________]         │
│                                                 │
│     [      Send Reset Link          ]           │
│                                                 │
│     ← Back to Login                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 3. DASHBOARD (Future Enhancement)

### 3.1 Dashboard Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ In-Hand  │ │ Uploaded │ │ Approved │ │  Closed  │       │
│  │    24    │ │    12    │ │    45    │ │   128    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  ┌────────────────────────┐ ┌────────────────────────┐     │
│  │  Due This Week         │ │  Overdue Invoices      │     │
│  │  ────────────────────  │ │  ────────────────────  │     │
│  │  In-Depth: 3           │ │  Total: $12,500        │     │
│  │  Enforcement: 5        │ │  Count: 8              │     │
│  │  Destruction: 2        │ │                        │     │
│  └────────────────────────┘ └────────────────────────┘     │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Recent Activity                                  │      │
│  │  ──────────────────────────────────────────────  │      │
│  │  • CASE-2024-0089 approved by OneWorld (2h ago)  │      │
│  │  • Invoice INV-2024-0045 marked as Paid (4h ago) │      │
│  │  • CASE-2024-0090 created (yesterday)            │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. CASE MANAGEMENT SCREENS

### 4.1 Case List (All Cases)
```
┌─────────────────────────────────────────────────────────────────┐
│  All Cases                                    [+ New Case]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters: [Status ▼] [Client ▼] [Brand ▼] [Province ▼]         │
│           [Date From] [Date To]  [🔍 Search...]  [Clear]       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Showing 1-20 of 156 cases            [Export: CSV | Excel | PDF]│
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Case ID    │ Target    │ Brand   │ Client │ Status │ Date│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ CASE-2024- │ Target    │ BrandX  │ ONE... │ ●APPR  │ Jan │   │
│  │ 0089       │ Corp      │         │        │        │ 15  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ CASE-2024- │ ABC Inc   │ BrandY  │ AA     │ ○UPLD  │ Jan │   │
│  │ 0088       │           │         │        │        │ 14  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ CASE-2024- │ XYZ Ltd   │ BrandX  │ SAFE.. │ ○HAND  │ Jan │   │
│  │ 0087       │           │         │        │        │ 13  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [← Prev]  Page 1 of 8  [Next →]                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Table Columns:**
- Case ID (clickable → opens case detail)
- Target Name
- Brand Name
- Client
- Province
- Status (color-coded badge)
- Submitted Date

**Status Badges:**
- IN_HAND: Gray
- UPLOADED: Blue
- APPROVED: Green
- REJECTED: Red
- CLOSED: Purple

### 4.2 New Case Form
```
┌─────────────────────────────────────────────────────────────────┐
│  New Case                                      [Cancel] [Save]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CASE INFORMATION                                        │   │
│  │  ───────────────────────────────────────────────────     │   │
│  │                                                          │   │
│  │  Target Name *              Target Category *            │   │
│  │  [______________________]   [______________________]     │   │
│  │                                                          │   │
│  │  Target Address *                                        │   │
│  │  [__________________________________________________]   │   │
│  │                                                          │   │
│  │  City *                     Province *                   │   │
│  │  [______________________]   [▼ Select Province    ]     │   │
│  │                                                          │   │
│  │  ───────────────────────────────────────────────────     │   │
│  │  BRAND & PRODUCT                                         │   │
│  │  ───────────────────────────────────────────────────     │   │
│  │                                                          │   │
│  │  Brand Name *               Products Name *              │   │
│  │  [______________________]   [______________________]     │   │
│  │                                                          │   │
│  │  ───────────────────────────────────────────────────     │   │
│  │  SUBMISSION DETAILS                                      │   │
│  │  ───────────────────────────────────────────────────     │   │
│  │                                                          │   │
│  │  Case Submitted Date *      Case Submitted By *          │   │
│  │  [📅 ________________]     [______________________]     │   │
│  │                                                          │   │
│  │  Notes/Description (optional)                            │   │
│  │  [__________________________________________________]   │   │
│  │  [__________________________________________________]   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Validation:**
- All fields marked * are required
- Date picker for date fields
- Province dropdown with common provinces

### 4.3 Case Detail View
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Cases    CASE-2024-0089            [Edit] [Actions▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────┐ ┌──────────────────────┐ │
│  │  Status: ● APPROVED              │ │  Client: OneWorld    │ │
│  │  Created: Jan 15, 2024           │ │  Fee: $1,500.00      │ │
│  └──────────────────────────────────┘ └──────────────────────┘ │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  WORKFLOW PROGRESS                                              │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  [●]──────[●]──────[●]──────[○]──────[○]──────[○]──────[○]     │
│  Upload  Decision In-Depth Enforce  Report  Invoice Destruct   │
│  ✓Done   ✓Done    ✓Done    In Prog  Pending Pending Pending   │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  [Tab: Details] [Tab: Workflow] [Tab: Invoice] [Tab: Notes]    │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TARGET INFORMATION                                      │   │
│  │                                                          │   │
│  │  Target Name:    Target Corp                             │   │
│  │  Category:       Retail                                  │   │
│  │  Address:        123 Main Street, Unit 5                 │   │
│  │  City:           Toronto                                 │   │
│  │  Province:       Ontario                                 │   │
│  │                                                          │   │
│  │  BRAND & PRODUCT                                         │   │
│  │                                                          │   │
│  │  Brand:          BrandX                                  │   │
│  │  Products:       Product A, Product B                    │   │
│  │                                                          │   │
│  │  SUBMISSION                                              │   │
│  │                                                          │   │
│  │  Submitted:      Jan 15, 2024                            │   │
│  │  Submitted By:   John Smith                              │   │
│  │  Notes:          Initial investigation request           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Case Detail - Workflow Tab
```
┌─────────────────────────────────────────────────────────────────┐
│  [Tab: Details] [Tab: Workflow ●] [Tab: Invoice] [Tab: Notes]  │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  UPLOAD TO CLIENT                           ✓ COMPLETE   │   │
│  │  ─────────────────────────────────────────              │   │
│  │  Client: OneWorld    Date: Jan 18, 2024                 │   │
│  │  Our Fee: $1,500.00                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CLIENT DECISION                            ✓ APPROVED   │   │
│  │  ─────────────────────────────────────────              │   │
│  │  Status: Approved    Date: Jan 20, 2024                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IN-DEPTH                                   ✓ DONE       │   │
│  │  ─────────────────────────────────────────  [Edit]      │   │
│  │  Target Date: Jan 27, 2024                              │   │
│  │  Status: Done    Completed: Jan 26, 2024                │   │
│  │  Notes: Completed ahead of schedule                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ENFORCEMENT                              ○ IN PROGRESS  │   │
│  │  ─────────────────────────────────────────  [Edit]      │   │
│  │  Target Date: Feb 3, 2024    ⚠️ Due in 2 days           │   │
│  │  Status: In Progress                                    │   │
│  │  [Mark as Done]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  FINAL REPORT                              ○ PENDING     │   │
│  │  ─────────────────────────────────────────              │   │
│  │  [Record Submission]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Case Detail - Invoice Tab
```
┌─────────────────────────────────────────────────────────────────┐
│  [Tab: Details] [Tab: Workflow] [Tab: Invoice ●] [Tab: Notes]  │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  INVOICE DETAILS                                         │   │
│  │  ─────────────────────────────────────────              │   │
│  │                                                          │   │
│  │  Invoice Number:   INV-2024-0045                        │   │
│  │  Amount:           $1,500.00 (from upload fee)          │   │
│  │                                                          │   │
│  │  Issue Date:       Feb 5, 2024                          │   │
│  │  Due Date:         Apr 5, 2024                          │   │
│  │                                                          │   │
│  │  Status:           ○ ISSUED                             │   │
│  │                    [Mark as Paid] [Mark as Not Paid]    │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ── OR if no invoice yet ──                                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  No invoice created yet.                                 │   │
│  │  [Create Invoice]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Case Detail - Notes Tab
```
┌─────────────────────────────────────────────────────────────────┐
│  [Tab: Details] [Tab: Workflow] [Tab: Invoice] [Tab: Notes ●]  │
│  ───────────────────────────────────────────────────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Add Note:                                               │   │
│  │  [__________________________________________________]   │   │
│  │  [__________________________________________________]   │   │
│  │                                        [Add Note]       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  John Smith • Jan 22, 2024 at 2:30 PM                   │   │
│  │  ─────────────────────────────────────────              │   │
│  │  Received additional documents from client.             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Jane Doe • Jan 20, 2024 at 10:15 AM                    │   │
│  │  ─────────────────────────────────────────              │   │
│  │  Case approved by OneWorld. Proceeding to In-Depth.     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. WORKFLOW SCREENS

### 5.1 In-Depth List
```
┌─────────────────────────────────────────────────────────────────┐
│  In-Depth Stages                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tab: In Progress (8)] [Tab: Done (45)]                       │
│                                                                 │
│  Filters: [Client ▼] [Brand ▼] [Province ▼] [Date Range]       │
│           [🔍 Search...]  [Clear Filters]                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                 [Export ▼]      │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │Case ID  │Target   │Client│Brand │Target Date│Status│Fee │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │CASE-    │Target   │ONE   │BrandX│⚠️ Jan 25 │In    │$1.5K│   │
│  │2024-0085│Corp     │      │      │(overdue)  │Prog  │     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │CASE-    │ABC Inc  │AA    │BrandY│Jan 28     │In    │$2.0K│   │
│  │2024-0086│         │      │      │(in 3 days)│Prog  │     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Default sort: Target Date (earliest first)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Visual Indicators:**
- ⚠️ Red: Overdue
- 🟡 Yellow: Due within 2 days
- 🟢 Green: On track

### 5.2 Enforcement & Destruction Lists
Same layout as In-Depth, with appropriate columns and filters.

---

## 6. INVOICE SCREENS

### 6.1 Invoice List
```
┌─────────────────────────────────────────────────────────────────┐
│  Invoices                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tab: All] [Tab: Not Paid (12)] [Tab: Paid (89)]              │
│                                                                 │
│  Filters: [Client ▼] [Brand ▼] [Status ▼] [Due Date Range]     │
│           [🔍 Search...]  [Clear Filters]                      │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Summary: Total Outstanding: $45,000  |  Overdue: $12,500       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │Invoice # │Case ID  │Client│Amount │Due Date  │Status   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │INV-2024- │CASE-    │ONE   │$1,500 │⚠️Apr 5  │NOT PAID │   │
│  │0045      │2024-0089│      │       │(overdue) │         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │INV-2024- │CASE-    │AA    │$2,000 │Apr 20    │ISSUED   │   │
│  │0046      │2024-0090│      │       │(15 days) │         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Default sort: Due Date (earliest first)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. REPORTS SCREENS

### 7.1 Reports Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  Reports                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐ ┌───────────────────┐                   │
│  │  📊 Operational   │ │  🏢 By Client     │                   │
│  │  ───────────────  │ │  ───────────────  │                   │
│  │  • All Cases      │ │  • OneWorld       │                   │
│  │  • In-Hand        │ │  • AA             │                   │
│  │  • Uploaded       │ │  • SafeMark       │                   │
│  │  • Approved       │ │                   │                   │
│  │  • Rejected       │ │                   │                   │
│  │  • Closed         │ │                   │                   │
│  └───────────────────┘ └───────────────────┘                   │
│                                                                 │
│  ┌───────────────────┐ ┌───────────────────┐                   │
│  │  🗺️ By Province   │ │  ⚙️ Workflow      │                   │
│  │  ───────────────  │ │  ───────────────  │                   │
│  │  • Province List  │ │  • In-Depth       │                   │
│  │  • Approved       │ │  • Enforcement    │                   │
│  │  • Rejected       │ │  • Destruction    │                   │
│  └───────────────────┘ └───────────────────┘                   │
│                                                                 │
│  ┌───────────────────┐                                         │
│  │  💰 Financial     │                                         │
│  │  ───────────────  │                                         │
│  │  • Summary        │                                         │
│  │  • Invoice Aging  │                                         │
│  │  • Outstanding    │                                         │
│  └───────────────────┘                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Financial Summary Report
```
┌─────────────────────────────────────────────────────────────────┐
│  Financial Summary                              [Export ▼]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Filters: [Client ▼] [Brand ▼] [Province ▼]                    │
│           [Date From] [Date To]  [Apply]                       │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  BY CLIENT                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        │ Cases │ Approved │ Fee Uploaded │ Fee Paid │Out│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │OneWorld│   45  │    38    │   $68,000    │ $52,000  │$16K│   │
│  │AA      │   32  │    28    │   $48,000    │ $40,000  │$8K │   │
│  │SafeMark│   28  │    22    │   $42,000    │ $35,000  │$7K │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │TOTAL   │  105  │    88    │  $158,000    │$127,000  │$31K│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  INVOICE AGING                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │Not Yet Due │Due Today│1-15 Days│16-30 Days│31-60│>60   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  $18,000   │  $2,500 │  $5,000 │  $3,000  │$2K  │$500  │   │
│  │  (12)      │   (2)   │   (4)   │   (2)    │ (1) │ (1)  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. ADMIN SCREENS

### 8.1 User Management
```
┌─────────────────────────────────────────────────────────────────┐
│  User Management                              [+ Add User]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tab: Active (8)] [Tab: Inactive (2)]                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │Name          │Email              │Role       │Actions   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │John Smith    │john@company.com   │Super Admin│[Edit]    │   │
│  │Jane Doe      │jane@company.com   │Data Entry │[Edit][⏸]│   │
│  │Bob Wilson    │bob@company.com    │View Only  │[Edit][⏸]│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Add/Edit User
```
┌─────────────────────────────────────────────────────────────────┐
│  Add New User                                  [Cancel] [Save]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Full Name *                    Email *                         │
│  [________________________]     [________________________]     │
│                                                                 │
│  Role *                         Temporary Password *            │
│  [▼ Select Role          ]     [________________________]     │
│                                                                 │
│  ─────────────────────────────────────────────────────────     │
│  PERMISSIONS                                                    │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  Cases                          Workflow                        │
│  ☑ View  ☑ Create  ☐ Edit      ☑ View  ☐ Edit                  │
│                                                                 │
│  Invoices                       Reports                         │
│  ☑ View  ☐ Edit                 ☑ View  ☐ Export                │
│                                                                 │
│  Admin                                                          │
│  ☐ Manage Users  ☐ System Settings                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. ALERTS & REMINDERS SCREEN

### 9.1 Alerts Configuration
```
┌─────────────────────────────────────────────────────────────────┐
│  Alerts & Reminders                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Tab: Alert Settings] [Tab: Reminder Settings] [Tab: History] │
│                                                                 │
│  ─────────────────────────────────────────────────────────     │
│  Configure who receives each type of alert                      │
│  ─────────────────────────────────────────────────────────     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Alert Type              │ Recipients                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Case Approved           │ [John, Jane ▼]       [Edit]  │   │
│  │ Case Rejected           │ [John, Jane ▼]       [Edit]  │   │
│  │ In-Depth Done           │ [Jane, Bob ▼]        [Edit]  │   │
│  │ Enforcement Done        │ [Jane, Bob ▼]        [Edit]  │   │
│  │ Invoice Issued          │ [John ▼]             [Edit]  │   │
│  │ Invoice Overdue         │ [John ▼]             [Edit]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. MODALS & DIALOGS

### 10.1 Upload to Client Modal
```
┌─────────────────────────────────────────┐
│  Upload to Client               [×]     │
├─────────────────────────────────────────┤
│                                         │
│  Client *                               │
│  ○ OneWorld                             │
│  ○ AA                                   │
│  ○ SafeMark                             │
│                                         │
│  Upload Date *                          │
│  [📅 ___________________]               │
│                                         │
│  Our Fee (USD) *                        │
│  [$ ___________________]                │
│                                         │
│           [Cancel]  [Upload]            │
│                                         │
└─────────────────────────────────────────┘
```

### 10.2 Record Decision Modal
```
┌─────────────────────────────────────────┐
│  Record Client Decision         [×]     │
├─────────────────────────────────────────┤
│                                         │
│  Decision *                             │
│  ○ Approved                             │
│  ○ Rejected                             │
│                                         │
│  Decision Date *                        │
│  [📅 ___________________]               │
│                                         │
│           [Cancel]  [Save]              │
│                                         │
└─────────────────────────────────────────┘
```

### 10.3 Confirmation Dialog
```
┌─────────────────────────────────────────┐
│  Confirm Action                 [×]     │
├─────────────────────────────────────────┤
│                                         │
│  Are you sure you want to mark this     │
│  destruction stage as complete?         │
│                                         │
│  This will automatically close the      │
│  case.                                  │
│                                         │
│           [Cancel]  [Confirm]           │
│                                         │
└─────────────────────────────────────────┘
```

---

## 11. RESPONSIVE DESIGN NOTES

### Desktop (1280px+)
- Full sidebar visible
- All columns in tables
- Side-by-side forms

### Tablet (768px - 1279px)
- Collapsible sidebar
- Reduced table columns (hide less important)
- Stacked form fields

### Mobile (< 768px)
- Bottom navigation or hamburger menu
- Card-based lists instead of tables
- Single column forms
- View-only functionality (no editing)

---

## 12. COLOR SCHEME

### Primary Colors
- Primary Blue: #1F4E79
- Secondary Blue: #2E75B6
- Accent: #4CAF50

### Status Colors
- Success (Approved/Paid/Done): #4CAF50
- Warning (Pending/Due Soon): #FF9800
- Error (Rejected/Overdue): #F44336
- Info (Uploaded/In Progress): #2196F3
- Neutral (In-Hand): #9E9E9E
- Closed: #9C27B0

### Background
- Page Background: #F5F7FA
- Card Background: #FFFFFF
- Table Header: #D9E2F3

---

## 13. COMPONENT LIBRARY RECOMMENDATIONS

- **UI Framework**: shadcn/ui or Radix UI primitives
- **Tables**: TanStack Table (React Table)
- **Forms**: React Hook Form + Zod
- **Date Picker**: react-day-picker
- **Charts** (for dashboard): Recharts
- **Icons**: Lucide React
- **Toast Notifications**: Sonner or React Hot Toast
