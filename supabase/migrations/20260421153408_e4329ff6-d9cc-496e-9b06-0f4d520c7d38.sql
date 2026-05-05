-- ============================================
-- Wave K — Migration 2: Revoke EXECUTE on privileged RPCs
-- ============================================

-- ---------- Group A: server-only callers (revoke all, grant service_role) ----------
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_id_by_email(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_grace_commissions() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.release_grace_commissions() TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_affiliate_payment(uuid, uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_affiliate_payment(uuid, uuid, text, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_webhook_init(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_webhook_init(uuid, text, text, text, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_trial_expirations() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_trial_expirations() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_messages() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_messages() TO service_role;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

-- ---------- Group B: trigger-only / internal helpers (revoke all) ----------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_affiliate_referral_attribution() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_message_organization() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_pipeline_for_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_smart_labels_for_org() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_smart_labels(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_max_3_recipients() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_affiliate_settings_changes() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_ai_provider() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_agent_reminder() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_quick_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_preferred_provider() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_conversation_assignment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_eval_config() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_keyword_rule() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_scheduled_message() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admin_async(text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- Group C: keep public access (frontend / RLS callers) ----------
-- has_role, is_admin_master, is_organization_owner, is_organization_active, is_affiliate,
-- get_user_organization_id, get_user_organization_ids, recalculate_org_storage,
-- update_member_last_seen, generate_affiliate_code, get_cron_secret  → unchanged
-- admin_dashboard_messages_agg: tighten anon only (still gates admin_master internally)
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_messages_agg(timestamptz, timestamptz, uuid) FROM anon;