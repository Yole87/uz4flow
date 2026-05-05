-- Tornar o bucket message-media público para que Instagram/WhatsApp consigam baixar mídias enviadas
UPDATE storage.buckets SET public = true WHERE id = 'message-media';