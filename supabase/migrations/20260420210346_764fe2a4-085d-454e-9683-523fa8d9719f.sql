CREATE OR REPLACE VIEW public.attendance_queue_view
WITH (security_invoker = true)
AS
SELECT
  tm.id AS member_id,
  tm.organization_id,
  tm.user_id,
  tm.is_active,
  tm.last_seen_at,
  COALESCE(p.full_name, '—') AS member_name,
  tp.department AS department,
  tp.title AS role_title,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'active') AS active_conversations,
  COUNT(DISTINCT c.id) FILTER (
    WHERE c.status = 'active'
    AND c.last_sender_type = 'customer'
  ) AS pending_response,
  AVG(
    EXTRACT(EPOCH FROM (now() - c.last_message_at)) / 60.0
  ) FILTER (
    WHERE c.status = 'active'
    AND c.last_sender_type = 'customer'
  )::numeric(10, 1) AS avg_wait_minutes,
  MAX(c.last_message_at) AS last_activity_at
FROM public.team_members tm
LEFT JOIN public.profiles p ON p.user_id = tm.user_id
LEFT JOIN public.team_profiles tp ON tp.id = tm.team_profile_id
LEFT JOIN public.contacts ct ON ct.assigned_to_member_id = tm.id
LEFT JOIN public.conversations c ON c.contact_id = ct.id
WHERE tm.is_active = true
GROUP BY tm.id, tm.organization_id, tm.user_id, tm.is_active, tm.last_seen_at,
         p.full_name, tp.department, tp.title;

CREATE OR REPLACE FUNCTION public.update_member_last_seen(_member_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.team_members
  SET last_seen_at = now()
  WHERE id = _member_id
    AND (
      user_id = auth.uid()
      OR is_organization_owner(organization_id, auth.uid())
    );
$$;