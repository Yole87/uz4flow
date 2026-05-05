-- Add provider selection (gemini or openai) and OpenAI key support
ALTER TABLE public.organization_ai_configs
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'gemini',
  ADD COLUMN IF NOT EXISTS openai_api_key_encrypted text;

-- Validate provider via trigger (CHECK constraints discouraged per project rules,
-- but this is a static enum so we use a simple validation trigger)
CREATE OR REPLACE FUNCTION public.validate_ai_provider()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.provider NOT IN ('gemini', 'openai') THEN
    RAISE EXCEPTION 'provider must be either gemini or openai';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_ai_provider_trigger ON public.organization_ai_configs;
CREATE TRIGGER validate_ai_provider_trigger
  BEFORE INSERT OR UPDATE ON public.organization_ai_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ai_provider();