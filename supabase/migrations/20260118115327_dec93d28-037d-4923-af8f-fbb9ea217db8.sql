-- Add interactions column to webhook_connectors (array of interaction configurations)
ALTER TABLE public.webhook_connectors 
ADD COLUMN IF NOT EXISTS interactions jsonb DEFAULT NULL;

-- Add interaction_results column to connector_events (results of each interaction)
ALTER TABLE public.connector_events 
ADD COLUMN IF NOT EXISTS interaction_results jsonb DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.webhook_connectors.interactions IS 'Array of interaction configurations: [{id, order_index, type, text_mode, template, ai_prompt, file_id, file_name, delay_ms}]';
COMMENT ON COLUMN public.connector_events.interaction_results IS 'Results of each interaction: [{order, type, status, latency_ms, error}]';