-- Add avatar_url column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow authenticated users to upload their own avatar
-- (Assuming RLS is enabled on storage.objects, otherwise this might need adjustment based on your project's storage setup)
-- SIMPLE POLICY: Allow anyone authenticated to select
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Users can upload their own avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

CREATE POLICY "Users can update their own avatar."
  ON storage.objects FOR UPDATE
  WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
