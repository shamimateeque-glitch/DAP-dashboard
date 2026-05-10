-- =============================================
-- Tier 1 PII Encryption at Rest (pgcrypto)
-- Encrypts target_name, target_address, case notes
-- =============================================
--
-- PREREQUISITE — run ONCE in the Supabase SQL editor BEFORE applying this
-- migration, to store the encryption key in Supabase Vault:
--
--   SELECT vault.create_secret(
--     encode(gen_random_bytes(32), 'base64'),
--     'dap_enc_key',
--     'DAP case-data column encryption key'
--   );
--
-- Verify it exists:
--   SELECT name FROM vault.secrets WHERE name = 'dap_enc_key';
--
-- BACK UP THE DATABASE BEFORE APPLYING THIS MIGRATION. The backfill step
-- modifies every row in cases, case_notes, and the three stage tables.
-- =============================================

BEGIN;

-- 1. pgcrypto is already enabled (20260217171500), but make sure search_path
--    sees it. Belt and braces:
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 2. Key-retrieval helper. SECURITY DEFINER so the anon/authenticated roles
--    cannot call it directly; only DB-side functions and triggers can.
CREATE OR REPLACE FUNCTION public.get_enc_key()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = vault, public, pg_temp
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'dap_enc_key'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_enc_key FROM PUBLIC, anon, authenticated;

-- 3. Add encrypted shadow columns
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS target_name_enc       bytea,
  ADD COLUMN IF NOT EXISTS target_address_enc    bytea,
  ADD COLUMN IF NOT EXISTS notes_description_enc bytea;

ALTER TABLE public.case_notes
  ADD COLUMN IF NOT EXISTS note_text_enc bytea;

ALTER TABLE public.in_depth_stages
  ADD COLUMN IF NOT EXISTS notes_enc bytea;

ALTER TABLE public.enforcement_stages
  ADD COLUMN IF NOT EXISTS notes_enc bytea;

ALTER TABLE public.destruction_stages
  ADD COLUMN IF NOT EXISTS notes_enc bytea;

-- 4. Drop NOT NULL on the plaintext columns that had it, so triggers can null
--    them out after encrypting. Encrypted column is now the source of truth.
ALTER TABLE public.cases
  ALTER COLUMN target_name    DROP NOT NULL,
  ALTER COLUMN target_address DROP NOT NULL;

ALTER TABLE public.case_notes
  ALTER COLUMN note_text DROP NOT NULL;

-- 5. Backfill — encrypt all existing plaintext once
UPDATE public.cases SET
  target_name_enc       = CASE WHEN target_name       IS NOT NULL THEN pgp_sym_encrypt(target_name,       public.get_enc_key()) END,
  target_address_enc    = CASE WHEN target_address    IS NOT NULL THEN pgp_sym_encrypt(target_address,    public.get_enc_key()) END,
  notes_description_enc = CASE WHEN notes_description IS NOT NULL THEN pgp_sym_encrypt(notes_description, public.get_enc_key()) END
WHERE target_name_enc IS NULL
   OR target_address_enc IS NULL
   OR (notes_description IS NOT NULL AND notes_description_enc IS NULL);

UPDATE public.case_notes
SET note_text_enc = pgp_sym_encrypt(note_text, public.get_enc_key())
WHERE note_text_enc IS NULL AND note_text IS NOT NULL;

UPDATE public.in_depth_stages
SET notes_enc = pgp_sym_encrypt(notes, public.get_enc_key())
WHERE notes_enc IS NULL AND notes IS NOT NULL;

UPDATE public.enforcement_stages
SET notes_enc = pgp_sym_encrypt(notes, public.get_enc_key())
WHERE notes_enc IS NULL AND notes IS NOT NULL;

UPDATE public.destruction_stages
SET notes_enc = pgp_sym_encrypt(notes, public.get_enc_key())
WHERE notes_enc IS NULL AND notes IS NOT NULL;

-- 6. Wipe plaintext after backfill (now safe because *_enc is populated)
UPDATE public.cases               SET target_name = NULL, target_address = NULL, notes_description = NULL;
UPDATE public.case_notes          SET note_text = NULL;
UPDATE public.in_depth_stages     SET notes = NULL;
UPDATE public.enforcement_stages  SET notes = NULL;
UPDATE public.destruction_stages  SET notes = NULL;

-- 7. Triggers: on INSERT/UPDATE, encrypt any plaintext the app supplies into
--    the *_enc column, then null out plaintext. Frontend can keep writing
--    plaintext to the existing columns — the trigger handles the rest.

CREATE OR REPLACE FUNCTION public.trg_encrypt_cases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE k text := public.get_enc_key();
BEGIN
  IF NEW.target_name IS NOT NULL THEN
    NEW.target_name_enc := pgp_sym_encrypt(NEW.target_name, k);
    NEW.target_name := NULL;
  END IF;
  IF NEW.target_address IS NOT NULL THEN
    NEW.target_address_enc := pgp_sym_encrypt(NEW.target_address, k);
    NEW.target_address := NULL;
  END IF;
  IF NEW.notes_description IS NOT NULL THEN
    NEW.notes_description_enc := pgp_sym_encrypt(NEW.notes_description, k);
    NEW.notes_description := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_cases ON public.cases;
