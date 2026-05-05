
-- Remove public coupon browsing - validation happens via edge function
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON coupons;

-- Storage UPDATE policies (service_role only, like all other storage operations)
CREATE POLICY "Service role can update contact attachments"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'contact-attachments')
WITH CHECK (bucket_id = 'contact-attachments');

CREATE POLICY "Service role can update message media"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'message-media')
WITH CHECK (bucket_id = 'message-media');
