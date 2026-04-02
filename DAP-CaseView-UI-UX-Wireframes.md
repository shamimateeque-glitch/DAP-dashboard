# DAP CaseView Dashboard — Complete UI/UX Wireframes

This document captures the full visual architecture, layout patterns, component library, and design tokens used in the DAP CaseView Dashboard. Use this as a blueprint to replicate the same UI/UX in a separate system.

---

## 1. GLOBAL LAYOUT STRUCTURE

```
+------------------------------------------------------------------+
| BROWSER VIEWPORT (100vw x 100vh)                                 |
|                                                                  |
| +----------+---------------------------------------------------+ |
| | SIDEBAR  | HEADER BAR (h-16 / 64px, sticky top-0, z-30)     | |
| | 56px     | +--------------------------------------+--------+| |
| | collapsed| | Page Title (left)                    | Search  || |
| | 220px    | | "DAP CaseView - {page}"              | Theme   || |
| | expanded | |                                      | Bell    || |
| |          | |                                      | Avatar  || |
| | border-r | +--------------------------------------+--------+| |
| |          |                                                   | |
| |          | MAIN CONTENT AREA                                 | |
| |          | (flex-1, overflow-y-auto)                          | |
| |          | +-----------------------------------------------+ | |
| |          | | max-w-7xl (1280px), mx-auto                    | | |
| |          | | p-4 on mobile, p-6 on desktop (lg:p-6)        | | |
| |          | |                                               | | |
| |          | |  <Outlet /> (routed page content)              | | |
| |          | |                                               | | |
| |          | +-----------------------------------------------+ | |
| +----------+---------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Key measurements:**
- Sidebar collapsed: 56px | expanded: 220px (animated 200ms ease-in-out)
- Header: 64px fixed height, `bg-card border-b`
- Content: max-width 1280px, centered, responsive padding
- Full viewport height: `h-screen`, no page scroll (content area scrolls independently)

---

## 2. SIDEBAR WIREFRAME

```
+--------------------+
| LOGO AREA (h-16)   |  px-4 expanded / px-1 collapsed
| [Logo + App Name]  |  animated width transition
+--------------------+
|                    |
| NAV ITEMS          |  py-3 px-2 space-y-1
| (scrollable)       |
|                    |
| [icon] Dashboard   |  Single item (NavLink)
|                    |
| [icon] Cases    [v]|  Expandable (Button toggle)
|   All Cases        |    pl-11 pr-3 py-1.5
|   In Hand          |    text-sm text-muted-foreground
|   Uploaded         |
|   Approved         |
|   Rejected         |
|   Closed           |
|   + New Case       |
|                    |
| [icon] Workflow [v]|  Expandable
|   In-Depth         |
|   Enforcement      |
|   Destruction      |
|                    |
| [icon] Invoices [v]|  Expandable
|   All Invoices     |
|   Invoices Due     |
|   Invoices Issued  |
|   Invoices Paid    |
|                    |
| [icon] Reports  [v]|  Expandable
|   Finance          |
|   Client Reports   |
|   Pending Work     |
|   Custom Report    |
|                    |
| [icon] Alerts      |  Single item
|                    |
| [icon] Admin    [v]|  Expandable (SUPER_ADMIN only)
|   Users            |
|   Settings         |
|                    |
+--------------------+
| [<>] Collapse Btn  |  p-2 border-t
+--------------------+
```

**States:**
- Active item: `bg-primary/10 text-primary font-medium`
- Hover: `hover:bg-sidebar-accent hover:text-primary`
- Submenu: height animation 0 -> auto (150ms), chevron rotates 180deg
- Collapsed: shows tooltip on hover (glassmorphic style)
- Permission-filtered: items hidden based on user role

---

## 3. HEADER BAR WIREFRAME

```
+------------------------------------------------------------------------+
| Page Title                              [Search]  [Sun] [Bell] | Avatar |
| "DAP CaseView - Dashboard"              w-64      9x9   9x9   | 8x8   |
|  text-lg font-semibold                  md:block   btn   btn   | +name  |
|                                         hidden               pl-2 border-l
+------------------------------------------------------------------------+
```

**Search Box:**
- Width: `w-64`, hidden on mobile (`hidden md:block`)
- Icon left-positioned, `border border-border bg-muted rounded-lg`
- Focus: `focus:ring-2 focus:ring-primary/50`

**Theme Toggle:**
- Size: `w-9 h-9`, Sun/Moon icon
- Rotates -90deg on toggle, 200ms animation

**Notification Bell:**
- Size: `w-9 h-9`, gradient badge with unread count (`text-[10px]`)
- Dropdown: `w-[380px]`, `right-0 top-12`, `z-50`
- Alert items: `px-4 py-3`, color indicator dot `w-2 h-2`
- Max height: `max-h-[400px] overflow-y-auto`
- Header section: `px-4 py-3 border-b bg-muted/30`
- Footer: `py-2.5 border-t bg-muted/30`

**User Avatar:**
- Size: `w-8 h-8`, gradient fallback background
- Dropdown: `w-56`, shows full_name and role
- Border separator: `pl-2 border-l border-border`

---

## 4. PAGE TYPE WIREFRAMES

### 4A. DASHBOARD PAGE

```
+------------------------------------------------------------------+
| Dashboard                                                        |
| text-3xl font-bold                                               |
+------------------------------------------------------------------+
|                                                                  |
| PIPELINE CARDS (7 gradient cards, horizontal scroll on mobile)   |
| +--------+ +--------+ +--------+ +--------+ +--------+ ...      |
| | Total  | | Await  | |Uploaded| |Rejected| | Active | ...      |
| | Cases  | | Decis. | |        | |        | |        |          |
| |  127   | |   23   | |   45   | |   12   | |   34   |          |
| | gradient| gradient | gradient | gradient | gradient |          |
| | 3D edge| 3D edge  | 3D edge  | 3D edge  | 3D edge  |         |
| +--------+ +--------+ +--------+ +--------+ +--------+          |
|                                                                  |
| WORKFLOW HEALTH (3 cards, grid-cols-1 lg:grid-cols-3)            |
| +------------------+ +------------------+ +------------------+   |
| | In-Depth         | | Enforcement      | | Destruction      |  |
| | bg-[#333] dark   | | bg-[#333] dark   | | bg-[#333] dark   |  |
| | +-In Progress--+ | | +-In Progress--+ | | +-In Progress--+ |  |
| | | 12 (orange)  | | | | 8 (orange)   | | | | 5 (orange)   | |  |
| | +-Done---------+ | | +-Done---------+ | | +-Done---------+ |  |
| | | 45 (green)   | | | | 38 (green)   | | | | 41 (green)   | |  |
| | +-Overdue------+ | | +-Overdue------+ | | +-Overdue------+ |  |
| | | 3 (red)      | | | | 5 (red)      | | | | 2 (red)      | |  |
| | SVG decoration | | | SVG decoration | | | SVG decoration | |  |
| +------------------+ +------------------+ +------------------+   |
|                                                                  |
| FINANCIAL OVERVIEW (3 cards)                                     |
| +------------------+ +------------------+ +------------------+   |
| | Fee Uploaded     | | Fee Approved     | | Outstanding      |  |
| | $125,000         | | $98,000          | | $27,000          |  |
| +------------------+ +------------------+ +------------------+   |
|                                                                  |
| CHARTS ROW (recharts: BarChart, AreaChart, PieChart)             |
| +---------------------------+ +---------------------------+      |
| | Cases by Client (Bar)     | | Cases by Province (Bar)   |     |
| | ResponsiveContainer 300px | | ResponsiveContainer 300px |     |
| +---------------------------+ +---------------------------+      |
|                                                                  |
| ALERTS & ATTENTION SECTION                                       |
| +--------------------------------------------------------------+ |
| | Overdue items, aging buckets, action-needed items            | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Features:**
- Draggable sections (dnd-kit) - users can reorder all 6 dashboard sections
- framer-motion stagger animations for entrance effects
- Pipeline cards: large bold numbers (4-5xl), status-specific gradient backgrounds, 3D bottom edge + glossy reflection, hover lift 4px
- Workflow cards: 3-column grid (In-Progress/Done/Overdue), decorative SVG patterns per stage
- Charts: recharts AreaChart, BarChart, PieChart with custom dark-mode tooltip

---

### 4B. LIST/TABLE PAGE (Cases, Invoices, Workflow)

```
+------------------------------------------------------------------+
| HEADER                                                           |
| +------------------------------------------+--------------------+|
| | Page Title          text-3xl font-bold   | [Export v] [+ New] ||
| | Description          text-muted-foreground| DropdownMenu  Btn  ||
| +------------------------------------------+--------------------+|
|                                                                  |
| FILTER BAR (flex gap-2 flex-wrap)                                |
| +----------+ +----------+ +----------+ +--------+ +--------+    |
| | Search   | | Client v | | Brand  v | | From   | | To     |    |
| | icon+inp | | Select   | | Select   | | date   | | date   |    |
| +----------+ +----------+ +----------+ +--------+ +--------+    |
|                                                    [Reset]       |
|                                                                  |
| TABLE (shadcn/ui Table, overflow-x on mobile)                    |
| +----------------------------------------------------------------+
| | Case ID | Matter | Target | Brand | Client | Type | Status |..||
| |---------|--------|--------|-------|--------|------|--------|..||
| | CS-001  | MC-123 | Name   | Nike  | OW     | Mkt  | [badge]|..||
| | CS-002  | MC-124 | Name   | Adida | AA     | Cust | [badge]|..||
| | ...     | ...    | ...    | ...   | ...    | ...  | ...    |..||
| | (skeleton rows while loading)                                 ||
| +----------------------------------------------------------------+
|                                                                  |
| PAGINATION FOOTER                                                |
| +------------------------------------------+--------------------+|
| | Showing 1-10 of 127 rows                | [Prev]    [Next]   ||
| +------------------------------------------+--------------------+|
+------------------------------------------------------------------+
```

**Row Actions (3-dot DropdownMenu per row):**
- View Details
- Edit Case (DATA_ENTRY role only)
- Quick Approve (if status UPLOADED)
- Record Decision (DATA_ENTRY only)
- Assign Reporter (DATA_ENTRY only)
- Generate Report (all roles)
- Delete Case (SUPER_ADMIN only, destructive red)

**Status Badges:** Color-coded by case status
- Green: Approved, Done, PAID
- Orange: In Progress, upcoming due
- Red: Rejected, Overdue, NOT_PAID
- Blue: Uploaded, In-Depth, Enforcement

**Export Dropdown:** CSV, Excel, PDF

---

### 4C. DETAIL PAGE (Case Detail)

```
+------------------------------------------------------------------+
| [< Back]  Case ID: CS-001  [StatusBadge]                        |
| Target: XYZ Corp | Brand: Nike | Products: Shoes                |
|                                           [Edit] [Delete] [Action]|
+------------------------------------------------------------------+
|                                                                  |
| TWO-COLUMN LAYOUT (grid-cols-1 lg:grid-cols-3)                  |
| +---------------------------------------+ +--------------------+ |
| | MAIN CONTENT (col-span-2)             | | SIDEBAR (col-span-1)| |
| |                                       | |                    | |
| | [Details] [Workflow] [Invoice] [Notes]| | Client Info Card   | |
| | ========= (Tabs component)           | | +----------------+ | |
| |                                       | | | OneWorld       | | |
| | DETAILS TAB:                          | | | Contact info   | | |
| | +----------------+------------------+ | | +----------------+ | |
| | | Case Type      | Target Name      | | |                    | |
| | | Market         | XYZ Corp         | | | Financial Card   | |
| | +----------------+------------------+ | | +----------------+ | |
| | | Client         | Category         | | | | Fee: $5,000    | | |
| | | OneWorld       | Apparel          | | | | Invoice: ...   | | |
| | +----------------+------------------+ | | +----------------+ | |
| | | Brand          | Products         | | |                    | |
| | | Nike           | Shoes            | | | Timeline Card    | |
| | +----------------+------------------+ | | +----------------+ | |
| | | Province       | City             | | | | Created: date  | | |
| | | Punjab         | Lahore           | | | | Uploaded: date | | |
| | +----------------+------------------+ | | | Approved: date | | |
| | | Matter Code    | Fee (USD)        | | | +----------------+ | |
| | | MC-123 [edit]  | $5,000 [edit]    | | |                    | |
| | +----------------+------------------+ | +--------------------+ |
| |                                       |                        |
| | WORKFLOW TAB:                         |                        |
| | Timeline-style stage cards:           |                        |
| | [In-Depth] -> [Enforcement] -> [Dest] |                       |
| | Each: due date, status, color, action |                        |
| |                                       |                        |
| | INVOICE TAB:                          |                        |
| | Invoice list with #, dates, amount,   |                        |
| | status, paid date, Send Invoice btn   |                        |
| |                                       |                        |
| | NOTES TAB:                            |                        |
| | Textarea for case notes               |                        |
| +---------------------------------------+                        |
+------------------------------------------------------------------+
```

**Workflow Tab Stage Cards:**
- Market cases: In-Depth -> Enforcement -> Destruction
- Customs cases: Enforcement -> Destruction (skips In-Depth)
- Each card: due date (red if overdue, orange if upcoming), status indicator, update button

**Modals triggered from this page:**
- UploadToClientModal (if IN_HAND)
- RecordDecisionModal (if UPLOADED)
- UpdateWorkflowModal (for each stage)
- SubmitFinalReportModal (when enforcement done)
- SendInvoiceModal (when final report done)
- UpdateInvoiceStatusModal (mark invoice paid)

---

### 4D. FORM PAGE (New Case / Edit Case)

```
+------------------------------------------------------------------+
| [< Back]  New Case                                               |
|           Create a new case record                               |
+------------------------------------------------------------------+
|                                                                  |
| FORM CARD (single column, max-width centered)                   |
| +--------------------------------------------------------------+ |
| | BASIC INFORMATION                                 (Card)     | |
| | +---------------------------+ +---------------------------+  | |
| | | Case Type *               | | Target Name *             |  | |
| | | [Select: Market/Customs]  | | [Text Input]              |  | |
| | +---------------------------+ +---------------------------+  | |
| | | Target Category *                                       |  | |
| | | [Combobox with typeahead search]                         |  | |
| | +---------------------------+-----------------------------+  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | LOCATION                                          (Card)     | |
| | +---------------------------+ +---------------------------+  | |
| | | Province *                | | City *                    |  | |
| | | [Select: 4 provinces]     | | [Combobox: depends on    |  | |
| | |  Sindh/Punjab/KPK/Baloch  | |  selected province]       |  | |
| | +---------------------------+ +---------------------------+  | |
| | | Target Address                                          |  | |
| | | [Textarea]                                              |  | |
| | +--------------------------------------------------------+  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | BRAND & PRODUCTS                                  (Card)     | |
| | +---------------------------+ +---------------------------+  | |
| | | Brand Name *              | | Products Name             |  | |
| | | [Combobox: DB + typeahead] | | [Text Input]              |  | |
| | +---------------------------+ +---------------------------+  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | REPORTING                                         (Card)     | |
| | +---------------------------+ +---------------------------+  | |
| | | Case Reported Date *      | | Case Reported By *        |  | |
| | | [Calendar Popover]        | | [Combobox with typeahead] |  | |
| | +---------------------------+ +---------------------------+  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| +--------------------------------------------------------------+ |
| | ADDITIONAL                                        (Card)     | |
| | | Notes / Description                                     |  | |
| | | [Textarea, optional]                                    |  | |
| +--------------------------------------------------------------+ |
|                                                                  |
| FOOTER                                                           |
| +------------------------------------------+--------------------+|
| |                                          | [Cancel] [Save]    ||
| +------------------------------------------+--------------------+|
+------------------------------------------------------------------+
```

**Form tech:** react-hook-form + Zod schema validation
**Combobox fields:** Brand, Reporter, Category, City — Command + Popover pattern with typeahead search
**Province-City dependency:** City options load based on selected province
**Date picker:** Calendar popover, defaults to today
**Validation:** Required fields marked with *, error messages below each field

---

### 4E. REPORT PAGE

```
+------------------------------------------------------------------+
| Finance Report                           [Column Selector] [Export v]|
| Financial overview and invoice tracking                          |
+------------------------------------------------------------------+
|                                                                  |
| TAB NAVIGATION                                                   |
| [Not Paid Invoices] [Paid Invoices]                              |
| ==================                                               |
|                                                                  |
| FILTER BAR (flex gap-2 flex-wrap)                                |
| +--------+ +--------+ +--------+ +--------+ +---------+ +-----+ |
| |Client v| |Brand v | |Prov. v | |City v  | |Aging v  | |Reset| |
| +--------+ +--------+ +--------+ +--------+ +---------+ +-----+ |
| +------------------+ +------------------+                        |
| | Issue Date Range | | Due Date Range   |                        |
| | [from] to [to]   | | [from] to [to]   |                        |
| +------------------+ +------------------+                        |
|                                                                  |
| TABLE (with draggable column headers)                            |
| +----------------------------------------------------------------+
| | Case ID | Invoice# | Client | Amount | Due Date | Status |Days||
| |---------|----------|--------|--------|----------|--------|----||
| | CS-001  | INV-100  | OW     | $5,000 | 2026-03  | [badge]| 15||
| | CS-002  | INV-101  | AA     | $3,200 | 2026-02  | [badge]| -3||  <- red row
| | CS-003  | INV-102  | SM     | $4,100 | 2026-03  | [badge]| 45||  <- green row
| +----------------------------------------------------------------+
|                                                                  |
| CHARTS SECTION (below table)                                     |
| +---------------------------+ +---------------------------+      |
| | Invoice Aging (BarChart)  | | Monthly Revenue (AreaChart)|     |
| | 0-30 | 31-60 | 61-90 |90+| | Jan Feb Mar Apr May ...    |     |
| +---------------------------+ +---------------------------+      |
+------------------------------------------------------------------+
```

**Row coloring by due date:**
- Red: overdue
- Orange: due within 7 days
- Green: not yet due
- Classification via `classifyDueDate()` function

**Column Selector (Popover):**
- Checkboxes to show/hide columns
- Drag handles to reorder columns
- Locked columns (e.g., Case ID) cannot be hidden
- Persisted to localStorage

**Export (WYSIWYG):**
- Exports exactly what's visible — matching visible columns
- Formats: CSV, Excel, PDF
- Client Reports (R30-R35): Excel + PDF only (no CSV)

---

### 4F. MODAL/DIALOG PATTERN

```
+--------------------------------------------------+
| OVERLAY (bg-black/50)                            |
|                                                  |
|   +------------------------------------------+   |
|   | DialogTitle                         [X]  |   |
|   | DialogDescription (muted text)           |   |
|   +------------------------------------------+   |
|   |                                          |   |
|   | FORM FIELDS                              |   |
|   | +--------------------------------------+ |   |
|   | | Field Label *                        | |   |
|   | | [Input / Select / RadioGroup / Date] | |   |
|   | | Error message (red, below field)     | |   |
|   | +--------------------------------------+ |   |
|   | +--------------------------------------+ |   |
|   | | Field Label 2                        | |   |
|   | | [Input / Select / etc.]              | |   |
|   | +--------------------------------------+ |   |
|   |                                          |   |
|   +------------------------------------------+   |
|   | [Cancel (outline)]     [Submit (primary)] |   |
|   +------------------------------------------+   |
+--------------------------------------------------+
```

**Modal Inventory:**

| Modal | Fields | Trigger Context |
|-------|--------|-----------------|
| Upload to Client | Client (select), Fee (USD input), Matter Code (text) | Case status = IN_HAND |
| Record Decision | Approve/Reject (radio), Decision Date (date) | Case status = UPLOADED |
| Update Workflow | Status IN_PROGRESS/DONE (radio), Date, Notes | Workflow stage cards |
| Submit Final Report | Submission Date (date), Notes | Enforcement = DONE |
| Send Invoice | Invoice #, Issue Date, Amount | Final Report submitted |
| Update Invoice Status | Status (select), Paid Date | Invoice actions |
| Change Reporter | Reporter (combobox with typeahead) | Case list actions |
| Import Cases | File upload (CSV/Excel), mapping preview | Case list header |
| Add User | Email, Password, Full Name, Role (select) | Users page |
| Edit User | Full Name, Role, Status | Users page row actions |
| Manage Permissions | Per-module checkbox grid | Users page row actions |
| Profile Settings | Name, Avatar, Preferences | Header avatar dropdown |

---

### 4G. USER MANAGEMENT PAGE

```
+------------------------------------------------------------------+
| User Management                               [+ Add New User]   |
+------------------------------------------------------------------+
|                                                                  |
| SEARCH BAR                                                       |
| +--------------------------------------------------------------+ |
| | [Search icon] Search users by name, email, or role...        | |
| +--------------------------------------------------------------+ |
|                                                                  |
| TABLE                                                            |
| +----------------------------------------------------------------+
| | Name        | Email              | Role        | Status | Act ||
| |-------------|--------------------| ------------|--------|-----||
| | John Doe    | john@example.com   | [SUPER_ADMIN]|Active | [:]||
| | Jane Smith  | jane@example.com   | [DATA_ENTRY] |Active | [:]||
| | Bob Wilson  | bob@example.com    | [VIEW_ONLY]  |Inactive|[:]||
| +----------------------------------------------------------------+
```

**Role Badge Colors:**
- SUPER_ADMIN: purple (#7e22ce)
- DATA_ENTRY: blue (#3b82f6)
- VIEW_ONLY: secondary/muted gray

**Row Action Dropdown:**
- Edit User
- Manage Permissions
- Toggle Active/Inactive
- Reset Password
- Delete User (destructive)

---

## 5. DESIGN TOKENS & THEME

### Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--background` | `hsl(210 20% 98%)` #F7FAFB | `hsl(222 47% 6%)` #0A0E1A | Page background |
| `--foreground` | `hsl(222 47% 11%)` #1A232F | `hsl(210 40% 96%)` #F0F4FA | Primary text |
| `--card` | `hsl(0 0% 100%)` #FFFFFF | `hsl(222 47% 9%)` dark navy | Card surfaces |
| `--card-foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 96%)` | Card text |
| `--popover` | `hsl(0 0% 100%)` #FFFFFF | `hsl(222 47% 9%)` | Popover/dropdown bg |
| `--primary` | `hsl(217 91% 60%)` #4B9EFF | same | Buttons, links, accents |
| `--primary-foreground` | `hsl(0 0% 100%)` white | same | Text on primary |
| `--secondary` | `hsl(214 32% 91%)` #E5EDF7 | `hsl(217 33% 17%)` #1F2A3A | Secondary surfaces |
| `--secondary-foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 96%)` | Text on secondary |
| `--muted` | `hsl(210 40% 96%)` very light | `hsl(217 33% 14%)` dark | Muted backgrounds |
| `--muted-foreground` | `hsl(215 16% 47%)` gray | `hsl(215 20% 55%)` gray | Secondary text |
| `--accent` | `hsl(217 91% 60%)` blue | same | Accent elements |
| `--accent-foreground` | `hsl(0 0% 100%)` white | same | Text on accent |
| `--destructive` | `hsl(0 84% 60%)` #FF4D4D | `hsl(0 63% 31%)` darker | Delete/error |
| `--destructive-foreground` | `hsl(0 0% 100%)` | same | Text on destructive |
| `--border` | `hsl(214 32% 91%)` | `hsl(217 33% 17%)` | All borders |
| `--input` | `hsl(214 32% 91%)` | `hsl(217 33% 17%)` | Input borders |
| `--ring` | `hsl(217 91% 60%)` blue | same | Focus rings |

### Sidebar-Specific Colors

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--sidebar-background` | `hsl(0 0% 100%)` white | `hsl(222 47% 7%)` very dark |
| `--sidebar-foreground` | `hsl(222 47% 11%)` | `hsl(210 40% 90%)` |
| `--sidebar-primary` | `hsl(217 91% 60%)` blue | same |
| `--sidebar-accent` | `hsl(214 32% 95%)` | `hsl(217 33% 14%)` |
| `--sidebar-border` | `hsl(214 32% 91%)` | `hsl(217 33% 17%)` |

### Gradient Tokens

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--gradient-from` | `hsl(217 91% 60%)` blue | `hsl(217 91% 55%)` |
| `--gradient-to` | `hsl(230 94% 65%)` light blue | `hsl(230 94% 60%)` |
| `--gradient-accent` | `hsl(199 89% 48%)` cyan | same |

### Glass Effect Tokens

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--glass-bg` | `hsl(0 0% 100% / 0.7)` 70% white | `hsl(222 47% 9% / 0.6)` 60% dark |
| `--glass-border` | `hsl(214 32% 91%)` | `hsl(217 33% 20%)` |

### Stat/Status Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--stat-green` | `hsl(142 71% 45%)` | Approved, Done, Paid |
| `--stat-red` | `hsl(0 84% 60%)` | Rejected, Overdue |
| `--stat-blue` | `hsl(217 91% 60%)` | Uploaded, Active |
| `--stat-purple` | `hsl(263 70% 50%)` | Admin badges |
| `--stat-yellow` | `hsl(38 92% 50%)` | Warnings |
| `--stat-gray` | `hsl(215 16% 47%)` | Inactive, Muted |

---

### Typography Scale

| Element | Tailwind Class | Approx Size |
|---------|---------------|-------------|
| Page title | `text-3xl font-bold tracking-tight` | 30px |
| Section title | `text-xl font-semibold` | 20px |
| Header title | `text-lg font-semibold` | 18px |
| Body / Nav items | `text-sm` | 14px |
| Field labels | `text-sm font-medium text-muted-foreground` | 14px |
| Badges / small text | `text-xs` | 12px |
| Tiny (notification badge) | `text-[10px]` | 10px |
| Font family | Inter, system-ui, sans-serif | - |

---

### Spacing & Sizing Reference

| Element | Value |
|---------|-------|
| Border radius (default) | `0.75rem` (12px) |
| Content padding (mobile) | `1rem` (16px) |
| Content padding (desktop) | `1.5rem` (24px) |
| Card internal padding | `1.5rem` (24px) |
| Section gaps (major) | `1.5rem` (24px) — `space-y-6` or `gap-6` |
| Section gaps (minor) | `1rem` (16px) — `space-y-4` or `gap-4` |
| Filter bar gaps | `0.5rem` (8px) — `gap-2` |
| Button height (default) | ~40px |
| Button height (sm) | ~32px |
| Button height (lg) | ~48px |
| Icon button | 36x36px (`size="icon"`) |
| Icon size (primary nav) | 20x20px (`w-5 h-5`) |
| Icon size (secondary) | 16x16px (`w-4 h-4`) |
| Avatar size | 32x32px (`w-8 h-8`) |
| Max content width | 1280px (`max-w-7xl`) |
| Sidebar collapsed | 56px |
| Sidebar expanded | 220px |
| Header height | 64px (`h-16`) |

---

### Custom CSS Effects

```css
/* Gradient backgrounds */
.gradient-primary {
  background: linear-gradient(135deg, hsl(var(--gradient-from)), hsl(var(--gradient-to)));
}
.gradient-accent {
  background: linear-gradient(135deg, hsl(var(--gradient-from)), hsl(var(--gradient-accent)));
}
.gradient-text {
  background: linear-gradient(...);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Glassmorphism */
.glass-card {
  background: hsl(var(--glass-bg));
  backdrop-filter: blur(12px);
  border: 1px solid hsl(var(--glass-border));
}

/* Glow effects */
.glow-sm {
  box-shadow: 0 0 20px -5px hsl(var(--primary) / 0.3);
}
.hover-glow:hover {
  box-shadow: 0 0 24px -4px hsl(var(--primary) / 0.4);
}
.glow-md {
  box-shadow: 0 0 40px -10px hsl(var(--primary) / 0.4);
}

/* Scrollbar */
/* Webkit: 6px width, transparent track, border-colored thumb */
/* Firefox: thin width, border-colored */
```

---

## 6. COMPONENT LIBRARY

### shadcn/ui Components (48 installed)

**Forms & Inputs:**
Button, Input, Textarea, Label, Select, Checkbox, RadioGroup, Form (react-hook-form wrapper), Toggle, ToggleGroup

**Layout & Containers:**
Card (Header/Title/Description/Content/Footer), Tabs (List/Trigger/Content), Accordion, Sidebar, AspectRatio, Separator, ScrollArea, Resizable

**Data Display:**
Table (Header/Body/Row/Head/Cell), Badge (variants: default/secondary/destructive/outline/success/warning), Progress, Skeleton

**Overlays & Dialogs:**
Dialog (Trigger/Content/Header/Title/Description/Footer), AlertDialog, Drawer, Popover, HoverCard, Sheet

**Navigation & Menus:**
DropdownMenu (Trigger/Content/Item/Label/Separator), ContextMenu, NavigationMenu, Menubar, Breadcrumb, Pagination

**Feedback:**
Alert, Tooltip, Sonner (toast), Toaster, Toast

**Other:**
Avatar (with fallback), Command (combobox/command palette), Calendar, Carousel, Chart (recharts wrapper), InputOTP, Slider

---

### Custom Application Components

| Component | File | Props/Purpose |
|-----------|------|---------------|
| **StatCard** | `src/components/StatCard.tsx` | `{ title, value, icon, colorClass, delay? }` — Animated KPI card with framer-motion stagger |
| **StatusBadge** | `src/components/StatusBadge.tsx` | `{ status: CaseStatus }` — Color-mapped badge for case status |
| **ColumnSelector** | `src/components/reports/ColumnSelector.tsx` | Popover with column visibility checkboxes + drag reorder + localStorage persistence |
| **DraggableHeader** | `src/components/reports/ColumnSelector.tsx` | `{ cols, allColumns, onReorder }` — Drag-to-reorder table column headers |
| **useColumnState** | `src/components/reports/ColumnSelector.tsx` | `(defs, storageKey)` — Hook managing column visibility & order with localStorage |
| **AppSidebar** | `src/components/AppSidebar.tsx` | `{ collapsed, onToggleCollapse }` — Animated sidebar with permission-filtered nav |
| **AppHeader** | `src/components/AppHeader.tsx` | Header with search, theme toggle, notification bell, user avatar |
| **MainLayout** | `src/components/layout/MainLayout.tsx` | Flex container: sidebar + header + content outlet |
| **ThemeProvider** | `src/components/ThemeProvider.tsx` | `useTheme()` hook — dark/light mode context, localStorage persisted |
| **ProtectedRoute** | `src/components/ProtectedRoute.tsx` | Route guard based on usePermissions() hook |
| **ErrorBoundary** | `src/components/ErrorBoundary.tsx` | React error boundary for crash recovery |
| **10+ Modals** | `src/components/forms/*.tsx` | Dialog + react-hook-form + Zod — all workflow action modals |

---

### ColumnDef Interface (for report tables)

```typescript
interface ColumnDef {
  key: string;        // unique column identifier
  label: string;      // display header text
  defaultVisible?: boolean;  // shown by default (default: true)
  locked?: boolean;   // cannot be hidden (e.g., Case ID)
}
```

---

## 7. TECH STACK REFERENCE

| Layer | Technology | Version Notes |
|-------|-----------|---------------|
| Framework | React 18 + TypeScript | - |
| Build Tool | Vite | Fast HMR |
| Styling | Tailwind CSS + CSS variables | Class-based dark mode |
| UI Components | shadcn/ui (Radix UI primitives) | 48 components |
| Icons | lucide-react | 463 icons, w-5 h-5 default |
| Routing | react-router-dom v6 | Nested routes with Outlet |
| Data Fetching | @tanstack/react-query v5 | Hooks + caching + invalidation |
| Forms | react-hook-form + @hookform/resolvers/zod | FormField pattern |
| Validation | Zod | Client-side schema validation |
| Charts | recharts | Area/Bar/Pie/Line charts |
| Animations | framer-motion | AnimatePresence, stagger variants |
| Drag & Drop | @dnd-kit | Dashboard section reordering |
| Dates | date-fns | Date math and formatting |
| Toasts | sonner | Success/error notifications |
| Export - CSV | papaparse | Lazy-loaded |
| Export - Excel | xlsx | Lazy-loaded |
| Export - PDF | jspdf + jspdf-autotable | Lazy-loaded |
| Backend | Supabase | PostgreSQL + Auth + Realtime |
| Dark Mode | Class-based toggle | localStorage key: `ops-theme`, default: dark |

---

## 8. RESPONSIVE BREAKPOINTS

| Breakpoint | Tailwind Prefix | Width | Layout Behavior |
|-----------|----------------|-------|-----------------|
| Mobile | (default) | <768px | Single column, sidebar collapsed, search hidden, tables overflow-x scroll |
| Tablet | `md:` | 768px+ | 2-column grids, search visible, sidebar toggleable |
| Desktop | `lg:` | 1024px+ | 3-column grids, full sidebar, all elements visible, p-6 padding |
| Wide | `xl:` | 1280px+ | Content capped at max-w-7xl, centered with mx-auto |

---

## 9. INTERACTION PATTERNS SUMMARY

| Pattern | Implementation Details |
|---------|----------------------|
| **Table row actions** | 3-dot DropdownMenu per row, permission-filtered items |
| **Filters** | Horizontal bar with Select/Input components, flex gap-2 flex-wrap, reset button appears when any filter active |
| **Pagination** | Manual prev/next buttons with page/pageSize state, `.range()` query |
| **Column management** | ColumnSelector Popover with checkboxes + drag handles, persisted to localStorage per report |
| **Modals** | Dialog + react-hook-form + Zod validation, toast.success/error on result, close + callback on success |
| **Sidebar navigation** | Expandable submenus with height animation, hrefs auto-generated from labels, permission filtering |
| **Notifications** | Bell icon with gradient badge, dropdown with color-coded alert items, mark-as-read, 30s polling |
| **Theme toggle** | Sun/Moon icon with rotation animation, class-based dark mode, localStorage persisted |
| **Loading states** | Skeleton rows in tables, Loader2 icon with animate-spin for buttons, "Saving..." text |
| **Empty states** | Inline conditional checks, no dedicated component |
| **Error handling** | Toast notifications via sonner, sanitizeErrorMessage() for safe display |
| **Export** | Dropdown with CSV/Excel/PDF, WYSIWYG (visible columns only), lazy-loaded libraries |
| **Combobox** | Command + Popover for searchable dropdowns (brand, city, reporter, category) |
| **Date picker** | Calendar Popover with date-fns formatting, defaults to today |
| **Inline editing** | Click-to-edit on detail pages (matter code, fee) |
| **Drag & drop** | Dashboard sections reorderable via @dnd-kit |
| **Stagger animations** | framer-motion container + item variants for dashboard cards entrance |

---

## 10. PERMISSION SYSTEM

### Roles
| Role | Description |
|------|-------------|
| SUPER_ADMIN | Full access to everything including admin section |
| DATA_ENTRY | Can create/edit/update cases and workflow, no admin |
| VIEW_ONLY | Read-only access to all non-admin pages |

### Permission Hook Usage
```typescript
const { can, isAdmin, isDataEntry, isViewOnly, role } = usePermissions();

// Conditional rendering
if (can('cases', 'create')) { /* show "New Case" button */ }
if (can('cases', 'edit'))   { /* show "Edit" in row actions */ }
if (can('admin', 'users'))  { /* show Admin sidebar section */ }
if (isAdmin)                { /* show delete button */ }
```

### UI Visibility Rules
- Sidebar: Admin section only for SUPER_ADMIN
- Case list: New Case button for DATA_ENTRY+
- Row actions: Edit/Delete filtered by role
- Workflow updates: DATA_ENTRY+ only
- User management: SUPER_ADMIN only

---

## 11. ROUTING MAP

```
/login                  → Login Page (public)

/                       → Dashboard
/all-cases              → CaseList (all)
/new-case               → NewCaseForm
/cases/:id              → CaseDetail
/cases/:id/edit         → EditCaseForm
/in-hand                → CaseList (status=IN_HAND)
/uploaded               → CaseList (status=UPLOADED)
/approved               → CaseList (status=APPROVED)
/rejected               → CaseList (status=REJECTED)
/closed                 → CaseList (status=CLOSED)

/in-depth               → WorkflowListView (stage=in_depth)
/enforcement            → WorkflowListView (stage=enforcement)
/destruction            → WorkflowListView (stage=destruction)

/all-invoices           → InvoiceList (all)
/invoices-due           → InvoiceList (status=NOT_PAID)
/invoices-issued        → InvoiceList (status=NOT_PAID)
/invoices-paid          → InvoiceList (status=PAID)
/invoices-over-due      → InvoiceList (status=OVERDUE)

/finance                → FinanceReport
/client-reports         → ClientReportsPage
/custom-report          → CustomReport
/pending-work           → PendingWorkPage
/pending-work/upload    → PendingWorkReport (type=upload)
/pending-work/decision  → PendingWorkReport (type=decision)
/pending-work/in-depth  → PendingWorkReport (type=in-depth)
/pending-work/enforcement → PendingWorkReport (type=enforcement)
/pending-work/final-report → PendingWorkReport (type=final-report)
/pending-work/invoices  → PendingWorkReport (type=invoices)
/pending-work/destruction → PendingWorkReport (type=destruction)

/users                  → UsersPage (SUPER_ADMIN only)
/settings               → AdminSettingsPage (SUPER_ADMIN only)
/alerts-reminders       → AlertsPage
/*                      → 404 NotFound
```

**Sidebar href auto-generation pattern:**
```
"All Cases"        → /all-cases
"In-Depth"         → /in-depth
"Alerts & Reminders" → /alerts-reminders
"Client Reports"   → /client-reports
```
Formula: `/${label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`

---

*End of wireframe document. Use this as a complete blueprint to replicate the DAP CaseView Dashboard UI/UX in any new system.*