CREATE TRIGGER trg_encrypt_cases
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_cases();

-- Generic notes trigger (used by 3 stage tables)
CREATE OR REPLACE FUNCTION public.trg_encrypt_stage_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE k text := public.get_enc_key();
BEGIN
  IF NEW.notes IS NOT NULL THEN
    NEW.notes_enc := pgp_sym_encrypt(NEW.notes, k);
    NEW.notes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_indepth_notes ON public.in_depth_stages;
CREATE TRIGGER trg_encrypt_indepth_notes
BEFORE INSERT OR UPDATE ON public.in_depth_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_stage_notes();

DROP TRIGGER IF EXISTS trg_encrypt_enforcement_notes ON public.enforcement_stages;
CREATE TRIGGER trg_encrypt_enforcement_notes
BEFORE INSERT OR UPDATE ON public.enforcement_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_stage_notes();

DROP TRIGGER IF EXISTS trg_encrypt_destruction_notes ON public.destruction_stages;
CREATE TRIGGER trg_encrypt_destruction_notes
BEFORE INSERT OR UPDATE ON public.destruction_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_stage_notes();

-- case_notes has a differently-named column (note_text)
CREATE OR REPLACE FUNCTION public.trg_encrypt_case_notes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE k text := public.get_enc_key();
BEGIN
  IF NEW.note_text IS NOT NULL THEN
    NEW.note_text_enc := pgp_sym_encrypt(NEW.note_text, k);
    NEW.note_text := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_case_notes ON public.case_notes;
CREATE TRIGGER trg_encrypt_case_notes
BEFORE INSERT OR UPDATE ON public.case_notes
FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_case_notes();

-- 8. Decrypting views. security_invoker=true keeps base-table RLS in effect
--    (PostgreSQL 15+). The view is what the frontend should SELECT from.

CREATE OR REPLACE VIEW public.cases_v
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.case_id,
  pgp_sym_decrypt(c.target_name_enc,       public.get_enc_key())::text AS target_name,
  c.target_category,
  pgp_sym_decrypt(c.target_address_enc,    public.get_enc_key())::text AS target_address,
  c.city,
  c.province,
  c.brand_name,
  c.products_name,
  c.case_reported_date,
  c.case_reported_by,
  pgp_sym_decrypt(c.notes_description_enc, public.get_enc_key())::text AS notes_description,
  c.case_status,
  c.closed_date,
  c.created_at,
  c.updated_at,
  c.created_by
FROM public.cases c;

CREATE OR REPLACE VIEW public.case_notes_v
WITH (security_invoker = true)
AS
SELECT
  cn.id,
  cn.case_id,
  pgp_sym_decrypt(cn.note_text_enc, public.get_enc_key())::text AS note_text,
  cn.author_id,
  cn.created_at
FROM public.case_notes cn;

CREATE OR REPLACE VIEW public.in_depth_stages_v
WITH (security_invoker = true)
AS
SELECT
  s.id, s.case_id, s.target_date, s.status, s.status_date,
  pgp_sym_decrypt(s.notes_enc, public.get_enc_key())::text AS notes,
  s.created_at, s.updated_at, s.created_by
FROM public.in_depth_stages s;

CREATE OR REPLACE VIEW public.enforcement_stages_v
WITH (security_invoker = true)
AS
SELECT
  s.id, s.case_id, s.target_date, s.status, s.status_date,
  pgp_sym_decrypt(s.notes_enc, public.get_enc_key())::text AS notes,
  s.created_at, s.updated_at, s.created_by
FROM public.enforcement_stages s;

CREATE OR REPLACE VIEW public.destruction_stages_v
WITH (security_invoker = true)
AS
SELECT
  s.id, s.case_id, s.due_date, s.status, s.status_date,
  pgp_sym_decrypt(s.notes_enc, public.get_enc_key())::text AS notes,
  s.created_at, s.updated_at, s.created_by
FROM public.destruction_stages s;

GRANT SELECT ON public.cases_v              TO authenticated;
GRANT SELECT ON public.case_notes_v         TO authenticated;
GRANT SELECT ON public.in_depth_stages_v    TO authenticated;
GRANT SELECT ON public.enforcement_stages_v TO authenticated;
GRANT SELECT ON public.destruction_stages_v TO authenticated;

COMMIT;

-- =============================================
-- POST-MIGRATION CLEANUP (run in a SEPARATE migration AFTER you've verified
-- the frontend is reading from *_v views and everything works for a week):
--
--   ALTER TABLE public.cases
--     DROP COLUMN target_name,
--     DROP COLUMN target_address,
--     DROP COLUMN notes_description;
--   ALTER TABLE public.case_notes        DROP COLUMN note_text;
--   ALTER TABLE public.in_depth_stages   DROP COLUMN notes;
--   ALTER TABLE public.enforcement_stages DROP COLUMN notes;
--   ALTER TABLE public.destruction_stages DROP COLUMN notes;
--
-- (The triggers already null out plaintext, so these columns only ever hold
-- NULL now — dropping is cosmetic / prevents future accidents.)
-- =============================================
