-- Lock down realtime.messages broadcast/presence channels to authenticated users only
-- This prevents anonymous subscribers from reading any broadcast/presence channel.
-- Postgres-changes streams already respect table RLS (agent_reminders enforces user_id = auth.uid()).
-- Reference: https://supabase.com/docs/guides/realtime/authorization

DO $$
BEGIN
  -- Enable RLS on realtime.messages if not already
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';

    -- Drop any pre-existing permissive policies we may have added
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_can_read_realtime" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_can_write_realtime" ON realtime.messages';

    -- Only authenticated users can READ from broadcast/presence channels
    EXECUTE $POL$
      CREATE POLICY "authenticated_can_read_realtime"
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (true)
    $POL$;

    -- Only authenticated users can WRITE (broadcast/presence)
    EXECUTE $POL$
      CREATE POLICY "authenticated_can_write_realtime"
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (true)
    $POL$;
  END IF;
END $$;