-- Re-register tables in supabase_realtime publication for CRM realtime updates
DO $$
BEGIN
  -- Add messages table to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN 
    -- Already exists, ignore
    NULL;
  END;
  
  -- Add conversations table to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN 
    -- Already exists, ignore
    NULL;
  END;
  
  -- Add contacts table to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
  EXCEPTION WHEN duplicate_object THEN 
    -- Already exists, ignore
    NULL;
  END;
END $$;