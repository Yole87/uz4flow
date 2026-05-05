-- Add max_results column to visual_scrape_sessions for Places API tracking
ALTER TABLE public.visual_scrape_sessions
ADD COLUMN IF NOT EXISTS max_results integer DEFAULT 100;