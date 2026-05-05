CREATE OR REPLACE FUNCTION public.admin_dashboard_messages_agg(
  p_start timestamptz,
  p_end timestamptz,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  day date,
  organization_id uuid,
  msg_count bigint,
  conversation_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin_master() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    (m.created_at AT TIME ZONE 'UTC')::date AS day,
    m.organization_id,
    COUNT(*)::bigint AS msg_count,
    COUNT(DISTINCT m.conversation_id)::bigint AS conversation_count
  FROM public.messages m
  WHERE m.created_at >= p_start
    AND m.created_at <= p_end
    AND (p_org_id IS NULL OR m.organization_id = p_org_id)
  GROUP BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_messages_agg(timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_messages_agg(timestamptz, timestamptz, uuid) TO authenticated, service_role;