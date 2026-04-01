-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to avatars
CREATE POLICY "Avatar images are publicly accessible."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow authenticated users to upload avatars
CREATE POLICY "Users can upload their own avatars."
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- Allow users to update their own avatars
CREATE POLICY "Users can update their own avatars."
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatars."
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND 
    auth.role() = 'authenticated'
  );

-- Ensure profiles table has avatar_url column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url text;
  END IF;
END $$;
