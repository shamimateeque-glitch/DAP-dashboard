-- Recalculate existing invoice due dates under the new uniform rule:
--   due_date = issue_date + 90 days
--
-- Prior rule used client-specific terms (45 / 90 / 95 days) and was anchored
-- to the final report submission date. New rule is uniform 90 days from the
-- invoice issue date.
--
-- Scope: only ISSUED / NOT_PAID invoices. PAID invoices are left alone so
-- historical "what was the customer supposed to pay by" data stays intact.
-- If you want PAID invoices updated too, remove the status filter below.

BEGIN;

UPDATE invoices
SET due_date   = (issue_date + INTERVAL '90 days')::date,
    updated_at = NOW()
WHERE issue_date IS NOT NULL
  AND status IN ('ISSUED', 'NOT_PAID');

-- Sanity check: see how many rows were updated.
-- (Run this same SELECT after COMMIT to verify the new spread looks right.)
-- SELECT status, COUNT(*) FROM invoices GROUP BY status;

COMMIT;
