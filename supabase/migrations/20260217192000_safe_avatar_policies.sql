DO $$
BEGIN
    -- 1. Ensure bucket exists and is public
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    -- 2. Create SELECT policy if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Avatar images are publicly accessible'
    ) THEN
        CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
    END IF;

    -- 3. Create INSERT policy if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
    END IF;

    -- 4. Create UPDATE policy if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
    END IF;

END $$;
