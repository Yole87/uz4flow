-- Enable realtime for crm_webhook_events table (for auto-updating logs)
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_webhook_events;