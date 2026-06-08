-- Fix: Chat photos DELETE policy was missing ownership check
-- Any authenticated user could delete any other user's photos

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can delete own chat photos" ON storage.objects;

-- Recreate with ownership verification
-- Filenames follow pattern: chat_{user_id}_{timestamp}_{randomId}.jpg
CREATE POLICY "Users can delete own chat photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-photos'
    AND auth.role() = 'authenticated'
    AND (string_to_array(name, '_'))[2] = auth.uid()::text
  );
