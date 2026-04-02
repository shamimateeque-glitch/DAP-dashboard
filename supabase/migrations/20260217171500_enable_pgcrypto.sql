-- FIX: Enable PGCrypto Extension for password hashing
-- The function gen_salt() is part of the 'pgcrypto' extension. 
-- This error means the extension is not enabled on the 'public' schema or at all.

-- 1. Enable the extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

-- 2. Verify gen_salt is available (optional safety check, but good practice)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'gen_salt'
    ) THEN
        RAISE EXCEPTION 'pgcrypto extension failed to install or gen_salt is missing';
    END IF;
END$$;
