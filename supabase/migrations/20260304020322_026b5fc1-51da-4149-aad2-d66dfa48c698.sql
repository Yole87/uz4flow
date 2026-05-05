
-- Backfill meta_conversation_windows for existing Meta conversations
-- that have customer messages but no window record
INSERT INTO public.meta_conversation_windows (conversation_id, window_type, window_expires_at, last_customer_message_at, is_from_campaign)
SELECT DISTINCT ON (c.id)
  c.id AS conversation_id,
  '24h' AS window_type,
  m.timestamp + INTERVAL '24 hours' AS window_expires_at,
  m.timestamp AS last_customer_message_at,
  false AS is_from_campaign
FROM conversations c
JOIN instances i ON i.id = c.instance_id
JOIN messages m ON m.conversation_id = c.id AND m.sender_type = 'customer'
WHERE i.provider = 'meta_official'
  AND NOT EXISTS (
    SELECT 1 FROM meta_conversation_windows mcw WHERE mcw.conversation_id = c.id
  )
ORDER BY c.id, m.timestamp DESC
ON CONFLICT (conversation_id) DO NOTHING;
