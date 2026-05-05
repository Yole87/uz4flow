-- 1) Drop the existing constraint that only allows pending|processing|completed|failed
ALTER TABLE public.prospect_searches 
DROP CONSTRAINT IF EXISTS prospect_searches_status_check;

-- 2) Add new constraint that includes 'stopped'
ALTER TABLE public.prospect_searches 
ADD CONSTRAINT prospect_searches_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'stopped'));

-- 3) Fix existing inconsistent data: sync prospect_searches with visual_scrape_sessions
-- For Google Places API searches (linked via metrics->>'search_record_id')
UPDATE public.prospect_searches ps
SET 
  status = vs.status,
  total_results = COALESCE(vs.total_found, 0),
  completed_at = COALESCE(vs.completed_at, now()),
  error_message = COALESCE(vs.error_message, 
    CASE WHEN vs.status = 'stopped' THEN 'Busca interrompida pelo usuário' ELSE NULL END)
FROM public.visual_scrape_sessions vs
WHERE ps.status = 'processing'
  AND (vs.metrics->>'search_record_id')::uuid = ps.id
  AND vs.status IN ('completed', 'failed', 'stopped');

-- 4) Also fix any prospect_searches that are stuck in 'processing' for too long without a session match
UPDATE public.prospect_searches
SET 
  status = 'failed',
  completed_at = now(),
  error_message = 'Sessão expirada por inatividade'
WHERE status = 'processing'
  AND created_at < now() - INTERVAL '1 hour';