-- Sprint 1: Graph Engine + IF/ELSE foundation

-- 1. Add condition fields to flow_connections
ALTER TABLE public.flow_connections
  ADD COLUMN IF NOT EXISTS condition_type TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condition_operator TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condition_value TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS condition_variable TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL;

-- 2. Add current_step_id to flow_sessions for graph navigation
ALTER TABLE public.flow_sessions
  ADD COLUMN IF NOT EXISTS current_step_id UUID DEFAULT NULL REFERENCES public.flow_steps(id) ON DELETE SET NULL;

-- 3. Add condition_config to flow_steps for condition nodes
ALTER TABLE public.flow_steps
  ADD COLUMN IF NOT EXISTS condition_config JSONB DEFAULT NULL;

-- 4. Backfill current_step_id for active sessions
UPDATE public.flow_sessions fs
SET current_step_id = (
  SELECT id FROM public.flow_steps
  WHERE flow_id = fs.flow_id
    AND order_index = fs.current_step_index
  LIMIT 1
)
WHERE fs.status = 'active'
  AND fs.current_step_id IS NULL;