-- =====================================================================
-- Wave M (security follow-up) — Tighten privileged write paths and
-- realtime broadcast/presence access.
--
-- 1) instagram_app_config: restrict INSERT/UPDATE/DELETE to org owners
--    (SELECT was already owner-only). Prevents non-owner members from
--    overwriting app_secret_encrypted, webhook_verify_token, redirect_uri.
--
-- 2) realtime.messages: replace blanket `true` policies with topic-
--    scoped checks. The app currently uses ONLY postgres_changes
--    subscriptions (which enforce underlying public.* RLS), not
--    broadcast/presence. We require that any broadcast/presence topic
--    either contains the authenticated user's uid OR an org_id the
--    user belongs to. This is default-deny for unknown topics.
-- =====================================================================

-- --- Part 1: instagram_app_config ----------------------------------------
DROP POLICY IF EXISTS "Members can insert their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Members can update their org instagram app config" ON public.instagram_app_config;
DROP POLICY IF EXISTS "Members can delete their org instagram app config" ON public.instagram_app_config;

CREATE POLICY "Owners can insert their org instagram app config"
  ON public.instagram_app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Owners can update their org instagram app config"
  ON public.instagram_app_config
  FOR UPDATE
  TO authenticated
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  )
  WITH CHECK (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

CREATE POLICY "Owners can delete their org instagram app config"
  ON public.instagram_app_config
  FOR DELETE
  TO authenticated
  USING (
    public.is_organization_owner(organization_id, auth.uid())
    OR public.is_admin_master()
  );

-- --- Part 2: realtime.messages topic scoping -----------------------------
-- The realtime.messages table governs broadcast & presence channel access.
-- postgres_changes subscriptions are not affected by these policies; they
-- enforce the underlying public.* table RLS. Default-deny unknown topics.

DROP POLICY IF EXISTS authenticated_can_read_realtime ON realtime.messages;
DROP POLICY IF EXISTS authenticated_can_write_realtime ON realtime.messages;

CREATE POLICY "Authenticated users read scoped realtime topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Allow reading broadcast/presence on topics that include the user's
    -- own uid OR an org_id the user belongs to.
    (realtime.topic() LIKE '%' || auth.uid()::text || '%')
    OR EXISTS (
      SELECT 1
      FROM public.get_user_organization_ids(auth.uid()) AS org(id)
      WHERE realtime.topic() LIKE '%' || org.id::text || '%'
    )
  );

CREATE POLICY "Authenticated users write scoped realtime topics"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (realtime.topic() LIKE '%' || auth.uid()::text || '%')
    OR EXISTS (
      SELECT 1
      FROM public.get_user_organization_ids(auth.uid()) AS org(id)
      WHERE realtime.topic() LIKE '%' || org.id::text || '%'
    )
  );