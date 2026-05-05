
-- ===========================
-- Fase 3.1: Frequência configurável de avaliação por IA
-- ===========================

-- Add evaluation frequency mode to config
ALTER TABLE public.conversation_evaluation_configs
  ADD COLUMN IF NOT EXISTS eval_frequency text NOT NULL DEFAULT 'silence_only';

-- Validate eval_frequency values via trigger
CREATE OR REPLACE FUNCTION public.validate_eval_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.eval_frequency NOT IN ('silence_only', 'once_per_conversation', 'once_per_day', 'every_inbound') THEN
    RAISE EXCEPTION 'eval_frequency must be silence_only, once_per_conversation, once_per_day or every_inbound';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_eval_config_trigger ON public.conversation_evaluation_configs;
CREATE TRIGGER validate_eval_config_trigger
  BEFORE INSERT OR UPDATE ON public.conversation_evaluation_configs
  FOR EACH ROW EXECUTE FUNCTION public.validate_eval_config();

-- Track last evaluation timestamp per conversation for once_per_day mode
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_evaluated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversations_last_evaluated_at 
  ON public.conversations(last_evaluated_at);

-- ===========================
-- Fase 3.2: Retenção de dados por plano
-- ===========================

-- Function to enforce data retention per organization
CREATE OR REPLACE FUNCTION public.cleanup_expired_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org RECORD;
  v_retention_days int;
  v_total_msgs int := 0;
  v_total_convs int := 0;
  v_msg_count int;
  v_conv_count int;
  v_cutoff timestamptz;
BEGIN
  FOR v_org IN
    SELECT 
      o.id AS org_id,
      COALESCE(
        ((sp.limits->>'data_retention_days')::int),
        0
      ) AS retention_days
    FROM public.organizations o
    LEFT JOIN public.subscriptions s ON s.organization_id = o.id
    LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE o.is_active = true
      AND o.blocked_at IS NULL
  LOOP
    v_retention_days := v_org.retention_days;
    
    -- 0 or NULL means unlimited (no retention)
    IF v_retention_days IS NULL OR v_retention_days <= 0 THEN
      CONTINUE;
    END IF;

    v_cutoff := now() - (v_retention_days || ' days')::interval;

    -- Delete old messages (will cascade to media references via storage cleanup separately)
    WITH deleted_msgs AS (
      DELETE FROM public.messages m
      USING public.conversations c, public.contacts ct
      WHERE m.conversation_id = c.id
        AND c.contact_id = ct.id
        AND ct.organization_id = v_org.org_id
        AND m.timestamp < v_cutoff
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_msg_count FROM deleted_msgs;

    -- Delete conversations with no remaining messages and old activity
    WITH deleted_convs AS (
      DELETE FROM public.conversations c
      USING public.contacts ct
      WHERE c.contact_id = ct.id
        AND ct.organization_id = v_org.org_id
        AND COALESCE(c.last_message_at, c.created_at) < v_cutoff
        AND NOT EXISTS (
          SELECT 1 FROM public.messages m WHERE m.conversation_id = c.id
        )
      RETURNING c.id
    )
    SELECT COUNT(*) INTO v_conv_count FROM deleted_convs;

    v_total_msgs := v_total_msgs + v_msg_count;
    v_total_convs := v_total_convs + v_conv_count;
  END LOOP;

  RETURN jsonb_build_object(
    'messages_deleted', v_total_msgs,
    'conversations_deleted', v_total_convs,
    'executed_at', now()
  );
END;
$$;

-- Schedule daily retention cleanup at 03:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing schedule if any
    PERFORM cron.unschedule('cleanup-expired-messages-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-messages-daily');

    PERFORM cron.schedule(
      'cleanup-expired-messages-daily',
      '0 3 * * *',
      $cron$ SELECT public.cleanup_expired_messages(); $cron$
    );
  END IF;
END $$;
