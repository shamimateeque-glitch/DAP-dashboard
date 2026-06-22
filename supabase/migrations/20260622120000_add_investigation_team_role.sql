-- Add the INVESTIGATION_TEAM role for the field (Investigation & Enforcement) team.
-- These users get a view-only, financial-free experience limited to the
-- In-Depth / Enforcement / Destruction pending-work screens.
--
-- NOTE: ALTER TYPE ... ADD VALUE must be committed before the new value can be
-- used elsewhere. Keep this in its own migration and do not reference
-- 'INVESTIGATION_TEAM' in the same file. The existing admin_create_user RPC already
-- casts p_role::public.user_role_enum (with a VIEW_ONLY fallback), so no RPC change
-- is required once this value exists.

ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'INVESTIGATION_TEAM';
