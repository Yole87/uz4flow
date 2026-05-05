-- Update existing validation trigger to enforce silence_minutes >= 1
CREATE OR REPLACE FUNCTION public.validate_eval_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.eval_frequency NOT IN ('silence_only', 'once_per_conversation', 'once_per_day', 'every_inbound') THEN
    RAISE EXCEPTION 'eval_frequency must be silence_only, once_per_conversation, once_per_day or every_inbound';
  END IF;
  IF NEW.silence_minutes IS NOT NULL AND NEW.silence_minutes < 1 THEN
    RAISE EXCEPTION 'silence_minutes must be >= 1';
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS validate_eval_config_trg ON public.conversation_evaluation_configs;
CREATE TRIGGER validate_eval_config_trg
BEFORE INSERT OR UPDATE ON public.conversation_evaluation_configs
FOR EACH ROW EXECUTE FUNCTION public.validate_eval_config();