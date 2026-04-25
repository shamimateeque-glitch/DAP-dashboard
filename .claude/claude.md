Complete Workflow — DAP CaseView
Here's the entire lifecycle of a case from start to finish:
________________________________________
Phase 1: Case Creation → IN_HAND
A new case is created with target details, city/province, brand, case type (Customs or Market), and reporter info. Status starts as IN_HAND.
________________________________________
Phase 2: Upload to Client → UPLOADED
The case is submitted to one of three clients (OneWorld, A.A Associates, SafeMark) with a fee (USD) and optional matter code. Status becomes UPLOADED.
________________________________________
Phase 3: Client Decision → APPROVED or REJECTED
•	REJECTED → Case ends here. No further workflow.
•	APPROVED → Path splits by case type:
Case Type	Next Stage	Auto-Created Due Date
Market	In-Depth Investigation	decision date + 7 days
Customs	Enforcement (skips In-Depth)	decision date + 15 days
________________________________________
Phase 4A: In-Depth Investigation (Market cases only)
Status → IN_DEPTH. When marked DONE:
•	Automatically creates Enforcement stage (due = completion + 7 days)
•	Case status → ENFORCEMENT
________________________________________
Phase 4B: Enforcement (All approved cases)
Status → ENFORCEMENT. When marked DONE, two things auto-create:
•	Destruction stage (due = completion + 1 day)
•	Final Report record (due = completion + 7 days)
•	Case status → DESTRUCTION
________________________________________
Phase 5: Destruction
Status → DESTRUCTION. When marked DONE:
•	Case status → CLOSED (end of operational workflow)
________________________________________
Phase 6: Final Report (parallel track)
Submitted independently — doesn't affect case status. Records the actual submission date to the client. This date is used to calculate invoice due dates.
________________________________________
Phase 7: Invoice
Created manually after final report submission.
•	Due date = invoice issue date + 90 days (uniform across all clients: OneWorld, A.A Associates, SafeMark)
•	Invoice statuses: ISSUED → PAID (or remains unpaid/overdue)
•	System auto-detects overdue invoices for reporting
________________________________________
Visual Flow
                        IN_HAND
                           │
                    [Upload to Client]
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
                            │           │
                        [DONE]          │
                            \          /
                          ENFORCEMENT
                               │
                            [DONE]
                           /       \
                    DESTRUCTION   Final Report
                         │        (parallel)
                      [DONE]          │
                         │        [Submit]
                       CLOSED         │
                                   Invoice
                                 ISSUED → PAID
________________________________________
Alerts & Reminders
The system sends notifications at key events:
•	CASE_APPROVED / CASE_REJECTED
•	IN_DEPTH_DONE / ENFORCEMENT_DONE / DESTRUCTION_DONE
•	FINAL_REPORT_SUBMITTED
•	INVOICE_ISSUED / INVOICE_PAID / INVOICE_OVERDUE
•	Due date reminders: IN_DEPTH_DUE, ENFORCEMENT_DUE, INVOICE_DUE
________________________________________
Key Business Rules
1.	Customs skip In-Depth — go straight to Enforcement after approval
2.	Each stage auto-creates the next with calculated due dates
3.	Final Report is independent — doesn't block case closure
4.	Only Destruction completion closes a case
5.	Invoice due dates depend on client payment terms, not workflow dates
That's the complete end-to-end workflow. Want me to dive deeper into any specific phase?

