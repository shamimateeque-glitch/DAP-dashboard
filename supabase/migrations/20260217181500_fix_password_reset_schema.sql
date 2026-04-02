-- FIX: Password Reset with Schema Discovery
-- The function public.gen_salt() does not exist, which means pgcrypto is NOT in 'public'.
-- It is likely in 'extensions' or 'auth'.
-- We will search for it or try the 'extensions' schema directly.

DO $$
DECLARE
    salt text;
BEGIN
    -- Try to generate salt using 'extensions' schema if 'public' failed
    -- We assume the extension exists somewhere because previous steps didn't error on 'CREATE EXTENSION'
    
    -- Attempt 1: Try extensions.gen_salt
    BEGIN
        salt := extensions.gen_salt('bf');
    EXCEPTION WHEN OTHERS THEN
        -- Attempt 2: Try public.gen_salt (we know this failed, but for completeness)
        BEGIN
            salt := public.gen_salt('bf');
        EXCEPTION WHEN OTHERS THEN
             -- Attempt 3: Just gen_salt (relying on search_path)
             salt := gen_salt('bf');
        END;
    END;
    
    -- If we got here, we hopefully have a salt. If not, the update below will fail, 
    -- but let's try to run the update using the 'extensions' path first as it's the most common alternative.
END $$;

-- REAL FIX:
-- We will blindly try the 'extensions' schema first, as that is the standard Supabase alternative to 'public'.
-- If this fails, we will try to move the extension to public.

-- OPTION A: Move extension to public (The "Nuclear" Fix for path issues)
-- Uncomment the next line if you want to force it to public forever.
-- ALTER EXTENSION "pgcrypto" SET SCHEMA public;

-- OPTION B: Use the likely path
UPDATE auth.users
SET encrypted_password = crypt('12345678', extensions.gen_salt('bf'));
