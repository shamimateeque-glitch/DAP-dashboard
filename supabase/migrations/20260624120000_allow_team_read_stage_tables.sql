-- The Investigation & Enforcement team (and other non-admin authenticated users) must be
-- able to READ the operational stage tables to see their pending work. The live RLS on these
-- tables had effectively become admin-only, so non-admin users received EMPTY stage data —
-- which made every "pending" count read 0 (in_depth/enforcement/destruction).
--
-- These tables are non-financial (status + dates; the `notes` column is encrypted), so
-- authenticated read access is appropriate. Financial tables (invoices, final_reports) are
-- intentionally NOT broadened here.
--
-- Permissive SELECT policies are OR-combined, so adding these grants read access to all
-- authenticated users regardless of any pre-existing admin-only policy.

ALTER TABLE public.in_depth_stages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enforcement_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destruction_stages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.in_depth_stages, public.enforcement_stages, public.destruction_stages
  TO authenticated;

DROP POLICY IF EXISTS "team_read_in_depth_stages" ON public.in_depth_stages;
CREATE POLICY "team_read_in_depth_stages"
  ON public.in_depth_stages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_read_enforcement_stages" ON public.enforcement_stages;
CREATE POLICY "team_read_enforcement_stages"
  ON public.enforcement_stages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_read_destruction_stages" ON public.destruction_stages;
CREATE POLICY "team_read_destruction_stages"
  ON public.destruction_stages FOR SELECT TO authenticated USING (true);
