-- Drop the old constraint
ALTER TABLE public.prospect_searches DROP CONSTRAINT IF EXISTS prospect_searches_provider_used_check;

-- Add the updated constraint with google_places as a valid option
ALTER TABLE public.prospect_searches ADD CONSTRAINT prospect_searches_provider_used_check 
CHECK (provider_used = ANY (ARRAY['google'::text, 'firecrawl'::text, 'google_places'::text]));