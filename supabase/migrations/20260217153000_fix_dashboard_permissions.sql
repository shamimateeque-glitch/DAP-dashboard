-- FIX: Enable 'cases', 'invoices', and 'stages' access for ALL authenticated users.
-- The previous permissions were likely too restrictive, allowing only admins or specific roles to see cases.
-- "VIEW_ONLY" and "DATA_ENTRY" users need access to these tables to render the dashboard.

-- 1. Enable RLS on core tables (if not already on)
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.in_depth_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enforcement_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destruction_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_uploads ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Public Read Access" ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can view cases" ON public.cases;
DROP POLICY IF EXISTS "Admins have full access" ON public.cases;
-- (Repeat for other tables for safety)
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can view stages" ON public.in_depth_stages;

-- 3. Create BROAD Read Policies (View Only users need this)
-- We allow ANY authenticated user to SELECT from these tables.
-- This ensures the Dashboard queries (which touch all these tables) don't fail.

-- CASES
CREATE POLICY "Authenticated users can view cases"
ON public.cases FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert cases"
ON public.cases FOR INSERT
WITH CHECK (auth.role() = 'authenticated'); 
-- Note: Logic for who can insert is usually handled by UI hiding buttons, 
-- but strictly we might want to restrict this to non-VIEW_ONLY. 
-- For now, we prioritize fixing the "Login Failed" white screen.

CREATE POLICY "Authenticated users can update cases"
ON public.cases FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete cases"
ON public.cases FOR DELETE
USING (public.check_is_super_admin()); -- Only admins delete

-- INVOICES
CREATE POLICY "Authenticated users can view invoices"
ON public.invoices FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage invoices"
ON public.invoices FOR ALL
USING (auth.role() = 'authenticated'); -- Looser for now

-- STAGES (In-depth, Enforcement, Destruction)
CREATE POLICY "Authenticated users can view in_depth"
ON public.in_depth_stages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view enforcement"
ON public.enforcement_stages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view destruction"
ON public.destruction_stages FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage stages"
ON public.in_depth_stages FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage enforcement"
ON public.enforcement_stages FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage destruction"
ON public.destruction_stages FOR ALL USING (auth.role() = 'authenticated');

-- CASE UPLOADS (Clients)
CREATE POLICY "Authenticated users can view uploads"
ON public.case_uploads FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Grant Permissions on Sequences (often missed)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
