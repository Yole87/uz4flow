-- Create storage bucket for message media (audio, images, etc.)
INSERT INTO storage.buckets (id, name, public) VALUES ('message-media', 'message-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload message media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'message-media');

-- Allow public read access (media needs to be accessible in chat)
CREATE POLICY "Message media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'message-media');

-- Allow service role to manage
CREATE POLICY "Service role can manage message media"
ON storage.objects FOR ALL
USING (bucket_id = 'message-media');
