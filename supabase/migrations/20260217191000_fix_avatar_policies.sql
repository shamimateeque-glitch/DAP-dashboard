-- Create a robust setup for avatars
-- 1. Create bucket if missing (public)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts or incorrect rules
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar." ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;

-- 3. Create permissive policies for the avatars bucket
-- Allow public read access to avatars
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload to avatars bucket
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow authenticated users to update files in avatars bucket
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow authenticated users to delete files in avatars bucket (optional, good for cleanup)
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 4. Ensure RLS is enabled on storage.objects (usually is by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
