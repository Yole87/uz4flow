-- ============================================
-- Wave K — Migration 1: Forensic FK CASCADE → SET NULL
-- Preserves log/audit/event records when parent rows are deleted
-- ============================================

-- 1) connector_events.connector_id → webhook_connectors(id)
ALTER TABLE public.connector_events DROP CONSTRAINT connector_events_connector_id_fkey;
ALTER TABLE public.connector_events ALTER COLUMN connector_id DROP NOT NULL;
ALTER TABLE public.connector_events
  ADD CONSTRAINT connector_events_connector_id_fkey
  FOREIGN KEY (connector_id) REFERENCES public.webhook_connectors(id) ON DELETE SET NULL;

-- 2) contact_import_history.organization_id → organizations(id)
ALTER TABLE public.contact_import_history DROP CONSTRAINT contact_import_history_organization_id_fkey;
ALTER TABLE public.contact_import_history ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.contact_import_history
  ADD CONSTRAINT contact_import_history_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 3) instagram_action_logs.organization_id → organizations(id)
ALTER TABLE public.instagram_action_logs DROP CONSTRAINT instagram_action_logs_organization_id_fkey;
ALTER TABLE public.instagram_action_logs ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.instagram_action_logs
  ADD CONSTRAINT instagram_action_logs_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 4) instagram_events.organization_id → organizations(id)
ALTER TABLE public.instagram_events DROP CONSTRAINT instagram_events_organization_id_fkey;
ALTER TABLE public.instagram_events ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.instagram_events
  ADD CONSTRAINT instagram_events_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 5) plan_change_log.organization_id → organizations(id)
ALTER TABLE public.plan_change_log DROP CONSTRAINT plan_change_log_organization_id_fkey;
ALTER TABLE public.plan_change_log ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.plan_change_log
  ADD CONSTRAINT plan_change_log_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 6) usage_logs.organization_id → organizations(id)
ALTER TABLE public.usage_logs DROP CONSTRAINT usage_logs_organization_id_fkey;
ALTER TABLE public.usage_logs ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.usage_logs
  ADD CONSTRAINT usage_logs_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 7) events.user_id → auth.users(id)
ALTER TABLE public.events DROP CONSTRAINT events_user_id_fkey;
ALTER TABLE public.events ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;