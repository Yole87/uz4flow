-- Dedupe: keep most recent eval per (conversation_id, last_message_at_snapshot)
DELETE FROM public.conversation_evaluations a
USING public.conversation_evaluations b
WHERE a.conversation_id = b.conversation_id
  AND a.last_message_at_snapshot IS NOT NULL
  AND b.last_message_at_snapshot IS NOT NULL
  AND a.last_message_at_snapshot = b.last_message_at_snapshot
  AND a.evaluated_at < b.evaluated_at;

-- Now create the unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conv_eval_conv_snapshot
  ON public.conversation_evaluations (conversation_id, last_message_at_snapshot)
  WHERE last_message_at_snapshot IS NOT NULL;