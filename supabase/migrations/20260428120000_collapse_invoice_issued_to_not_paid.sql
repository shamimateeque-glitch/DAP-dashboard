-- Collapse the redundant ISSUED status into NOT_PAID.
--
-- The UI no longer distinguishes "newly issued" from "explicitly marked unpaid"
-- — both render as a single "UNPAID" badge — so storing the distinction in the
-- database adds no value and is a source of confusion (e.g. outstanding totals
-- accidentally filtering on only one of the two values).
--
-- After this runs, every non-PAID invoice carries status = 'NOT_PAID'.
-- The enum type still permits 'ISSUED' (removing an enum value in Postgres is
-- intrusive); we just stop writing it. New invoices are created as 'NOT_PAID'
-- by SendInvoiceModal and the import path.

BEGIN;

UPDATE invoices
SET status     = 'NOT_PAID',
    updated_at = NOW()
WHERE status = 'ISSUED';

-- Verify after COMMIT:
-- SELECT status, COUNT(*) FROM invoices GROUP BY status;

COMMIT;
