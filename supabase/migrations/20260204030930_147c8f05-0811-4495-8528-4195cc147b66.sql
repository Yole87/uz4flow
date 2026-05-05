-- Add provider_place_id column for deduplication
ALTER TABLE public.prospect_results
ADD COLUMN IF NOT EXISTS provider_place_id text;

-- Create partial unique index for deduplication within same search
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_results_dedup_place_id 
ON public.prospect_results (search_id, provider_place_id) 
WHERE provider_place_id IS NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_prospect_results_provider_place_id 
ON public.prospect_results (provider_place_id) 
WHERE provider_place_id IS NOT NULL;