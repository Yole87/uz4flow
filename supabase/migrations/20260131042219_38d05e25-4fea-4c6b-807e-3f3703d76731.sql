-- Add ai_analysis JSONB column to contacts table for storing AI insights
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.ai_analysis IS 'Stores AI-generated conversation analysis including summary, sentiment, suggested replies, and next actions';